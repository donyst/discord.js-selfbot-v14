import EventEmitter from 'node:events';
import { Collection } from '@discordjs/collection';
import { DiscordjsTypeError } from '../../errors/index.js';
import { Util } from '../../util/Util.js';
import type { Awaitable } from '../../types/index.js';

export type CollectorFilter<T extends unknown[]> = (...args: [...T, Collection<unknown, unknown>]) => Awaitable<boolean>;

export interface CollectorOptions<T extends unknown[]> {
  filter?: CollectorFilter<T>;
  time?: number;
  idle?: number;
  dispose?: boolean;
}

export interface CollectorResetTimerOptions {
  time?: number;
  idle?: number;
}

export interface CollectorEventTypes<K, V, F extends unknown[]> {
  collect: [V, ...F];
  dispose: [V, ...F];
  end: [Collection<K, V>, string];
}

/**
 * Abstract class for defining a new Collector.
 */
export abstract class Collector<K, V, F extends unknown[] = []> extends EventEmitter {
  public readonly client: unknown;
  public filter: CollectorFilter<[V, ...F]>;
  public options: CollectorOptions<[V, ...F]>;
  public collected: Collection<K, V>;
  public ended: boolean;

  private _timeout: NodeJS.Timeout | null;
  private _idletimeout: NodeJS.Timeout | null;

  public abstract readonly endReason: string | null;

  protected constructor(client: unknown, options: CollectorOptions<[V, ...F]> = {}) {
    super();

    Object.defineProperty(this, 'client', { value: client });

    this.filter = options.filter ?? (() => true);
    this.options = options;
    this.collected = new Collection<K, V>();
    this.ended = false;

    this._timeout = null;
    this._idletimeout = null;

    if (typeof this.filter !== 'function') {
      throw new DiscordjsTypeError('INVALID_TYPE', 'options.filter', 'function');
    }

    this.handleCollect = this.handleCollect.bind(this);
    this.handleDispose = this.handleDispose.bind(this);

    if (options.time) this._timeout = setTimeout(() => this.stop('time'), options.time).unref();
    if (options.idle) this._idletimeout = setTimeout(() => this.stop('idle'), options.idle).unref();
  }

  public abstract collect(...args: unknown[]): Awaitable<K | null | undefined>;
  public abstract dispose(...args: unknown[]): K | null | undefined;

  public async handleCollect(...args: unknown[]): Promise<void> {
    const collectKey = await this.collect(...args);

    if (collectKey) {
      const filterArgs = [...args, this.collected] as unknown as [V, ...F, Collection<unknown, unknown>];
      if (await this.filter(...filterArgs)) {
        this.collected.set(collectKey, args[0] as V);
        this.emit('collect', ...args);

        if (this._idletimeout) {
          clearTimeout(this._idletimeout);
          this._idletimeout = setTimeout(() => this.stop('idle'), this.options.idle).unref();
        }
      }
    }
    this.checkEnd();
  }

  public async handleDispose(...args: unknown[]): Promise<void> {
    if (!this.options.dispose) return;

    const disposeKey = this.dispose(...args);
    if (!disposeKey || !this.collected.has(disposeKey)) return;

    const filterArgs = [...args, this.collected] as unknown as [V, ...F, Collection<unknown, unknown>];
    if (!(await this.filter(...filterArgs))) return;

    this.collected.delete(disposeKey);
    this.emit('dispose', ...args);
    this.checkEnd();
  }

  public get next(): Promise<V> {
    return new Promise<V>((resolve, reject) => {
      if (this.ended) {
        reject(this.collected);
        return;
      }

      const cleanup = (): void => {
        this.removeListener('collect', onCollect);
        this.removeListener('end', onEnd);
      };

      const onCollect = (item: V): void => {
        cleanup();
        resolve(item);
      };

      const onEnd = (): void => {
        cleanup();
        reject(this.collected);
      };

      this.on('collect', onCollect);
      this.on('end', onEnd);
    });
  }

  public stop(reason = 'user'): void {
    if (this.ended) return;

    if (this._timeout) {
      clearTimeout(this._timeout);
      this._timeout = null;
    }
    if (this._idletimeout) {
      clearTimeout(this._idletimeout);
      this._idletimeout = null;
    }
    this.ended = true;

    this.emit('end', this.collected, reason);
  }

  public resetTimer({ time, idle }: CollectorResetTimerOptions = {}): void {
    if (this._timeout) {
      clearTimeout(this._timeout);
      this._timeout = setTimeout(() => this.stop('time'), time ?? this.options.time).unref();
    }
    if (this._idletimeout) {
      clearTimeout(this._idletimeout);
      this._idletimeout = setTimeout(() => this.stop('idle'), idle ?? this.options.idle).unref();
    }
  }

  public checkEnd(): boolean {
    const reason = this.endReason;
    if (reason) this.stop(reason);
    return Boolean(reason);
  }

  public async *[Symbol.asyncIterator](): AsyncIterableIterator<V> {
    const queue: V[] = [];
    const onCollect = (item: V): number => queue.push(item);
    this.on('collect', onCollect);

    try {
      while (queue.length || !this.ended) {
        if (queue.length) {
          yield queue.shift()!;
        } else {
          await new Promise<void>(resolve => {
            const tick = (): void => {
              this.removeListener('collect', tick);
              this.removeListener('end', tick);
              resolve();
            };
            this.on('collect', tick);
            this.on('end', tick);
          });
        }
      }
    } finally {
      this.removeListener('collect', onCollect);
    }
  }

  public toJSON(): unknown {
    return Util.flatten(this);
  }
}

export default Collector;
