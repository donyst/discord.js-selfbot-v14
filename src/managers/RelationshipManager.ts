import { Collection } from '@discordjs/collection';
import { BaseManager } from './BaseManager.js';
import { GuildMember } from '../structures/GuildMember.js';
import { Message } from '../structures/Message.js';
import ThreadMember from '../structures/ThreadMember.js';
import User from '../structures/User.js';
import { RelationshipTypes } from '../util/Constants.js';
import type { Snowflake, UserResolvable, BaseFetchOptions } from '../types/index.js';
import type { Client } from '../client/Client.js';

export interface RawRelationshipData {
  id: Snowflake;
  type: number;
  nickname?: string | null;
  since?: string | number;
  [key: string]: unknown;
}

export interface RelationshipJSONData {
  id: Snowflake;
  type: string;
  nickname?: string | null;
  since: string;
}

/**
 * Manages API methods for Relationships and stores their cache.
 */
export class RelationshipManager extends BaseManager {
  /**
   * A collection of users this manager is caching.
   */
  public cache: Collection<Snowflake, number>;

  public friendNicknames: Collection<Snowflake, string | null>;
  public sinceCache: Collection<Snowflake, Date>;

  public constructor(client: Client, users?: RawRelationshipData[]) {
    super(client);
    this.cache = new Collection();
    this.friendNicknames = new Collection();
    this.sinceCache = new Collection();
    if (users) {
      this._setup(users);
    }
  }

  /**
   * Get all friends
   */
  public get friendCache(): Collection<Snowflake, User | undefined> {
    const users = this.cache
      .filter(value => value === RelationshipTypes.FRIEND)
      .map((_, key) => [key, this.client.users.cache.get(key)] as [Snowflake, User | undefined]);
    return new Collection(users);
  }

  /**
   * Get all blocked users
   */
  public get blockedCache(): Collection<Snowflake, User | undefined> {
    const users = this.cache
      .filter(value => value === RelationshipTypes.BLOCKED)
      .map((_, key) => [key, this.client.users.cache.get(key)] as [Snowflake, User | undefined]);
    return new Collection(users);
  }

  /**
   * Get all incoming friend requests
   */
  public get incomingCache(): Collection<Snowflake, User | undefined> {
    const users = this.cache
      .filter(value => value === RelationshipTypes.PENDING_INCOMING)
      .map((_, key) => [key, this.client.users.cache.get(key)] as [Snowflake, User | undefined]);
    return new Collection(users);
  }

  /**
   * Get all outgoing friend requests
   */
  public get outgoingCache(): Collection<Snowflake, User | undefined> {
    const users = this.cache
      .filter(value => value === RelationshipTypes.PENDING_OUTGOING)
      .map((_, key) => [key, this.client.users.cache.get(key)] as [Snowflake, User | undefined]);
    return new Collection(users);
  }

  /**
   * Return array of cache
   */
  public toJSON(): RelationshipJSONData[] {
    return this.cache.map((value, key) => ({
      id: key,
      type: (RelationshipTypes as Record<number, string>)[value] ?? String(value),
      nickname: this.friendNicknames.get(key),
      since: this.sinceCache.get(key)?.toISOString() ?? new Date(0).toISOString(),
    }));
  }

  /**
   * Sets up relationship cache
   * @private
   */
  public _setup(users: RawRelationshipData[]): void {
    if (!Array.isArray(users)) return;
    for (const relationShip of users) {
      this.friendNicknames.set(relationShip.id, relationShip.nickname ?? null);
      this.cache.set(relationShip.id, relationShip.type);
      this.sinceCache.set(relationShip.id, new Date(relationShip.since || 0));
    }
  }

  /**
   * Resolves a {@link UserResolvable} to a {@link User} id.
   */
  public resolveId(user: UserResolvable | unknown): Snowflake | null {
    if (user instanceof ThreadMember) return user.id;
    if (user instanceof GuildMember) return user.user.id;
    if (user instanceof Message) return user.author?.id ?? null;
    if (user instanceof User) return user.id;
    if (typeof user === 'string') {
      return user.match(/\d{17,19}/)?.[0] || null;
    }
    return null;
  }

  /**
   * Resolves a {@link UserResolvable} to a {@link User} username.
   */
  public resolveUsername(user: UserResolvable | unknown): string | null {
    if (user instanceof ThreadMember) {
      return (user as unknown as { member?: { user?: { username?: string } } }).member?.user?.username ?? null;
    }
    if (user instanceof GuildMember) return user.user.username;
    if (user instanceof Message) return user.author?.username ?? null;
    if (user instanceof User) return user.username;
    return typeof user === 'string' ? user : null;
  }

  /**
   * Obtains relationships from Discord, or the relationship cache if already available.
   */
  public fetch(user: UserResolvable, options?: BaseFetchOptions): Promise<number | undefined>;
  public fetch(user?: undefined, options?: BaseFetchOptions): Promise<this>;
  public async fetch(
    user?: UserResolvable,
    { force = false }: BaseFetchOptions = {},
  ): Promise<number | this | undefined> {
    const api = this.client.api as unknown as {
      users: {
        ['@me']: {
          relationships: {
            get(): Promise<RawRelationshipData[]>;
          };
        };
      };
    };

    if (user) {
      const id = this.resolveId(user);
      if (!id) return undefined;
      if (!force) {
        const existing = this.cache.get(id);
        if (existing !== undefined) return existing;
      }
      const data = await api.users['@me'].relationships.get();
      this._setup(data);
      return this.cache.get(id);
    }

    const data = await api.users['@me'].relationships.get();
    this._setup(data);
    return this;
  }

  /**
   * Deletes a friend / blocked relationship with a client user or cancels a friend request.
   */
  public async deleteRelationship(user: UserResolvable): Promise<boolean> {
    const id = this.resolveId(user);
    if (!id) return false;
    const rel = this.cache.get(id);
    if (
      rel === undefined ||
      ![RelationshipTypes.FRIEND, RelationshipTypes.BLOCKED, RelationshipTypes.PENDING_OUTGOING].includes(rel)
    ) {
      return false;
    }

    const api = this.client.api as unknown as {
      users: {
        ['@me']: {
          relationships: Record<
            string,
            {
              delete(opts: { DiscordContext: { location: string } }): Promise<void>;
            }
          >;
        };
      };
    };

    await api.users['@me'].relationships[id].delete({
      DiscordContext: { location: 'ContextMenu' },
    });
    return true;
  }

  /**
   * Sends a friend request.
   */
  public async sendFriendRequest(options: UserResolvable | string): Promise<boolean> {
    const id = this.resolveId(options);
    const api = this.client.api as unknown as {
      users: {
        ['@me']: {
          relationships: {
            post(opts: { versioned: boolean; data: unknown; DiscordContext: { location: string } }): Promise<void>;
          } & Record<
            string,
            {
              put(opts: { data: unknown; DiscordContext: { location: string } }): Promise<void>;
            }
          >;
        };
      };
    };

    if (id) {
      await api.users['@me'].relationships[id].put({
        data: {},
        DiscordContext: { location: 'ContextMenu' },
      });
    } else {
      const username = this.resolveUsername(options);
      await api.users['@me'].relationships.post({
        versioned: true,
        data: {
          username,
          discriminator: null,
        },
        DiscordContext: { location: 'Add Friend' },
      });
    }
    return true;
  }

  /**
   * Accepts a friend request.
   */
  public async addFriend(user: UserResolvable): Promise<boolean> {
    const id = this.resolveId(user);
    if (!id) return false;
    if (this.cache.get(id) === RelationshipTypes.FRIEND) return false;
    if (this.cache.get(id) === RelationshipTypes.PENDING_OUTGOING) return false;

    const api = this.client.api as unknown as {
      users: {
        ['@me']: {
          relationships: Record<
            string,
            {
              put(opts: { data: unknown; DiscordContext: { location: string } }): Promise<void>;
            }
          >;
        };
      };
    };

    await api.users['@me'].relationships[id].put({
      data: { confirm_stranger_request: true },
      DiscordContext: { location: 'Friends' },
    });
    return true;
  }

  /**
   * Changes the nickname of a friend.
   */
  public async setNickname(user: UserResolvable, nickname: string | null = null): Promise<boolean> {
    const id = this.resolveId(user);
    if (!id || this.cache.get(id) !== RelationshipTypes.FRIEND) return false;

    const api = this.client.api as unknown as {
      users: {
        ['@me']: {
          relationships: Record<
            string,
            {
              patch(opts: { data: { nickname: string | null } }): Promise<void>;
            }
          >;
        };
      };
    };

    await api.users['@me'].relationships[id].patch({
      data: {
        nickname: typeof nickname === 'string' ? nickname : null,
      },
    });

    if (nickname) {
      this.friendNicknames.set(id, nickname);
    } else {
      this.friendNicknames.delete(id);
    }
    return true;
  }

  /**
   * Blocks a user.
   */
  public async addBlocked(user: UserResolvable): Promise<boolean> {
    const id = this.resolveId(user);
    if (!id || this.cache.get(id) === RelationshipTypes.BLOCKED) return false;

    const api = this.client.api as unknown as {
      users: {
        ['@me']: {
          relationships: Record<
            string,
            {
              put(opts: { data: { type: number }; DiscordContext: { location: string } }): Promise<void>;
            }
          >;
        };
      };
    };

    await api.users['@me'].relationships[id].put({
      data: {
        type: RelationshipTypes.BLOCKED as number,
      },
      DiscordContext: { location: 'ContextMenu' },
    });
    return true;
  }
}

export default RelationshipManager;
