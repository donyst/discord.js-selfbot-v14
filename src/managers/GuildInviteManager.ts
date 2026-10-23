import { Collection } from '@discordjs/collection';
import { CachedManager } from './CachedManager.js';
import { DiscordjsError as DJSError } from '../errors/index.js';
import { Invite, type APIInviteData } from '../structures/Invite.js';
import DataResolver from '../util/DataResolver.js';
import type { Snowflake, GuildChannelResolvable, UserResolvable } from '../types/index.js';
import type { Guild } from '../structures/Guild.js';

export type InviteResolvable = string | Invite;

export interface FetchInviteOptions {
  code: InviteResolvable;
  cache?: boolean;
  force?: boolean;
}

export interface FetchInvitesOptions {
  channelId?: GuildChannelResolvable;
  cache?: boolean;
}

export interface CreateInviteOptions {
  temporary?: boolean;
  maxAge?: number;
  maxUses?: number;
  unique?: boolean;
  targetUser?: UserResolvable;
  targetApplication?: { id?: Snowflake; applicationId?: Snowflake } | Snowflake;
  targetType?: number;
  reason?: string;
}

/**
 * Manages API methods for GuildInvites and stores their cache.
 * @extends {CachedManager}
 */
export class GuildInviteManager extends CachedManager<string, Invite, InviteResolvable> {
  /**
   * The guild this Manager belongs to
   */
  public guild: Guild;

  public constructor(guild: Guild, iterable?: Iterable<Invite>) {
    super(guild.client, Invite, iterable);
    this.guild = guild;
  }

  public override _add(data: APIInviteData, cache?: boolean): Invite {
    return super._add(data, cache, { id: data.code, extras: [this.guild] });
  }

  /**
   * Fetches invite(s) from Discord.
   */
  public fetch(options: InviteResolvable | FetchInviteOptions): Promise<Invite>;
  public fetch(options?: FetchInvitesOptions): Promise<Collection<string, Invite>>;
  public async fetch(
    options?: InviteResolvable | FetchInviteOptions | FetchInvitesOptions,
  ): Promise<Invite | Collection<string, Invite>> {
    if (!options) return this._fetchMany();

    if (typeof options === 'string') {
      const code = DataResolver.resolveInviteCode(options);
      if (!code) throw new DJSError('INVITE_RESOLVE_CODE');
      return this._fetchSingle({ code, cache: true });
    }

    if (!('code' in options) || !options.code) {
      const opts = options as FetchInvitesOptions;
      if (opts.channelId) {
        const channels = this.guild.channels as unknown as { resolveId(c: unknown): Snowflake | null };
        const id = channels.resolveId(opts.channelId);
        if (!id) throw new DJSError('GUILD_CHANNEL_RESOLVE');
        return this._fetchChannelMany(id, opts.cache);
      }

      if ('cache' in opts) return this._fetchMany(opts.cache);
      throw new DJSError('INVITE_RESOLVE_CODE');
    }

    const inviteOpts = options as FetchInviteOptions;
    return this._fetchSingle({
      ...inviteOpts,
      code: DataResolver.resolveInviteCode(inviteOpts.code)!,
    });
  }

  public async _fetchSingle({
    code,
    cache,
    force = false,
  }: {
    code: string;
    cache?: boolean;
    force?: boolean;
  }): Promise<Invite> {
    if (!force) {
      const existing = this.cache.get(code);
      if (existing) return existing;
    }

    const invites = await this._fetchMany(cache);
    const invite = invites.get(code);
    if (!invite) throw new DJSError('INVITE_NOT_FOUND');
    return invite;
  }

  public async _fetchMany(cache?: boolean): Promise<Collection<string, Invite>> {
    const api = this.client.api as unknown as {
      guilds(guildId: Snowflake): {
        invites: {
          get(): Promise<APIInviteData[]>;
        };
      };
    };

    const data = await api.guilds(this.guild.id).invites.get();
    return data.reduce(
      (col: Collection<string, Invite>, invite: APIInviteData) => col.set(invite.code, this._add(invite, cache)),
      new Collection<string, Invite>(),
    );
  }

  public async _fetchChannelMany(channelId: Snowflake, cache?: boolean): Promise<Collection<string, Invite>> {
    const api = this.client.api as unknown as {
      channels(chId: Snowflake): {
        invites: {
          get(): Promise<APIInviteData[]>;
        };
      };
    };

    const data = await api.channels(channelId).invites.get();
    return data.reduce(
      (col: Collection<string, Invite>, invite: APIInviteData) => col.set(invite.code, this._add(invite, cache)),
      new Collection<string, Invite>(),
    );
  }

  /**
   * Create an invite to the guild from the provided channel.
   */
  public async create(
    channel: GuildChannelResolvable,
    {
      temporary = false,
      maxAge = 86400,
      maxUses = 0,
      unique,
      targetUser,
      targetApplication,
      targetType,
      reason,
    }: CreateInviteOptions = {},
  ): Promise<Invite> {
    const channels = this.guild.channels as unknown as { resolveId(c: unknown): Snowflake | null };
    const id = channels.resolveId(channel);
    if (!id) throw new DJSError('GUILD_CHANNEL_RESOLVE');

    const users = this.client.users as unknown as { resolveId(u: unknown): Snowflake | null };
    const targetAppObj = targetApplication as { id?: Snowflake; applicationId?: Snowflake } | Snowflake | undefined;
    const targetAppId =
      typeof targetAppObj === 'object' && targetAppObj !== null
        ? targetAppObj.id ?? targetAppObj.applicationId
        : targetAppObj;

    const api = this.client.api as unknown as {
      channels(chId: Snowflake): {
        invites: {
          post(opts: { data: unknown; reason?: string }): Promise<APIInviteData>;
        };
      };
    };

    const invite = await api.channels(id).invites.post({
      data: {
        temporary,
        max_age: maxAge,
        max_uses: maxUses,
        unique,
        target_user_id: users.resolveId(targetUser),
        target_application_id: targetAppId,
        target_type: targetType,
      },
      reason,
    });

    return new Invite(this.client, invite);
  }

  /**
   * Deletes an invite.
   */
  public async delete(invite: InviteResolvable, reason?: string): Promise<void> {
    const code = DataResolver.resolveInviteCode(invite);
    const api = this.client.api as unknown as {
      invites(inviteCode: string): {
        delete(opts: { reason?: string }): Promise<void>;
      };
    };

    await api.invites(code).delete({ reason });
  }
}

export default GuildInviteManager;
