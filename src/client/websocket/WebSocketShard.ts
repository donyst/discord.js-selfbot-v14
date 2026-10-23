import EventEmitter from 'node:events';
import { setTimeout, setInterval, clearTimeout, clearInterval } from 'node:timers';
import type { MessageEvent as WSMessageEvent, ErrorEvent as WSErrorEvent } from 'ws';
import WebSocket from '../../WebSocket.js';
import { Status, Events, ShardEvents, Opcodes, WSEvents, WSCodes } from '../../util/Constants.js';
import Intents from '../../util/Intents.js';
import Util from '../../util/Util.js';
import type { WebSocketManager, GatewayPacket } from './WebSocketManager.js';

const STATUS_KEYS = Object.keys(Status);
const CONNECTION_STATE = ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'];

interface InflateInstance {
  push(data: Uint8Array | Buffer, flags?: number | boolean): void;
  result?: string | Buffer | Uint8Array;
}

interface ZlibSync {
  Inflate: new (opts: { chunkSize: number; flush: number; to: string }) => InflateInstance;
  Z_SYNC_FLUSH: number;
}

let zlib: ZlibSync | null = null;
try {
  const mod = (await import('zlib-sync')) as unknown as { default?: ZlibSync } & ZlibSync;
  zlib = mod.default ?? mod;
} catch {}

let zstdDecompress: ((buf: Uint8Array) => Uint8Array) | null = null;
try {
  const mod = (await import('fzstd' as string)) as unknown as { decompress?: (buf: Uint8Array) => Uint8Array };
  zstdDecompress = mod.decompress ?? null;
} catch {}

export interface WebSocketCloseEvent {
  code: number;
  reason?: string;
  wasClean?: boolean;
}

export interface DestroyOptions {
  closeCode?: number;
  reset?: boolean;
  emit?: boolean;
  log?: boolean;
}

export interface RateLimitState {
  queue: unknown[];
  total: number;
  remaining: number;
  time: number;
  timer: NodeJS.Timeout | null;
}

/**
 * Represents a Shard's WebSocket connection
 * @extends {EventEmitter}
 */
export class WebSocketShard extends EventEmitter {
  public manager: WebSocketManager;
  public id: number;
  private resumeURL: string | null;
  public status: number;
  public sequence: number;
  public closeSequence: number;
  public sessionId: string | null;
  public ping: number;
  private lastPingTimestamp: number;
  private lastHeartbeatAcked: boolean;
  private closeEmitted: boolean;
  private ratelimit: RateLimitState;
  public connection: import('ws').WebSocket | null;
  private inflate: InflateInstance | null;
  private compressionMode: 'zlib-stream' | 'zstd-stream' | 'none' = 'none';
  private helloTimeout: NodeJS.Timeout | null;
  private wsCloseTimeout: NodeJS.Timeout | null;
  public eventsAttached: boolean;
  private expectedGuilds: Set<string> | null;
  private readyTimeout: NodeJS.Timeout | null;
  private connectedAt: number;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  public constructor(manager: WebSocketManager, id: number) {
    super();

    this.manager = manager;
    this.id = id;
    this.resumeURL = null;
    this.status = Status.IDLE;
    this.sequence = -1;
    this.closeSequence = 0;
    this.sessionId = null;
    this.ping = -1;
    this.lastPingTimestamp = -1;
    this.lastHeartbeatAcked = true;
    this.closeEmitted = false;

    this.ratelimit = {
      queue: [],
      total: 120,
      remaining: 120,
      time: 60e3,
      timer: null,
    };

    this.connection = null;
    this.inflate = null;
    this.helloTimeout = null;
    this.wsCloseTimeout = null;
    this.eventsAttached = false;
    this.expectedGuilds = null;
    this.readyTimeout = null;
    this.connectedAt = 0;
  }

  public debug(message: string): void {
    this.manager.debug(message, this);
  }

  public connect(): Promise<void> {
    const { client } = this.manager;

    if (this.connection?.readyState === WebSocket.OPEN && this.status === Status.READY) {
      return Promise.resolve();
    }

    const gateway = this.resumeURL ?? this.manager.gateway;

    return new Promise((resolve, reject) => {
      const cleanup = (): void => {
        this.removeListener(ShardEvents.CLOSE, onClose);
        this.removeListener(ShardEvents.READY, onReady);
        this.removeListener(ShardEvents.RESUMED, onResumed);
        this.removeListener(ShardEvents.INVALID_SESSION, onInvalidOrDestroyed);
        this.removeListener(ShardEvents.DESTROYED, onInvalidOrDestroyed);
      };

      const onReady = (): void => {
        cleanup();
        resolve();
      };

      const onResumed = (): void => {
        cleanup();
        resolve();
      };

      const onClose = (event: WebSocketCloseEvent): void => {
        cleanup();
        reject(event);
      };

      const onInvalidOrDestroyed = (): void => {
        cleanup();
        reject(new Error('INVALID_OR_DESTROYED'));
      };

      this.once(ShardEvents.READY, onReady);
      this.once(ShardEvents.RESUMED, onResumed);
      this.once(ShardEvents.CLOSE, onClose);
      this.once(ShardEvents.INVALID_SESSION, onInvalidOrDestroyed);
      this.once(ShardEvents.DESTROYED, onInvalidOrDestroyed);

      if (this.connection?.readyState === WebSocket.OPEN) {
        this.debug('An open connection was found, attempting an immediate identify.');
        this.identify();
        return;
      }

      if (this.connection) {
        this.debug(`A connection object was found. Cleaning up before continuing.
    State: ${CONNECTION_STATE[this.connection.readyState]}`);
        this.destroy({ emit: false });
      }

      const wsQuery: Record<string, string | number> = { v: client.options.ws.version };

      if (client.options.ws.compress === 'zstd-stream' && zstdDecompress) {
        this.compressionMode = 'zstd-stream';
        wsQuery.compress = 'zstd-stream';
      } else if (zlib && client.options.ws.compress !== false) {
        this.compressionMode = 'zlib-stream';
        this.inflate = new zlib.Inflate({
          chunkSize: 65535,
          flush: zlib.Z_SYNC_FLUSH,
          to: WebSocket.encoding === 'json' ? 'string' : '',
        });
        wsQuery.compress = 'zlib-stream';
      } else {
        this.compressionMode = 'none';
      }

      this.debug(
        `[CONNECT]
    Gateway    : ${gateway}
    Version    : ${client.options.ws.version}
    Encoding   : ${WebSocket.encoding}
    Compression: ${this.compressionMode}
    Agent      : ${Util.verifyProxyAgent(client.options.ws.agent)}`,
      );

      this.status = this.status === Status.DISCONNECTED ? Status.RECONNECTING : Status.CONNECTING;
      this.setHelloTimeout();
      this.setWsCloseTimeout(-1);
      this.connectedAt = Date.now();

      const ws = (this.connection = WebSocket.create(gateway!, wsQuery as Record<string, string | number | boolean>, {
        handshakeTimeout: 30_000,
        agent: Util.verifyProxyAgent(client.options.ws.agent) ? client.options.ws.agent : undefined,
      }));
      ws.onopen = this.onOpen.bind(this);
      ws.onmessage = this.onMessage.bind(this);
      ws.onerror = this.onError.bind(this);
      ws.onclose = this.onClose.bind(this);
    });
  }

  private onOpen(): void {
    this.debug(`[CONNECTED] Took ${Date.now() - this.connectedAt}ms`);
    this.status = Status.NEARLY;
  }

  private onMessage({ data }: WSMessageEvent): void {
    let raw: string | ArrayBuffer | Buffer | Uint8Array;
    let byteData: Uint8Array;
    if (data instanceof ArrayBuffer) {
      byteData = new Uint8Array(data);
    } else if (Buffer.isBuffer(data)) {
      byteData = data;
    } else if (Array.isArray(data)) {
      byteData = Buffer.concat(data);
    } else if (typeof data === 'string') {
      byteData = Buffer.from(data);
    } else {
      byteData = data as Uint8Array;
    }

    if (this.compressionMode === 'zstd-stream' && zstdDecompress) {
      try {
        const decompressed = zstdDecompress(byteData);
        raw = Buffer.from(decompressed);
      } catch (err) {
        this.manager.client.emit(Events.SHARD_ERROR, err, this.id);
        return;
      }
    } else if (zlib && this.inflate && this.compressionMode === 'zlib-stream') {
      const l = byteData.length;
      const flush =
        l >= 4 && byteData[l - 4] === 0x00 && byteData[l - 3] === 0x00 && byteData[l - 2] === 0xff && byteData[l - 1] === 0xff;

      this.inflate.push(byteData, flush && zlib.Z_SYNC_FLUSH);
      if (!flush) return;
      raw = this.inflate.result as string | Buffer | Uint8Array;
    } else {
      raw = data as string | ArrayBuffer | Buffer | Uint8Array;
    }

    let packet: GatewayPacket;
    try {
      packet = WebSocket.unpack(raw) as GatewayPacket;
    } catch (err) {
      this.manager.client.emit(Events.SHARD_ERROR, err, this.id);
      return;
    }

    this.manager.client.emit(Events.RAW, packet, this.id);
    if (packet.op === Opcodes.DISPATCH && packet.t) {
      this.manager.emit(packet.t, packet.d, this.id);
    }
    this.onPacket(packet);
  }

  private onError(event: WSErrorEvent): void {
    const error = event?.error ?? event;
    if (!error) return;
    this.manager.client.emit(Events.SHARD_ERROR, error, this.id);
  }

  private onClose(event: WebSocketCloseEvent): void {
    this.closeEmitted = true;
    if (this.sequence !== -1) this.closeSequence = this.sequence;
    this.sequence = -1;
    this.setHeartbeatTimer(-1);
    this.setHelloTimeout(-1);
    this.setWsCloseTimeout(-1);

    if (this.connection) {
      this._cleanupConnection();
      this.destroy({ reset: !this.sessionId, emit: false, log: false });
    }
    this.status = Status.DISCONNECTED;
    this.emitClose(event);
  }

  public emitClose(
    event: WebSocketCloseEvent = {
      code: 1011,
      reason: (WSCodes as Record<number, string>)[1011],
      wasClean: false,
    },
  ): void {
    this.debug(`[CLOSE]
    Event Code: ${event.code}
    Clean     : ${event.wasClean}
    Reason    : ${event.reason ?? 'No reason received'}`);
    this.emit(ShardEvents.CLOSE, event);
  }

  private onPacket(packet?: GatewayPacket): void {
    if (!packet) {
      this.debug(`Received broken packet: '${packet}'.`);
      return;
    }

    switch (packet.t) {
      case WSEvents.READY: {
        this.emit(ShardEvents.READY);
        const d = packet.d as { resume_gateway_url?: string; session_id: string; guilds: Array<{ id: string; unavailable?: boolean }> };
        this.resumeURL = d.resume_gateway_url ?? null;
        this.sessionId = d.session_id;
        this.expectedGuilds = new Set(d.guilds.filter(g => g?.unavailable === true).map(g => g.id));
        this.status = Status.WAITING_FOR_GUILDS;
        this.debug(`[READY] Session ${this.sessionId} | Resume url ${this.resumeURL}.`);
        this.lastHeartbeatAcked = true;
        this.sendHeartbeat('ReadyHeartbeat');
        break;
      }
      case WSEvents.RESUMED: {
        this.emit(ShardEvents.RESUMED);
        this.status = Status.READY;
        const replayed = (packet.s ?? 0) - this.closeSequence;
        this.debug(`[RESUMED] Session ${this.sessionId} | Replayed ${replayed} events.`);
        this.lastHeartbeatAcked = true;
        this.sendHeartbeat('ResumeHeartbeat');
        break;
      }
    }

    if (typeof packet.s === 'number' && packet.s > this.sequence) {
      this.sequence = packet.s;
    }

    switch (packet.op) {
      case Opcodes.HELLO: {
        const d = packet.d as { heartbeat_interval: number };
        this.setHelloTimeout(-1);
        this.setHeartbeatTimer(d.heartbeat_interval);
        this.identify();
        break;
      }
      case Opcodes.RECONNECT:
        this.debug('[RECONNECT] Discord asked us to reconnect');
        this.destroy({ closeCode: 4_000 });
        break;
      case Opcodes.INVALID_SESSION:
        this.debug(`[INVALID SESSION] Resumable: ${packet.d}.`);
        if (packet.d) {
          this.identifyResume();
          return;
        }
        this.sequence = -1;
        this.sessionId = null;
        this.status = Status.RECONNECTING;
        this.emit(ShardEvents.INVALID_SESSION);
        break;
      case Opcodes.HEARTBEAT_ACK:
        this.ackHeartbeat();
        break;
      case Opcodes.HEARTBEAT:
        this.sendHeartbeat('HeartbeatRequest', true);
        break;
      default:
        this.manager.handlePacket(packet, this);
        if (this.status === Status.WAITING_FOR_GUILDS && packet.t === WSEvents.GUILD_CREATE) {
          const d = packet.d as { id: string };
          this.expectedGuilds?.delete(d.id);
          this.checkReady();
        }
    }
  }

  public checkReady(): void {
    if (this.readyTimeout) {
      clearTimeout(this.readyTimeout);
      this.readyTimeout = null;
    }
    if (!this.expectedGuilds?.size) {
      this.debug('Shard received all its guilds. Marking as fully ready.');
      this.status = Status.READY;
      this.emit(ShardEvents.ALL_READY);
      return;
    }
    const hasGuildsIntent = new Intents(this.manager.client.options.intents).has(Intents.FLAGS.GUILDS);
    const { waitGuildTimeout } = this.manager.client.options;

    this.readyTimeout = setTimeout(
      () => {
        this.debug(
          `Shard ${hasGuildsIntent ? 'did' : 'will'} not receive any more guild packets` +
            `${hasGuildsIntent ? ` in ${waitGuildTimeout} ms` : ''}.\nUnavailable guild count: ${
              this.expectedGuilds?.size
            }`,
        );

        this.readyTimeout = null;
        this.status = Status.READY;
        this.emit(ShardEvents.ALL_READY, this.expectedGuilds);
      },
      hasGuildsIntent ? waitGuildTimeout : 0,
    ).unref();
  }

  private setHelloTimeout(time?: number): void {
    if (time === -1) {
      if (this.helloTimeout) {
        this.debug('Clearing the HELLO timeout.');
        clearTimeout(this.helloTimeout);
        this.helloTimeout = null;
      }
      return;
    }
    this.debug('Setting a HELLO timeout for 20s.');
    this.helloTimeout = setTimeout(() => {
      this.debug('Did not receive HELLO in time. Destroying and connecting again.');
      this.destroy({ reset: true, closeCode: 4009 });
    }, 20_000).unref();
  }

  private setWsCloseTimeout(time?: number): void {
    if (this.wsCloseTimeout) {
      this.debug('[WebSocket] Clearing the close timeout.');
      clearTimeout(this.wsCloseTimeout);
    }
    if (time === -1 || time === undefined) {
      this.wsCloseTimeout = null;
      return;
    }
    this.wsCloseTimeout = setTimeout(() => {
      this.setWsCloseTimeout(-1);

      if (this.closeEmitted) {
        this.debug('[WebSocket] close was already emitted, assuming the connection was closed properly.');
        this.closeEmitted = false;
        return;
      }

      this.debug(
        `[WebSocket] Close Emitted: ${this.closeEmitted} | did not close properly, assuming a zombie connection.\nEmitting close and reconnecting again.`,
      );

      if (this.connection) this._cleanupConnection();

      this.emitClose({
        code: 4009,
        reason: 'Session time out.',
        wasClean: false,
      });
    }, time);
  }

  private setHeartbeatTimer(time: number): void {
    if (time === -1) {
      if (this.heartbeatInterval) {
        this.debug('Clearing the heartbeat interval.');
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = null;
      }
      return;
    }
    this.debug(`Setting a heartbeat interval for ${time}ms.`);
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    this.heartbeatInterval = setInterval(() => this.sendHeartbeat(), time).unref();
  }

  private sendHeartbeat(
    tag = 'HeartbeatTimer',
    ignoreHeartbeatAck = [Status.WAITING_FOR_GUILDS, Status.IDENTIFYING, Status.RESUMING].includes(this.status),
  ): void {
    if (ignoreHeartbeatAck && !this.lastHeartbeatAcked) {
      this.debug(`[${tag}] Didn't process heartbeat ack yet but we are still connected. Sending one now.`);
    } else if (!this.lastHeartbeatAcked) {
      this.debug(
        `[${tag}] Didn't receive a heartbeat ack last time, assuming zombie connection. Destroying and reconnecting.
    Status          : ${STATUS_KEYS[this.status]}
    Sequence        : ${this.sequence}
    Connection State: ${this.connection ? CONNECTION_STATE[this.connection.readyState] : 'No Connection??'}`,
      );
      this.destroy({ reset: true, closeCode: 4009 });
      return;
    }

    this.debug(`[${tag}] Sending a heartbeat.`);
    this.lastHeartbeatAcked = false;
    this.lastPingTimestamp = Date.now();
    this.send({ op: Opcodes.HEARTBEAT, d: this.sequence }, true);
  }

  private ackHeartbeat(): void {
    this.lastHeartbeatAcked = true;
    const latency = Date.now() - this.lastPingTimestamp;
    this.debug(`Heartbeat acknowledged, latency of ${latency}ms.`);
    this.ping = latency;
  }

  public identify(): void {
    if (this.sessionId) {
      this.identifyResume();
    } else {
      this.identifyNew();
    }
  }

  private identifyNew(): void {
    const { client } = this.manager;
    if (!client.token) {
      this.debug('[IDENTIFY] No token available to identify a new session.');
      return;
    }

    this.status = Status.IDENTIFYING;

    const props = client.options.ws.properties as Record<string, unknown>;
    Object.keys(props)
      .filter(k => k.startsWith('$'))
      .forEach(k => {
        props[k.slice(1)] = props[k];
        delete props[k];
      });

    const d: Record<string, unknown> = {
      ...client.options.ws,
      token: client.token,
    };

    delete d.version;
    delete d.agent;

    this.debug(`[IDENTIFY] Shard ${this.id}`);
    this.send({ op: Opcodes.IDENTIFY, d }, true);
  }

  private identifyResume(): void {
    if (!this.sessionId) {
      this.debug('[RESUME] No session id was present; identifying as a new session.');
      this.identifyNew();
      return;
    }

    this.status = Status.RESUMING;
    this.debug(`[RESUME] Session ${this.sessionId}, sequence ${this.closeSequence}`);

    const d = {
      token: this.manager.client.token,
      session_id: this.sessionId,
      seq: this.closeSequence,
    };

    this.send({ op: Opcodes.RESUME, d }, true);
  }

  public send(data: unknown, important = false): void {
    this.ratelimit.queue[important ? 'unshift' : 'push'](data);
    this.processQueue();
  }

  private _send(data: unknown): void {
    if (this.connection?.readyState !== WebSocket.OPEN) {
      this.debug(`Tried to send packet '${JSON.stringify(data)}' but no WebSocket is available!`);
      this.destroy({ closeCode: 4_000 });
      return;
    }

    this.debug(`[WebSocketShard] send packet '${JSON.stringify(data)}'`);
    this.connection.send(WebSocket.pack(data), (err?: globalThis.Error) => {
      if (err) this.manager.client.emit(Events.SHARD_ERROR, err, this.id);
    });
  }

  private processQueue(): void {
    if (this.ratelimit.remaining === 0) return;
    if (this.ratelimit.queue.length === 0) return;
    if (this.ratelimit.remaining === this.ratelimit.total) {
      this.ratelimit.timer = setTimeout(() => {
        this.ratelimit.remaining = this.ratelimit.total;
        this.processQueue();
      }, this.ratelimit.time).unref();
    }
    while (this.ratelimit.remaining > 0) {
      const item = this.ratelimit.queue.shift();
      if (!item) return;
      this._send(item);
      this.ratelimit.remaining--;
    }
  }

  public destroy({ closeCode = 1_000, reset = false, emit = true, log = true }: DestroyOptions = {}): void {
    if (log) {
      this.debug(`[DESTROY]
    Close Code    : ${closeCode}
    Reset         : ${reset}
    Emit DESTROYED: ${emit}`);
    }

    this.setHeartbeatTimer(-1);
    this.setHelloTimeout(-1);

    this.debug(
      `[WebSocket] Destroy: Attempting to close the WebSocket. | WS State: ${
        CONNECTION_STATE[this.connection?.readyState ?? WebSocket.CLOSED]
      }`,
    );

    if (this.connection) {
      if (this.connection.readyState === WebSocket.OPEN) {
        this.connection.close(closeCode);
        this.debug(`[WebSocket] Close: Tried closing. | WS State: ${CONNECTION_STATE[this.connection.readyState]}`);
      } else {
        this.debug(`WS State: ${CONNECTION_STATE[this.connection.readyState]}`);
        try {
          this.connection.close(closeCode);
        } catch (err: unknown) {
          const errObj = err as { message?: string };
          this.debug(
            `[WebSocket] Close: Something went wrong while closing the WebSocket: ${
              errObj?.message || err
            }. Forcefully terminating the connection | WS State: ${CONNECTION_STATE[this.connection.readyState]}`,
          );
          this.connection.terminate();
        }
        if (emit) this._emitDestroyed();
      }
    } else if (emit) {
      this._emitDestroyed();
    }

    this.debug(
      `[WebSocket] Adding a WebSocket close timeout to ensure a correct WS reconnect.
        Timeout: ${this.manager.client.options.closeTimeout}ms`,
    );
    this.setWsCloseTimeout(this.manager.client.options.closeTimeout);

    this.connection = null;
    this.status = Status.DISCONNECTED;

    if (this.sequence !== -1) this.closeSequence = this.sequence;

    if (reset) {
      this.resumeURL = null;
      this.sequence = -1;
      this.sessionId = null;
    }

    this.ratelimit.remaining = this.ratelimit.total;
    this.ratelimit.queue.length = 0;
    if (this.ratelimit.timer) {
      clearTimeout(this.ratelimit.timer);
      this.ratelimit.timer = null;
    }
  }

  private _cleanupConnection(): void {
    if (this.connection) {
      this.connection.onopen = this.connection.onclose = this.connection.onmessage = null as unknown as typeof this.connection.onopen;
      this.connection.onerror = (() => null) as unknown as typeof this.connection.onerror;
    }
  }

  private _emitDestroyed(): void {
    this.emit(ShardEvents.DESTROYED);
  }
}

export default WebSocketShard;
