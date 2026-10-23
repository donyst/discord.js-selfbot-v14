import { Collection } from '@discordjs/collection';
import { BaseManager } from './BaseManager.js';
import { DiscordjsError } from '../errors/index.js';
import type { Constructable } from '../types/index.js';
import type { Client } from '../client/Client.js';

/**
 * Manages the API methods of a data model along with a collection of instances.
 */
export abstract class DataManager<K, Holds, R> extends BaseManager {
  public readonly holds: Constructable<Holds>;

  public constructor(client: Client, holds: Constructable<Holds>) {
    super(client);
    Object.defineProperty(this, 'holds', { value: holds });
  }

  /**
   * The cache of items for this manager.
   */
  public get cache(): Collection<K, Holds> {
    throw new DiscordjsError('NOT_IMPLEMENTED', 'get cache', this.constructor.name);
  }

  /**
   * Resolves a data entry to a data Object.
   */
  public resolve(idOrInstance: Holds): Holds;
  public resolve(idOrInstance: R): Holds | null;
  public resolve(idOrInstance: unknown): Holds | null {
    if (idOrInstance instanceof (this.holds as unknown as new (...args: unknown[]) => Holds)) {
      return idOrInstance;
    }
    if (typeof idOrInstance === 'string') {
      return this.cache.get(idOrInstance as unknown as K) ?? null;
    }
    return null;
  }

  /**
   * Resolves a data entry to an instance id.
   */
  public resolveId(idOrInstance: K | Holds): K;
  public resolveId(idOrInstance: R): K | null;
  public resolveId(idOrInstance: unknown): K | null {
    if (idOrInstance instanceof (this.holds as unknown as new (...args: unknown[]) => Holds)) {
      return (idOrInstance as unknown as { id: K }).id;
    }
    if (typeof idOrInstance === 'string') {
      return idOrInstance as unknown as K;
    }
    return null;
  }

  public valueOf(): Collection<K, Holds> {
    return this.cache;
  }
}

export default DataManager;
