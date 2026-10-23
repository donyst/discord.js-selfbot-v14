import process from 'node:process';
import { Collection } from '@discordjs/collection';
import { CachedManager } from './CachedManager.js';
import { DiscordjsTypeError as DJSTypeError, DiscordjsError as DJSError } from '../errors/index.js';
import { GuildBan, type RawGuildBanData } from '../structures/GuildBan.js';
import { GuildMember } from '../structures/GuildMember.js';
import type { Snowflake, UserResolvable, BaseFetchOptions } from '../types/index.js';
import type { Guild } from '../structures/Guild.js';
import type { User } from '../structures/User.js';

let deprecationEmittedForDays = false;

export type GuildBanResolvable = GuildBan | UserResolvable;

export interface FetchBanOptions extends BaseFetchOptions {
  user: UserResolvable;
}

export interface FetchBansOptions {
  limit?: number;
  before?: Snowflake;
  after?: Snowflake;
  cache?: boolean;
}

export interface BanOptions {
  days?: number;
  deleteMessageSeconds?: number;
  reason?: string;
}

export interface BulkBanOptions {
  deleteMessageSeconds?: number;
  reason?: string;
}

export interface BulkBanResult {
  bannedUsers: Snowflake[];
  failedUsers: Snowflake[];
}

/**
 * Manages API methods for GuildBans and stores their cache.
 * @extends {CachedManager}
 */
export class GuildBanManager extends CachedManager<Snowflake, GuildBan, GuildBanResolvable> {
  /**
   * The guild this Manager belongs to
   */
  public guild: Guild;

  public constructor(guild: Guild, iterable?: Iterable<GuildBan>) {
    super(guild.client, GuildBan, iterable);
    this.guild = guild;
  }

  public override _add(data: RawGuildBanData, cache?: boolean): GuildBan {
    const userId = (data.user as { id: Snowflake }).id;
    return super._add(data, cache, { id: userId, extras: [this.guild] });
  }

  /**
   * Resolves a GuildBanResolvable to a GuildBan object.
   */
  public override resolve(idOrInstance: GuildBan): GuildBan;
  public override resolve(idOrInstance: GuildBanResolvable): GuildBan | null;
  public override resolve(ban: unknown): GuildBan | null {
    const userMgr = this.client.users as unknown as { resolveId(u: unknown): Snowflake | null };
    return super.resolve(ban as GuildBan) ?? super.resolve((userMgr.resolveId(ban) ?? undefined) as unknown as GuildBan);
  }

  /**
   * Fetches ban(s) from Discord.
   */
  public fetch(options: UserResolvable | FetchBanOptions): Promise<GuildBan>;
  public fetch(options?: FetchBansOptions): Promise<Collection<Snowflake, GuildBan>>;
  public async fetch(
    options?: UserResolvable | FetchBanOptions | FetchBansOptions,
  ): Promise<GuildBan | Collection<Snowflake, GuildBan>> {
    if (!options) return this._fetchMany();

    const opts = typeof options === 'object' && options !== null ? options : {};
    const userOption = (opts as FetchBanOptions).user;
    const userMgr = this.client.users as unknown as { resolveId(u: unknown): Snowflake | null };
    const resolvedUser = userMgr.resolveId(userOption ?? options);

    if (resolvedUser) {
      return this._fetchSingle({
        user: resolvedUser,
        cache: (opts as BaseFetchOptions).cache,
        force: (opts as BaseFetchOptions).force,
      });
    }

    const { before, after, limit, cache } = opts as FetchBansOptions;
    if (!before && !after && !limit && typeof cache === 'undefined') {
      throw new DJSError('FETCH_BAN_RESOLVE_ID');
    }

    return this._fetchMany(opts as FetchBansOptions);
  }

  public async _fetchSingle({
    user,
    cache,
    force = false,
  }: {
    user: Snowflake;
    cache?: boolean;
    force?: boolean;
  }): Promise<GuildBan> {
    if (!force) {
      const existing = this.cache.get(user);
      if (existing && !(existing as unknown as { partial?: boolean }).partial) return existing;
    }

    const api = this.client.api as unknown as {
      guilds(guildId: Snowflake): {
        bans(userId: Snowflake): {
          get(): Promise<RawGuildBanData>;
        };
      };
    };

    const data = await api.guilds(this.guild.id).bans(user).get();
    return this._add(data, cache);
  }

  public async _fetchMany(options: FetchBansOptions = {}): Promise<Collection<Snowflake, GuildBan>> {
    const api = this.client.api as unknown as {
      guilds(guildId: Snowflake): {
        bans: {
          get(opts: { query: unknown }): Promise<RawGuildBanData[]>;
        };
      };
    };

    const data = await api.guilds(this.guild.id).bans.get({
      query: options,
    });

    return data.reduce(
      (col: Collection<Snowflake, GuildBan>, ban: RawGuildBanData) =>
        col.set((ban.user as { id: Snowflake }).id, this._add(ban, options.cache)),
      new Collection<Snowflake, GuildBan>(),
    );
  }

  /**
   * Bans a user from the guild.
   */
  public async create(user: UserResolvable, options: BanOptions = {}): Promise<GuildMember | User | Snowflake> {
    if (typeof options !== 'object' || options === null) {
      throw new DJSTypeError('INVALID_TYPE', 'options', 'object', true);
    }
    const userMgr = this.client.users as unknown as {
      resolveId(u: unknown): Snowflake | null;
      resolve(u: unknown): User | null;
    };
    const id = userMgr.resolveId(user);
    if (!id) throw new DJSError('BAN_RESOLVE_ID', true);

    if (typeof options.days !== 'undefined' && !deprecationEmittedForDays) {
      process.emitWarning(
        'The days option for GuildBanManager#create() is deprecated. Use the deleteMessageSeconds option instead.',
        'DeprecationWarning',
      );
      deprecationEmittedForDays = true;
    }

    const deleteSeconds =
      typeof options.deleteMessageSeconds !== 'undefined'
        ? options.deleteMessageSeconds
        : (options.days ?? 0) * 24 * 60 * 60;

    const api = this.client.api as unknown as {
      guilds(guildId: Snowflake): {
        bans(userId: Snowflake): {
          put(opts: { data: { delete_message_seconds: number }; reason?: string }): Promise<void>;
        };
      };
    };

    await api.guilds(this.guild.id).bans(id).put({
      data: {
        delete_message_seconds: deleteSeconds,
      },
      reason: options.reason,
    });

    if (user instanceof GuildMember) return user;
    const clientUser = this.client.users.cache.get(id);
    if (clientUser) {
      return this.guild.members.resolve(clientUser) ?? clientUser;
    }
    return id;
  }

  /**
   * Unbans a user from the guild.
   */
  public async remove(user: UserResolvable, reason?: string): Promise<User | null> {
    const userMgr = this.client.users as unknown as {
      resolveId(u: unknown): Snowflake | null;
      resolve(u: unknown): User | null;
    };
    const id = userMgr.resolveId(user);
    if (!id) throw new DJSError('BAN_RESOLVE_ID');

    const api = this.client.api as unknown as {
      guilds(guildId: Snowflake): {
        bans(userId: Snowflake): {
          delete(opts: { reason?: string }): Promise<void>;
        };
      };
    };

    await api.guilds(this.guild.id).bans(id).delete({ reason });
    return userMgr.resolve(user);
  }

  /**
   * Bulk ban users from a guild.
   */
  public async bulkCreate(
    users: Collection<Snowflake, UserResolvable> | UserResolvable[],
    options: BulkBanOptions = {},
  ): Promise<BulkBanResult> {
    if (!users || !(Array.isArray(users) || users instanceof Collection)) {
      throw new DJSTypeError('INVALID_TYPE', 'users', 'Array or Collection of UserResolvable', true);
    }
    if (typeof options !== 'object' || options === null) {
      throw new DJSTypeError('INVALID_TYPE', 'options', 'object', true);
    }

    const userMgr = this.client.users as unknown as { resolveId(u: unknown): Snowflake | null };
    const userList = Array.isArray(users) ? users : [...users.values()];
    const userIds = userList.map(u => userMgr.resolveId(u)).filter((id): id is Snowflake => Boolean(id));

    if (userIds.length === 0) throw new DJSError('BULK_BAN_USERS_OPTION_EMPTY');

    const api = this.client.api as unknown as {
      guilds(guildId: Snowflake): {
        ['bulk-ban']: {
          post(opts: {
            data: { delete_message_days?: number; user_ids: Snowflake[] };
            reason?: string;
          }): Promise<{ banned_users: Snowflake[]; failed_users: Snowflake[] }>;
        };
      };
    };

    const result = await api.guilds(this.guild.id)['bulk-ban'].post({
      data: { delete_message_days: options.deleteMessageSeconds, user_ids: userIds },
      reason: options.reason,
    });

    return { bannedUsers: result.banned_users, failedUsers: result.failed_users };
  }
}

export default GuildBanManager;
