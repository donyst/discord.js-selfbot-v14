import childProcess, { type ChildProcess } from 'node:child_process';
import EventEmitter from 'node:events';
import path from 'node:path';
import process from 'node:process';
import { setTimeout, clearTimeout } from 'node:timers';
import { setTimeout as sleep } from 'node:timers/promises';
import { Worker } from 'node:worker_threads';
import { DiscordjsError as Error } from '../errors/index.js';
import Util from '../util/Util.js';
import type { ShardingManager } from './ShardingManager.js';

export interface ShardRespawnOptions {
  delay?: number;
  timeout?: number;
}



/**
 * A self-contained shard created by the {@link ShardingManager}.
 * @extends {EventEmitter}
 */
export class Shard extends EventEmitter {
  /**
   * Manager that created the shard
   */
  public manager: ShardingManager;

  /**
   * The shard's id in the manager
   */
  public id: number;

  /**
   * Arguments for the shard's process
   */
  public args: string[];

  /**
   * Arguments for the shard's process executable
   */
  public execArgv: string[];

  /**
   * Environment variables for the shard's process, or workerData for the shard's worker
   */
  public env: Record<string, unknown>;

  /**
   * Whether the shard's Client is ready
   */
  public ready: boolean = false;

  /**
   * Process of the shard (if mode is 'process')
   */
  public process: ChildProcess | null = null;

  /**
   * Worker of the shard (if mode is 'worker')
   */
  public worker: Worker | null = null;

  private _evals: Map<string, Promise<unknown>> = new Map();
  private _fetches: Map<string, Promise<unknown>> = new Map();
  private _exitListener: ((exitCode?: number) => void) | null = null;

  public constructor(manager: ShardingManager, id: number) {
    super();

    this.manager = manager;
    this.id = id;
    this.args = manager.shardArgs ?? [];
    this.execArgv = manager.execArgv ?? [];
    this.env = Object.assign({}, process.env, {
      SHARDING_MANAGER: true,
      SHARDS: this.id,
      SHARD_COUNT: this.manager.totalShards,
      DISCORD_TOKEN: this.manager.token,
    });
  }

  /**
   * Forks a child process or creates a worker thread for the shard.
   * @param timeout The amount in milliseconds to wait until the Client has become ready
   */
  public spawn(timeout: number = 30_000): Promise<ChildProcess | Worker> {
    if (this.process) throw new Error('SHARDING_PROCESS_EXISTS', this.id);
    if (this.worker) throw new Error('SHARDING_WORKER_EXISTS', this.id);

    this._exitListener = this._handleExit.bind(this, undefined, timeout);

    if (this.manager.mode === 'process') {
      this.process = childProcess
        .fork(path.resolve(this.manager.file), this.args, {
          env: this.env as NodeJS.ProcessEnv,
          execArgv: this.execArgv,
        })
        .on('message', this._handleMessage.bind(this))
        .on('exit', this._exitListener as (...args: unknown[]) => void);
    } else if (this.manager.mode === 'worker') {
      this.worker = new Worker(path.resolve(this.manager.file), { workerData: this.env })
        .on('message', this._handleMessage.bind(this))
        .on('exit', this._exitListener as (...args: unknown[]) => void);
    }

    this._evals.clear();
    this._fetches.clear();

    const child = (this.process ?? this.worker)!;
    this.emit('spawn', child);

    if (timeout === -1 || timeout === Infinity) return Promise.resolve(child);
    return new Promise<ChildProcess | Worker>((resolve, reject) => {
      let spawnTimeoutTimer: NodeJS.Timeout;

      const cleanup = (): void => {
        clearTimeout(spawnTimeoutTimer);
        this.off('ready', onReady);
        this.off('disconnect', onDisconnect);
        this.off('death', onDeath);
      };

      const onReady = (): void => {
        cleanup();
        resolve(child);
      };

      const onDisconnect = (): void => {
        cleanup();
        reject(new Error('SHARDING_READY_DISCONNECTED', this.id));
      };

      const onDeath = (): void => {
        cleanup();
        reject(new Error('SHARDING_READY_DIED', this.id));
      };

      const onTimeout = (): void => {
        cleanup();
        reject(new Error('SHARDING_READY_TIMEOUT', this.id));
      };

      spawnTimeoutTimer = setTimeout(onTimeout, timeout);
      this.once('ready', onReady);
      this.once('disconnect', onDisconnect);
      this.once('death', onDeath);
    });
  }

  /**
   * Immediately kills the shard's process/worker and does not restart it.
   */
  public kill(): void {
    if (this.process) {
      if (this._exitListener) this.process.removeListener('exit', this._exitListener as (...args: unknown[]) => void);
      this.process.kill();
    } else if (this.worker) {
      if (this._exitListener) this.worker.removeListener('exit', this._exitListener as (...args: unknown[]) => void);
      this.worker.terminate();
    }

    this._handleExit(false);
  }

  /**
   * Kills and restarts the shard's process/worker.
   */
  public async respawn({ delay = 500, timeout = 30_000 }: ShardRespawnOptions = {}): Promise<ChildProcess | Worker> {
    this.kill();
    if (delay > 0) await sleep(delay);
    return this.spawn(timeout);
  }

  /**
   * Sends a message to the shard's process/worker.
   */
  public send(message: unknown): Promise<this> {
    return new Promise<this>((resolve, reject) => {
      if (this.process) {
        this.process.send(message as any, (err) => {
          if (err) reject(err);
          else resolve(this);
        });
      } else if (this.worker) {
        this.worker.postMessage(message);
        resolve(this);
      }
    });
  }

  /**
   * Fetches a client property value of the shard.
   */
  public async fetchClientValue<T = unknown>(prop: string): Promise<T> {
    if (!this.process && !this.worker) throw new Error('SHARDING_NO_CHILD_EXISTS', this.id);

    if (this._fetches.has(prop)) return this._fetches.get(prop) as Promise<T>;

    const promise = new Promise<T>((resolve, reject) => {
      const child = (this.process ?? this.worker)!;

      const listener = (message: Record<string, unknown> | null): void => {
        if (message?._fetchProp !== prop) return;
        child.removeListener('message', listener as (...args: unknown[]) => void);
        this.decrementMaxListeners(child as unknown as EventEmitter);
        this._fetches.delete(prop);
        if (!message._error) resolve(message._result as T);
        else reject(Util.makeError(message._error as any));
      };

      this.incrementMaxListeners(child as unknown as EventEmitter);
      child.on('message', listener as (...args: unknown[]) => void);

      this.send({ _fetchProp: prop }).catch((err) => {
        child.removeListener('message', listener as (...args: unknown[]) => void);
        this.decrementMaxListeners(child as unknown as EventEmitter);
        this._fetches.delete(prop);
        reject(err);
      });
    });

    this._fetches.set(prop, promise);
    return promise;
  }

  /**
   * Evaluates a script or function on the shard, in the context of the Client.
   */
  public async eval<T = unknown>(script: string | ((...args: unknown[]) => unknown), context?: unknown): Promise<T> {
    const _eval = typeof script === 'function' ? `(${script})(this, ${JSON.stringify(context)})` : script;

    if (!this.process && !this.worker) throw new Error('SHARDING_NO_CHILD_EXISTS', this.id);

    if (this._evals.has(_eval)) return this._evals.get(_eval) as Promise<T>;

    const promise = new Promise<T>((resolve, reject) => {
      const child = (this.process ?? this.worker)!;

      const listener = (message: Record<string, unknown> | null): void => {
        if (message?._eval !== _eval) return;
        child.removeListener('message', listener as (...args: unknown[]) => void);
        this.decrementMaxListeners(child as unknown as EventEmitter);
        this._evals.delete(_eval);
        if (!message._error) resolve(message._result as T);
        else reject(Util.makeError(message._error as any));
      };

      this.incrementMaxListeners(child as unknown as EventEmitter);
      child.on('message', listener as (...args: unknown[]) => void);

      this.send({ _eval }).catch((err) => {
        child.removeListener('message', listener as (...args: unknown[]) => void);
        this.decrementMaxListeners(child as unknown as EventEmitter);
        this._evals.delete(_eval);
        reject(err);
      });
    });

    this._evals.set(_eval, promise);
    return promise;
  }

  /**
   * Handles a message received from the child process/worker.
   */
  public _handleMessage(message: Record<string, unknown> | null): void {
    if (message) {
      if (message._ready) {
        this.ready = true;
        this.emit('ready');
        return;
      }

      if (message._disconnect) {
        this.ready = false;
        this.emit('disconnect');
        return;
      }

      if (message._reconnecting) {
        this.ready = false;
        this.emit('reconnecting');
        return;
      }

      if (message._sFetchProp) {
        const resp = { _sFetchProp: message._sFetchProp, _sFetchPropShard: message._sFetchPropShard };
        this.manager.fetchClientValues(message._sFetchProp as string, message._sFetchPropShard as number | undefined).then(
          (results) => this.send({ ...resp, _result: results }),
          (err) => this.send({ ...resp, _error: Util.makePlainError(err) }),
        );
        return;
      }

      if (message._sEval) {
        const resp = { _sEval: message._sEval, _sEvalShard: message._sEvalShard };
        this.manager._performOnShards('eval', [message._sEval], message._sEvalShard as number | undefined).then(
          (results) => this.send({ ...resp, _result: results }),
          (err) => this.send({ ...resp, _error: Util.makePlainError(err) }),
        );
        return;
      }

      if (message._sRespawnAll) {
        const { shardDelay, respawnDelay, timeout } = message._sRespawnAll as {
          shardDelay?: number;
          respawnDelay?: number;
          timeout?: number;
        };
        this.manager.respawnAll({ shardDelay, respawnDelay, timeout }).catch(() => {
          // Do nothing
        });
        return;
      }
    }

    this.emit('message', message);
  }

  /**
   * Handles the shard's process/worker exiting.
   */
  public _handleExit(respawn: boolean = this.manager.respawn, timeout?: number): void {
    this.emit('death', this.process ?? this.worker);

    this.ready = false;
    this.process = null;
    this.worker = null;
    this._evals.clear();
    this._fetches.clear();

    if (respawn) this.spawn(timeout).catch((err) => this.emit('error', err));
  }

  private incrementMaxListeners(emitter: EventEmitter): void {
    const maxListeners = emitter.getMaxListeners();
    if (maxListeners !== 0) {
      emitter.setMaxListeners(maxListeners + 1);
    }
  }

  private decrementMaxListeners(emitter: EventEmitter): void {
    const maxListeners = emitter.getMaxListeners();
    if (maxListeners !== 0) {
      emitter.setMaxListeners(maxListeners - 1);
    }
  }
}

export default Shard;
