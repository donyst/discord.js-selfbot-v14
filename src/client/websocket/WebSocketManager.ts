import EventEmitter from 'node:events';
import { setImmediate } from 'node:timers';
import { setTimeout as sleep } from 'node:timers/promises';
import { Collection } from '@discordjs/collection';
import { RPCErrorCodes } from 'discord-api-types/v10';
import WebSocketShard, { type WebSocketCloseEvent } from './WebSocketShard.js';
import PacketHandlers from './handlers/index.js';
import { DiscordError as Error } from '../../errors/index.js';
import { Events, ShardEvents, Status, WSCodes, WSEvents } from '../../util/Constants.js';
import type { Client } from '../Client.js';

export interface GatewayPacket {
  op: number;
  d: unknown;
  t?: string;
  s?: number;
}

export interface QueuedPacket {
  packet: GatewayPacket;
  shard: WebSocketShard;
}

const BeforeReadyWhitelist: string[] = [
  WSEvents.READY,
  WSEvents.RESUMED,
  WSEvents.GUILD_CREATE,
  WSEvents.GUILD_DELETE,
  WSEvents.GUILD_MEMBERS_CHUNK,
  WSEvents.GUILD_MEMBER_ADD,
  WSEvents.GUILD_MEMBER_REMOVE,
];

const UNRECOVERABLE_CLOSE_CODES = Object.keys(WSCodes).slice(2).map(Number);
const UNRESUMABLE_CLOSE_CODES: number[] = [
  RPCErrorCodes.UnknownError,
  RPCErrorCodes.InvalidPermissions,
  RPCErrorCodes.InvalidClientId,
];

/**
 * The WebSocket manager for this client.
 * @extends {EventEmitter}
 */
export class WebSocketManager extends EventEmitter {
  public readonly client: Client;
  public gateway: string | null;
  public totalShards: number;
  public shards: Collection<number, WebSocketShard>;
  private shardQueue: Set<WebSocketShard>;
  private packetQueue: QueuedPacket[];
  public status: number;
  public destroyed: boolean;
  public reconnecting: boolean;

  public constructor(client: Client) {
    super();

    this.client = client;
    this.gateway = null;
    this.totalShards = Array.isArray(this.client.options.shards) ? this.client.options.shards.length : 1;
    this.shards = new Collection();
    this.shardQueue = new Set();
    this.packetQueue = [];
    this.status = Status.IDLE;
    this.destroyed = false;
    this.reconnecting = false;
  }

  public get ping(): number {
    const sum = this.shards.reduce((a, b) => a + b.ping, 0);
    return sum / (this.shards.size || 1);
  }

  public debug(message: string, shard?: WebSocketShard): void {
    this.client.emit(Events.DEBUG, `[WS => ${shard ? `Shard ${shard.id}` : 'Manager'}] ${message}`);
  }

  public async connect(): Promise<boolean> {
    let gatewayURL = 'wss://gateway.discord.gg';
    await (this.client.api as unknown as { gateway: { get(opts: unknown): Promise<{ url: string }> } }).gateway
      .get({ auth: false })
      .then(r => {
        gatewayURL = r.url;
      })
      .catch(() => {});

    const total = Infinity;
    const remaining = Infinity;
    const recommendedShards = 1;

    this.debug(`Fetched Gateway Information
    URL: ${gatewayURL}
    Recommended Shards: ${recommendedShards}`);

    this.debug(`Session Limit Information
    Total: ${total}
    Remaining: ${remaining}`);

    this.gateway = `${gatewayURL}/`;

    let shards: number[] = this.client.options.shards;

    if ((shards as unknown) === 'auto') {
      this.debug(`Using the recommended shard count provided by Discord: ${recommendedShards}`);
      this.totalShards = this.client.options.shardCount = recommendedShards;
      shards = this.client.options.shards = Array.from({ length: recommendedShards }, (_, i) => i);
    }

    this.totalShards = shards.length;
    this.debug(`Spawning shards: ${shards.join(', ')}`);
    this.shardQueue = new Set(shards.map(id => new WebSocketShard(this, id)));

    return this.createShards();
  }

  public async createShards(): Promise<boolean> {
    if (!this.shardQueue.size) return false;

    const [shard] = this.shardQueue;
    this.shardQueue.delete(shard);

    if (!shard.eventsAttached) {
      shard.on(ShardEvents.ALL_READY, unavailableGuilds => {
        this.client.emit(Events.SHARD_READY, shard.id, unavailableGuilds);

        if (!this.shardQueue.size) this.reconnecting = false;
        this.checkShardsReady();
      });

      shard.on(ShardEvents.CLOSE, (event: WebSocketCloseEvent) => {
        if (event.code === 1_000 ? this.destroyed : UNRECOVERABLE_CLOSE_CODES.includes(event.code)) {
          this.client.emit(Events.SHARD_DISCONNECT, event, shard.id);
          this.debug((WSCodes as Record<number, string>)[event.code] ?? 'Unknown close code', shard);
          return;
        }

        if (UNRESUMABLE_CLOSE_CODES.includes(event.code)) {
          shard.sessionId = null;
        }

        this.client.emit(Events.SHARD_RECONNECTING, shard.id);
        this.shardQueue.add(shard);

        if (shard.sessionId) this.debug('Session id is present, attempting an immediate reconnect...', shard);
        this.reconnect();
      });

      shard.on(ShardEvents.INVALID_SESSION, () => {
        this.client.emit(Events.SHARD_RECONNECTING, shard.id);
      });

      shard.on(ShardEvents.DESTROYED, () => {
        this.debug('Shard was destroyed but no WebSocket connection was present! Reconnecting...', shard);
        this.client.emit(Events.SHARD_RECONNECTING, shard.id);
        this.shardQueue.add(shard);
        this.reconnect();
      });

      shard.eventsAttached = true;
    }

    this.shards.set(shard.id, shard);

    try {
      await shard.connect();
    } catch (error: unknown) {
      const err = error as { code?: number };
      if (err?.code && UNRECOVERABLE_CLOSE_CODES.includes(err.code)) {
        throw new Error((WSCodes as Record<number, string>)[err.code] ?? 'UNKNOWN_CLOSE');
      } else if (!err || err.code) {
        this.debug('Failed to connect to the gateway, requeueing...', shard);
        this.shardQueue.add(shard);
      } else {
        throw error;
      }
    }

    if (this.shardQueue.size) {
      this.debug(`Shard Queue Size: ${this.shardQueue.size}; continuing in 5 seconds...`);
      await sleep(5_000);
      return this.createShards();
    }

    return true;
  }

  public async reconnect(): Promise<boolean> {
    if (this.reconnecting || this.status !== Status.READY) return false;
    this.reconnecting = true;
    try {
      await this.createShards();
    } catch (error: unknown) {
      this.debug(`Couldn't reconnect or fetch information about the gateway. ${error}`);
      const errObj = error as { httpStatus?: number };
      if (errObj?.httpStatus !== 401) {
        this.debug('Possible network error occurred. Retrying in 5s...');
        await sleep(5_000);
        this.reconnecting = false;
        return this.reconnect();
      }
      if (this.client.listenerCount(Events.INVALIDATED)) {
        this.client.emit(Events.INVALIDATED);
        this.destroy();
      } else {
        this.client.destroy();
      }
    } finally {
      this.reconnecting = false;
    }
    return true;
  }

  public broadcast(packet: unknown): void {
    for (const shard of this.shards.values()) {
      shard.send(packet);
    }
  }

  public destroy(): void {
    if (this.destroyed) return;
    this.debug(`Manager was destroyed. Called by:\n${new Error('MANAGER_DESTROYED').stack}`);
    this.destroyed = true;
    this.shardQueue.clear();
    for (const shard of this.shards.values()) {
      shard.destroy({ closeCode: 1_000, reset: true, emit: false, log: false });
    }
  }

  public handlePacket(packet?: GatewayPacket, shard?: WebSocketShard): boolean {
    if (packet && this.status !== Status.READY) {
      if (packet.t && !BeforeReadyWhitelist.includes(packet.t)) {
        this.packetQueue.push({ packet, shard: shard! });
        return false;
      }
    }

    if (this.packetQueue.length) {
      const item = this.packetQueue.shift();
      if (item) {
        setImmediate(() => {
          this.handlePacket(item.packet, item.shard);
        }).unref();
      }
    }

    if (packet?.t && PacketHandlers[packet.t]) {
      PacketHandlers[packet.t]!(this.client, packet, shard!);
    } else if (packet) {
      this.client.emit(Events.UNHANDLED_PACKET, packet, shard);
    }

    return true;
  }

  public checkShardsReady(): void {
    if (this.status === Status.READY) return;
    if (this.shards.size !== this.totalShards || this.shards.some(s => s.status !== Status.READY)) {
      return;
    }

    this.triggerClientReady();
  }

  public triggerClientReady(): void {
    this.status = Status.READY;
    this.client.readyAt = new Date();
    this.client.emit(Events.CLIENT_READY, this.client);
    this.handlePacket();
  }
}

export default WebSocketManager;
