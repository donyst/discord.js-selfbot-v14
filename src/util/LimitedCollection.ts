import { Collection } from '@discordjs/collection';
import { _cleanupSymbol } from './Constants.js';
import { Sweepers } from './Sweepers.js';
import type { LifetimeFilterOptions, GlobalSweepFilter } from './Sweepers.js';
import { DiscordjsTypeError } from '../errors/index.js';

export type SweepFilter<K, V> = (
  collection: LimitedCollection<K, V>,
) => ((value: V, key: K, collection: Collection<K, V>) => boolean) | null;

export interface LimitedCollectionOptions<K, V> {
  maxSize?: number;
  keepOverLimit?: ((value: V, key: K, collection: LimitedCollection<K, V>) => boolean) | null;
  sweepFilter?: SweepFilter<K, V> | null;
  sweepInterval?: number;
}

/**
 * A Collection which holds a max amount of entries and sweeps periodically.
 */
export class LimitedCollection<K, V> extends Collection<K, V> {
  public maxSize: number;
  public keepOverLimit: ((value: V, key: K, collection: LimitedCollection<K, V>) => boolean) | null;
  public sweepFilter: SweepFilter<K, V> | null;
  public interval: NodeJS.Timeout | null;

  public constructor(options: LimitedCollectionOptions<K, V> = {}, iterable?: Iterable<readonly [K, V]>) {
    if (typeof options !== 'object' || options === null) {
      throw new DiscordjsTypeError('INVALID_TYPE', 'options', 'object', true);
    }
    const { maxSize = Infinity, keepOverLimit = null, sweepInterval = 0, sweepFilter = null } = options;

    if (typeof maxSize !== 'number') {
      throw new DiscordjsTypeError('INVALID_TYPE', 'maxSize', 'number');
    }
    if (keepOverLimit !== null && typeof keepOverLimit !== 'function') {
      throw new DiscordjsTypeError('INVALID_TYPE', 'keepOverLimit', 'function');
    }
    if (typeof sweepInterval !== 'number') {
      throw new DiscordjsTypeError('INVALID_TYPE', 'sweepInterval', 'number');
    }
    if (sweepFilter !== null && typeof sweepFilter !== 'function') {
      throw new DiscordjsTypeError('INVALID_TYPE', 'sweepFilter', 'function');
    }

    super(iterable);

    this.maxSize = maxSize;
    this.keepOverLimit = keepOverLimit;
    this.sweepFilter = sweepFilter;

    this.interval =
      sweepInterval > 0 && sweepInterval !== Infinity && sweepFilter
        ? setInterval(() => {
            const sweepFn = this.sweepFilter?.(this);
            if (sweepFn === null || sweepFn === undefined) return;
            if (typeof sweepFn !== 'function') throw new DiscordjsTypeError('SWEEP_FILTER_RETURN');
            this.sweep(sweepFn);
          }, sweepInterval * 1_000).unref()
        : null;
  }

  public override set(key: K, value: V): this {
    if (this.maxSize === 0) return this;
    if (this.size >= this.maxSize && !this.has(key)) {
      for (const [k, v] of this.entries()) {
        const keep = this.keepOverLimit?.(v, k, this) ?? false;
        if (!keep) {
          this.delete(k);
          break;
        }
      }
    }
    return super.set(key, value);
  }

  public static filterByLifetime<K, V>(options?: LifetimeFilterOptions<K, V>): GlobalSweepFilter<K, V> {
    return Sweepers.filterByLifetime(options);
  }

  public [_cleanupSymbol](): (() => void) | null {
    return this.interval ? () => clearInterval(this.interval!) : null;
  }

  public static override get [Symbol.species](): typeof Collection {
    return Collection;
  }
}

export default LimitedCollection;
