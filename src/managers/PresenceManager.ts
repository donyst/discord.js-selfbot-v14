import { CachedManager } from './CachedManager.js';
import { Presence, type RawPresenceData } from '../structures/Presence.js';
import type { Snowflake, UserResolvable } from '../types/index.js';
import type { Client } from '../client/Client.js';
import type { Collection } from '@discordjs/collection';

export type PresenceResolvable = Presence | UserResolvable | Snowflake;

/**
 * Manages API methods for Presences and holds their cache.
 * @extends {CachedManager}
 */
export class PresenceManager extends CachedManager<Snowflake, Presence, PresenceResolvable> {
  public constructor(client: Client, iterable?: Iterable<Presence>) {
    super(client, Presence, iterable);
  }

  public override _add(data: RawPresenceData, cache?: boolean): Presence {
    const userId = (data.user as { id: Snowflake }).id;
    return super._add(data, cache, { id: userId });
  }

  /**
   * Resolves a {@link PresenceResolvable} to a {@link Presence} object.
   */
  public override resolve(idOrInstance: Presence): Presence;
  public override resolve(idOrInstance: PresenceResolvable): Presence | null;
  public override resolve(presence: unknown): Presence | null {
    const presenceResolvable = super.resolve(presence as Presence);
    if (presenceResolvable) return presenceResolvable;
    const users = this.client.users as unknown as { resolveId(u: unknown): Snowflake | null };
    const userId = users.resolveId(presence);
    return userId ? this.cache.get(userId) ?? null : null;
  }

  /**
   * Resolves a {@link PresenceResolvable} to a {@link Presence} id.
   */
  public override resolveId(idOrInstance: Snowflake | Presence): Snowflake;
  public override resolveId(idOrInstance: PresenceResolvable): Snowflake | null;
  public override resolveId(presence: unknown): Snowflake | null {
    const presenceResolvable = super.resolveId(presence as Presence);
    if (presenceResolvable) return presenceResolvable;
    const users = this.client.users as unknown as { resolveId(u: unknown): Snowflake | null };
    const userId = users.resolveId(presence);
    return userId && this.cache.has(userId) ? userId : null;
  }

  /**
   * Fetches the overall user presence for all of the user's non-offline friends and implicit relationships.
   */
  public async fetch(): Promise<Collection<Snowflake, Presence>> {
    const api = this.client.api as unknown as {
      presences: {
        get(): Promise<{ presences: RawPresenceData[] }>;
      };
    };

    const data = await api.presences.get();
    data.presences.forEach(presence => {
      this._add(presence, true);
    });
    return this.cache;
  }
}

export default PresenceManager;
