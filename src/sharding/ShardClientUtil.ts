import process from 'node:process';
import { parentPort, type MessagePort } from 'node:worker_threads';
import type { Snowflake } from 'discord-api-types/v10';
import { DiscordjsError as Error, DiscordjsTypeError as TypeError } from '../errors/index.js';
import { Events } from '../util/Constants.js';
import Util from '../util/Util.js';
import type { Client } from '../client/Client.js';

export type ShardingManagerMode = 'process' | 'worker';

export interface BroadcastEvalOptions {
  shard?: number;
  context?: unknown;
}

export interface MultipleShardRespawnOptions {
  shardDelay?: number;
  respawnDelay?: number;
  timeout?: number;
}

/**
 * Helper class for sharded clients spawned as a child process/worker.
 */
export class ShardClientUtil {
  public client: Client;
  public mode: ShardingManagerMode;
  public parentPort: MessagePort | null = null;
  private static _singleton: ShardClientUtil | null = null;

  public constructor(client: Client, mode: ShardingManagerMode) {
    this.client = client;
    this.mode = mode;

    if (mode === 'process') {
      process.on('message', this._handleMessage.bind(this) as (...args: unknown[]) => void);
      client.on('ready', () => {
        if (process.send) process.send({ _ready: true });
      });
      client.on('disconnect', () => {
        if (process.send) process.send({ _disconnect: true });
      });
      client.on('reconnecting', () => {
        if (process.send) process.send({ _reconnecting: true });
      });
    } else if (mode === 'worker') {
      this.parentPort = parentPort;
      this.parentPort!.on('message', this._handleMessage.bind(this) as (...args: unknown[]) => void);
      client.on('ready', () => {
        this.parentPort!.postMessage({ _ready: true });
      });
      client.on('disconnect', () => {
        this.parentPort!.postMessage({ _disconnect: true });
      });
      client.on('reconnecting', () => {
        this.parentPort!.postMessage({ _reconnecting: true });
      });
    }
  }

  /**
   * Array of shard ids of this client
   */
  public get ids(): number[] {
    return (this.client.options as unknown as { shards: number[] }).shards;
  }

  /**
   * Total number of shards
   */
  public get count(): number {
    return (this.client.options as unknown as { shardCount: number }).shardCount;
  }

  /**
   * Sends a message to the master process.
   */
  public send(message: unknown): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (this.mode === 'process') {
        if (process.send) {
          process.send(message, (err: globalThis.Error | null) => {
            if (err) reject(err);
            else resolve();
          });
        } else {
          resolve();
        }
      } else if (this.mode === 'worker') {
        this.parentPort!.postMessage(message);
        resolve();
      }
    });
  }

  /**
   * Fetches a client property value of each shard, or a given shard.
   */
  public fetchClientValues<T = unknown>(prop: string, shard?: number): Promise<T | T[]> {
    return new Promise<T | T[]>((resolve, reject) => {
      const parent: NodeJS.EventEmitter = (this.parentPort ?? process) as unknown as NodeJS.EventEmitter;

      const listener = (message: Record<string, unknown> | null): void => {
        if (message?._sFetchProp !== prop || message._sFetchPropShard !== shard) return;
        parent.removeListener('message', listener as (...args: unknown[]) => void);
        this.decrementMaxListeners(parent);
        if (!message._error) resolve(message._result as T | T[]);
        else reject(Util.makeError(message._error as any));
      };

      this.incrementMaxListeners(parent);
      parent.on('message', listener as (...args: unknown[]) => void);

      this.send({ _sFetchProp: prop, _sFetchPropShard: shard }).catch((err) => {
        parent.removeListener('message', listener as (...args: unknown[]) => void);
        this.decrementMaxListeners(parent);
        reject(err);
      });
    });
  }

  /**
   * Evaluates a script or function on all shards, or a given shard, in the context of the Clients.
   */
  public broadcastEval<T = unknown>(
    script: ((client: Client, context?: unknown) => unknown) | string,
    options: BroadcastEvalOptions = {},
  ): Promise<T | T[]> {
    return new Promise<T | T[]>((resolve, reject) => {
      const parent: NodeJS.EventEmitter = (this.parentPort ?? process) as unknown as NodeJS.EventEmitter;
      if (typeof script !== 'function' && typeof script !== 'string') {
        reject(new TypeError('SHARDING_INVALID_EVAL_BROADCAST'));
        return;
      }
      const evalScript =
        typeof script === 'function'
          ? `(${script})(this, ${JSON.stringify(options.context)})`
          : script;

      const listener = (message: Record<string, unknown> | null): void => {
        if (message?._sEval !== evalScript || message._sEvalShard !== options.shard) return;
        parent.removeListener('message', listener as (...args: unknown[]) => void);
        this.decrementMaxListeners(parent);
        if (!message._error) resolve(message._result as T | T[]);
        else reject(Util.makeError(message._error as any));
      };

      this.incrementMaxListeners(parent);
      parent.on('message', listener as (...args: unknown[]) => void);

      this.send({ _sEval: evalScript, _sEvalShard: options.shard }).catch((err) => {
        parent.removeListener('message', listener as (...args: unknown[]) => void);
        this.decrementMaxListeners(parent);
        reject(err);
      });
    });
  }

  /**
   * Requests a respawn of all shards.
   */
  public respawnAll({
    shardDelay = 5_000,
    respawnDelay = 500,
    timeout = 30_000,
  }: MultipleShardRespawnOptions = {}): Promise<void> {
    return this.send({ _sRespawnAll: { shardDelay, respawnDelay, timeout } });
  }

  /**
   * Handles an IPC message.
   */
  public async _handleMessage(message: Record<string, unknown> | null): Promise<void> {
    if (!message) return;
    if (message._fetchProp) {
      try {
        const props = (message._fetchProp as string).split('.');
        let value: unknown = this.client;
        for (const prop of props) {
          value = (value as Record<string, unknown>)[prop];
        }
        this._respond('fetchProp', { _fetchProp: message._fetchProp, _result: value });
      } catch (err) {
        this._respond('fetchProp', { _fetchProp: message._fetchProp, _error: Util.makePlainError(err as Error) });
      }
    } else if (message._eval) {
      try {
        this._respond('eval', {
          _eval: message._eval,
          _result: await (this.client as any)._eval(message._eval as string),
        });
      } catch (err) {
        this._respond('eval', { _eval: message._eval, _error: Util.makePlainError(err as Error) });
      }
    }
  }

  /**
   * Sends a message to the master process, emitting an error from the client upon failure.
   */
  public _respond(type: string, message: unknown): void {
    this.send(message).catch((err: Error) => {
      const error = new Error(`Error when sending ${type} response to master process: ${err.message}`);
      error.stack = err.stack;
      this.client.emit(Events.ERROR, error);
    });
  }

  /**
   * Creates/gets the singleton of this class.
   */
  public static singleton(client: Client, mode: ShardingManagerMode): ShardClientUtil {
    if (!this._singleton) {
      this._singleton = new this(client, mode);
    } else {
      client.emit(
        Events.WARN,
        'Multiple clients created in child process/worker; only the first will handle sharding helpers.',
      );
    }
    return this._singleton;
  }

  /**
   * Get the shard id for a given guild id.
   */
  public static shardIdForGuildId(guildId: Snowflake, shardCount: number): number {
    const shard = Number(BigInt(guildId) >> 22n) % shardCount;
    if (shard < 0) throw new Error('SHARDING_SHARD_MISCALCULATION', shard, guildId, shardCount);
    return shard;
  }

  private incrementMaxListeners(emitter: NodeJS.EventEmitter): void {
    const maxListeners = emitter.getMaxListeners();
    if (maxListeners !== 0) {
      emitter.setMaxListeners(maxListeners + 1);
    }
  }

  private decrementMaxListeners(emitter: NodeJS.EventEmitter): void {
    const maxListeners = emitter.getMaxListeners();
    if (maxListeners !== 0) {
      emitter.setMaxListeners(maxListeners - 1);
    }
  }
}

export default ShardClientUtil;
