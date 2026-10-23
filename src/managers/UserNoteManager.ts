import { Collection } from '@discordjs/collection';
import { BaseManager } from './BaseManager.js';
import type { Snowflake, UserResolvable, BaseFetchOptions } from '../types/index.js';
import type { Client } from '../client/Client.js';

/**
 * Manages API methods for Client and stores their cache.
 * @extends {BaseManager}
 */
export class UserNoteManager extends BaseManager {
  /**
   * Cache User Note
   */
  public cache: Collection<Snowflake, string>;

  public constructor(client: Client, data: Record<string, string> = {}) {
    super(client);
    this.cache = new Collection(Object.entries(data));
  }

  public _reload(data: Record<string, string> = {}): this {
    this.cache = new Collection(Object.entries(data));
    return this;
  }

  public async updateNote(id: Snowflake, note: string | null = null): Promise<this> {
    const api = this.client.api as unknown as {
      users: {
        ['@me']: {
          notes(userId: Snowflake): {
            put(opts: { data: { note: string | null } }): Promise<void>;
          };
        };
      };
    };

    await api.users['@me'].notes(id).put({ data: { note } });
    if (!note) this.cache.delete(id);
    else this.cache.set(id, note);
    return this;
  }

  /**
   * Obtains a user note from Discord, or the note cache if it's already available.
   */
  public async fetch(
    user: UserResolvable,
    { cache = true, force = false }: BaseFetchOptions = {},
  ): Promise<string> {
    const users = this.client.users as unknown as { resolveId(u: unknown): Snowflake | null };
    const id = users.resolveId(user);
    if (!id) throw new Error('User resolve id failed');

    if (!force) {
      const existing = this.cache.get(id);
      if (existing) return existing;
    }

    const api = this.client.api as unknown as {
      users: {
        ['@me']: {
          notes: Record<
            string,
            {
              get(): Promise<{ note: string }>;
            }
          >;
        };
      };
    };

    const data = await api.users['@me'].notes[id]
      .get()
      .then(d => d.note)
      .catch(() => '');

    if (cache) this.cache.set(id, data);
    return data;
  }
}

export default UserNoteManager;
