import { Collection } from '@discordjs/collection';
import { DataManager } from './DataManager.js';
import { _cleanupSymbol } from '../util/Constants.js';
import type { Constructable } from '../types/index.js';
import type { Client } from '../client/Client.js';

export interface FinalizerRegistrationContext {
  cleanup: () => void;
  message: string;
  name: string;
}

export interface CachedManagerClient {
  options: {
    makeCache: (managerCtor: unknown, holds: unknown) => Collection<unknown, unknown>;
  };
  _cleanups: Set<() => void>;
  _finalizers: {
    register: (target: object, heldValue: FinalizerRegistrationContext) => void;
  };
}

/**
 * Manages the API methods of a data model with a mutable cache of instances.
 */
export abstract class CachedManager<K, Holds, R> extends DataManager<K, Holds, R> {
  public readonly _cache: Collection<K, Holds>;

  public constructor(client: Client, holds: Constructable<Holds>, iterable?: Iterable<Holds>) {
    super(client, holds);

    const cli = client as unknown as CachedManagerClient;
    const cache = (cli.options?.makeCache ? cli.options.makeCache(this.constructor, this.holds) : new Collection()) as Collection<K, Holds>;
    Object.defineProperty(this, '_cache', { value: cache });

    const cleanupFn = (this._cache as unknown as { [_cleanupSymbol]?: () => (() => void) | null })[_cleanupSymbol]?.();
    if (cleanupFn) {
      const boundCleanup = cleanupFn.bind(this._cache);
      cli._cleanups?.add(boundCleanup);
      cli._finalizers?.register(this, {
        cleanup: boundCleanup,
        message:
          `Garbage collection completed on ${this.constructor.name}, ` +
          `which had a ${this._cache.constructor.name} of ${(this.holds as { name?: string }).name ?? 'unknown'}.`,
        name: this.constructor.name,
      });
    }

    if (iterable) {
      for (const item of iterable) {
        this._add(item);
      }
    }
  }

  public override get cache(): Collection<K, Holds> {
    return this._cache;
  }

  public _add(
    data: unknown,
    cache = true,
    { id, extras = [] }: { id?: K; extras?: unknown[] } = {},
  ): Holds {
    const dataObj = data as { id?: K; _patch?: (d: unknown) => void; _clone?: () => Holds };
    const entryId = id ?? dataObj?.id;
    const existing = entryId ? this.cache.get(entryId) : undefined;
    if (existing) {
      if (cache) {
        (existing as unknown as { _patch?: (d: unknown) => void })?._patch?.(data);
        return existing;
      }
      const clone = (existing as unknown as { _clone?: () => Holds })?._clone?.() ?? existing;
      (clone as unknown as { _patch?: (d: unknown) => void })?._patch?.(data);
      return clone;
    }

    const entry = this.holds
      ? new (this.holds as unknown as new (client: unknown, data: unknown, ...extras: unknown[]) => Holds)(
          this.client,
          data,
          ...extras,
        )
      : (data as Holds);

    if (cache) {
      const targetId = id ?? (entry as unknown as { id: K }).id;
      if (targetId) this.cache.set(targetId, entry);
    }
    return entry;
  }
}

export default CachedManager;
