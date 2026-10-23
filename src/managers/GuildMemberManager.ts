import { Buffer } from 'node:buffer';
import { setTimeout, clearTimeout } from 'node:timers';
import { Collection } from '@discordjs/collection';
import CachedManager from './CachedManager.js';
import { DiscordjsError as DjsError, DiscordjsTypeError as DjsTypeError, DiscordjsRangeError as DjsRangeError } from '../errors/index.js';
import BaseGuildVoiceChannel from '../structures/BaseGuildVoiceChannel.js';
import { GuildMember } from '../structures/GuildMember.js';
import { Role } from '../structures/Role.js';
import { Events, Opcodes, PartialTypes } from '../util/Constants.js';
import DataResolver from '../util/DataResolver.js';
import GuildMemberFlags from '../util/GuildMemberFlags.js';
import SnowflakeUtil from '../util/SnowflakeUtil.js';
import type { Snowflake } from '../types/index.js';
import type { Guild } from '../structures/Guild.js';
import type { User } from '../structures/User.js';
import type { RoleResolvable } from './RoleManager.js';

export type UserResolvable = User | GuildMember | Snowflake | string;
export type GuildMemberResolvable = GuildMember | UserResolvable;

export interface AddGuildMemberOptions {
  accessToken: string;
  nick?: string;
  roles?: Collection<Snowflake, Role> | RoleResolvable[];
  mute?: boolean;
  deaf?: boolean;
  force?: boolean;
  fetchWhenExisting?: boolean;
}

export interface FetchMemberOptions {
  user: UserResolvable;
  force?: boolean;
  cache?: boolean;
}

export interface FetchMembersOptions {
  user?: UserResolvable | UserResolvable[];
  query?: string;
  limit?: number;
  withPresences?: boolean;
  time?: number;
  nonce?: string;
  force?: boolean;
}

export interface GuildSearchMembersOptions {
  query?: string;
  limit?: number;
  cache?: boolean;
}

export interface GuildMemberEditData {
  nick?: string | null;
  roles?: (RoleResolvable | { id: Snowflake })[];
  mute?: boolean;
  deaf?: boolean;
  channel?: unknown;
  channel_id?: Snowflake | null;
  communicationDisabledUntil?: Date | number | string | null;
  communication_disabled_until?: string | null;
  flags?: unknown;
  avatar?: string | Buffer | null;
  banner?: string | Buffer | null;
  bio?: string | null;
}

export interface GuildPruneMembersOptions {
  days?: number;
  dry?: boolean;
  count?: boolean;
  roles?: RoleResolvable[];
  reason?: string;
}

export interface MemberChunkData {
  nonce?: string;
  count?: number;
  [key: string]: unknown;
}

/**
 * Manages API methods for GuildMembers and stores their cache.
 */
export class GuildMemberManager extends CachedManager<Snowflake, GuildMember, GuildMemberResolvable> {
  public readonly guild: Guild;

  public constructor(guild: Guild, iterable?: Iterable<GuildMember>) {
    super(guild.client, GuildMember, iterable);
    this.guild = guild;
  }

  public override _add(data: unknown, cache = true): GuildMember {
    const raw = data as { user: { id: Snowflake } };
    return super._add(raw, cache, { id: raw.user.id, extras: [this.guild] });
  }

  public override resolve(member: GuildMember): GuildMember;
  public override resolve(member: GuildMemberResolvable): GuildMember | null;
  public override resolve(member: unknown): GuildMember | null {
    const memberResolvable = super.resolve(member as GuildMemberResolvable);
    if (memberResolvable) return memberResolvable;
    const userId = (this.client.users as unknown as { resolveId(u: unknown): Snowflake | null }).resolveId(member);
    if (userId) return this.cache.get(userId) ?? null;
    return null;
  }

  public override resolveId(member: Snowflake | GuildMember): Snowflake;
  public override resolveId(member: GuildMemberResolvable): Snowflake | null;
  public override resolveId(member: unknown): Snowflake | null {
    const memberResolvable = super.resolveId(member as GuildMemberResolvable);
    if (memberResolvable) return memberResolvable;
    const userId = (this.client.users as unknown as { resolveId(u: unknown): Snowflake | null }).resolveId(member);
    return userId && this.cache.has(userId) ? userId : null;
  }

  public async add(user: UserResolvable, options: AddGuildMemberOptions): Promise<GuildMember | null> {
    const userId = (this.client.users as unknown as { resolveId(u: unknown): Snowflake | null }).resolveId(user);
    if (!userId) throw new DjsTypeError('INVALID_TYPE', 'user', 'UserResolvable');
    if (!options.force) {
      const cachedUser = this.cache.get(userId);
      if (cachedUser) return cachedUser;
    }
    const resolvedOptions: Record<string, unknown> = {
      access_token: options.accessToken,
      nick: options.nick,
      mute: options.mute,
      deaf: options.deaf,
    };
    if (options.roles) {
      if (!Array.isArray(options.roles) && !(options.roles instanceof Collection)) {
        throw new DjsTypeError('INVALID_TYPE', 'options.roles', 'Array or Collection of Roles or Snowflakes', true);
      }
      const resolvedRoles: Snowflake[] = [];
      const rolesValues = Array.isArray(options.roles) ? options.roles : Array.from(options.roles.values());
      for (const role of rolesValues) {
        const resolvedRole = this.guild.roles.resolveId(role);
        if (!resolvedRole) throw new DjsTypeError('INVALID_ELEMENT', 'Array or Collection', 'options.roles', role);
        resolvedRoles.push(resolvedRole);
      }
      resolvedOptions.roles = resolvedRoles;
    }
    const data = await (this.client as unknown as {
      api: {
        guilds(id: Snowflake): {
          members(userId: Snowflake): {
            put(opts: { data: Record<string, unknown> }): Promise<unknown>;
          };
        };
      };
    }).api
      .guilds(this.guild.id)
      .members(userId)
      .put({ data: resolvedOptions });

    return data instanceof Buffer
      ? options.fetchWhenExisting === false
        ? null
        : (this.fetch(userId) as Promise<GuildMember>)
      : this._add(data);
  }

  public get me(): GuildMember | null {
    const clientUserId = this.client.user?.id;
    if (!clientUserId) return null;
    return (
      this.cache.get(clientUserId) ??
      ((this.client.options as unknown as { partials?: string[] })?.partials?.includes(PartialTypes.GUILD_MEMBER)
        ? this._add({ user: { id: clientUserId } }, true)
        : null)
    );
  }

  public fetch(options?: Snowflake | FetchMemberOptions): Promise<GuildMember>;
  public fetch(options: FetchMembersOptions): Promise<Collection<Snowflake, GuildMember>>;
  public fetch(
    options?: Snowflake | FetchMemberOptions | FetchMembersOptions,
  ): Promise<GuildMember | Collection<Snowflake, GuildMember>> {
    if (!options) {
      const mePerms = this.me?.permissions;
      if (
        mePerms?.has('KICK_MEMBERS') ||
        mePerms?.has('BAN_MEMBERS') ||
        mePerms?.has('MANAGE_ROLES')
      ) {
        return this._fetchMany();
      }
      return this.fetchByMemberSafety();
    }
    const user = (this.client.users as unknown as { resolveId(u: unknown): Snowflake | null }).resolveId(options);
    if (user) return this._fetchSingle({ user, cache: true });
    const opts = (typeof options === 'object' && options !== null ? { ...options } : {}) as FetchMembersOptions & FetchMemberOptions & { user?: UserResolvable | UserResolvable[] };
    if (opts.user) {
      if (Array.isArray(opts.user)) {
        const resolvedUsers = opts.user.map(u => (this.client.users as unknown as { resolveId(u: unknown): Snowflake }).resolveId(u));
        return this._fetchMany({ ...opts, user: resolvedUsers } as FetchMembersOptions);
      }
      const resolvedUser = (this.client.users as unknown as { resolveId(u: unknown): Snowflake }).resolveId(opts.user);
      if (!opts.limit && !opts.withPresences) return this._fetchSingle({ ...opts, user: resolvedUser ?? '' });
      return this._fetchMany({ ...opts, user: resolvedUser ? [resolvedUser] : [] } as FetchMembersOptions);
    }
    return this._fetchMany(opts as FetchMembersOptions);
  }

  public fetchMe(options?: FetchMemberOptions): Promise<GuildMember> {
    return this.fetch({ ...options, user: this.client.user!.id });
  }

  public async search({ query, limit = 1, cache = true }: GuildSearchMembersOptions = {}): Promise<Collection<Snowflake, GuildMember>> {
    const data = await (this.client as unknown as {
      api: {
        guilds(id: Snowflake): {
          members: {
            search: {
              get(opts: { query: { query?: string; limit: number } }): Promise<{ user: { id: Snowflake } }[]>;
            };
          };
        };
      };
    }).api
      .guilds(this.guild.id)
      .members.search.get({ query: { query, limit } });

    return data.reduce((col, member) => col.set(member.user.id, this._add(member, cache)), new Collection<Snowflake, GuildMember>());
  }

  public async edit(user: UserResolvable, data: GuildMemberEditData, reason?: string): Promise<GuildMember> {
    const id = (this.client.users as unknown as { resolveId(u: unknown): Snowflake | null }).resolveId(user);
    if (!id) throw new DjsTypeError('INVALID_TYPE', 'user', 'UserResolvable');

    const _data: Record<string, unknown> = { ...data };
    if (_data.channel) {
      const ch = this.guild.channels.resolve(_data.channel as import('./GuildChannelManager.js').GuildChannelResolvable);
      if (!(ch instanceof BaseGuildVoiceChannel)) {
        throw new DjsError('GUILD_VOICE_CHANNEL_RESOLVE');
      }
      _data.channel_id = ch.id;
      _data.channel = undefined;
    } else if (_data.channel === null) {
      _data.channel_id = null;
      _data.channel = undefined;
    }
    if (_data.roles && Array.isArray(_data.roles)) {
      _data.roles = _data.roles.map(role => (role instanceof Role ? role.id : role));
    }

    if (_data.communicationDisabledUntil) {
      _data.communication_disabled_until = new Date(_data.communicationDisabledUntil as string | number | Date).toISOString();
    }

    if (_data.flags) {
      _data.flags = GuildMemberFlags.resolve(_data.flags as number | bigint | string);
    }

    if (typeof _data.avatar !== 'undefined') {
      _data.avatar = await DataResolver.resolveImage(_data.avatar as string | Buffer);
    }
    if (typeof _data.banner !== 'undefined') {
      _data.banner = await DataResolver.resolveImage(_data.banner as string | Buffer);
    }

    interface MemberEndpoint {
      patch(opts: { data: Record<string, unknown>; reason?: string }): Promise<unknown>;
    }

    let endpoint: MemberEndpoint;
    const clientApi = (this.client as unknown as {
      api: {
        guilds(id: Snowflake): {
          members(id: string): MemberEndpoint;
        };
      };
    }).api.guilds(this.guild.id);

    if (id === this.client.user?.id) {
      const keys = Object.keys(data);
      if (keys.length === 1 && ['nick', 'avatar', 'banner', 'bio'].includes(keys[0]!)) {
        endpoint = clientApi.members('@me');
      } else {
        endpoint = clientApi.members(id);
      }
    } else {
      endpoint = clientApi.members(id);
    }
    const d = await endpoint.patch({ data: _data, reason });

    const clone = this.cache.get(id)?._clone();
    clone?._patch(d as unknown as import('../structures/GuildMember.js').APIGuildMemberData);
    return clone ?? this._add(d as unknown as import('../structures/GuildMember.js').APIGuildMemberData, false);
  }

  public async prune({
    days = 7,
    dry = false,
    count: compute_prune_count = true,
    roles = [],
    reason,
  }: GuildPruneMembersOptions = {}): Promise<number | null> {
    if (typeof days !== 'number') throw new DjsTypeError('PRUNE_DAYS_TYPE');

    const query: Record<string, unknown> = { days };
    const resolvedRoles: Snowflake[] = [];

    for (const role of roles) {
      const resolvedRole = this.guild.roles.resolveId(role);
      if (!resolvedRole) {
        throw new DjsTypeError('INVALID_ELEMENT', 'Array', 'options.roles', role);
      }
      resolvedRoles.push(resolvedRole);
    }

    if (resolvedRoles.length) {
      query.include_roles = dry ? resolvedRoles.join(',') : resolvedRoles;
    }

    const endpoint = (this.client as unknown as {
      api: {
        guilds(id: Snowflake): {
          prune: {
            get(opts: { query: Record<string, unknown>; reason?: string }): Promise<{ pruned: number | null }>;
            post(opts: { data: Record<string, unknown>; reason?: string }): Promise<{ pruned: number | null }>;
          };
        };
      };
    }).api.guilds(this.guild.id).prune;

    const { pruned } = await (dry
      ? endpoint.get({ query, reason })
      : endpoint.post({ data: { ...query, compute_prune_count }, reason }));

    return pruned;
  }

  public async kick(user: UserResolvable, reason?: string): Promise<GuildMember | User | Snowflake> {
    const id = (this.client.users as unknown as { resolveId(u: unknown): Snowflake | null }).resolveId(user);
    if (!id) throw new DjsTypeError('INVALID_TYPE', 'user', 'UserResolvable');

    await (this.client as unknown as {
      api: {
        guilds(id: Snowflake): {
          members(id: Snowflake): {
            delete(opts: { reason?: string }): Promise<void>;
          };
        };
      };
    }).api
      .guilds(this.guild.id)
      .members(id)
      .delete({ reason });

    return this.resolve(user) ?? (this.client.users as unknown as { resolve(u: unknown): User | null }).resolve(user) ?? id;
  }

  public ban(user: UserResolvable, options?: unknown): Promise<unknown> {
    return (this.guild as unknown as { bans: { create(u: UserResolvable, opts?: unknown): Promise<unknown> } }).bans.create(user, options);
  }

  public unban(user: UserResolvable, reason?: string): Promise<User | null> {
    return (this.guild as unknown as { bans: { remove(u: UserResolvable, r?: string): Promise<User | null> } }).bans.remove(user, reason);
  }

  public async _fetchSingle({ user, cache, force = false }: { user: Snowflake; cache?: boolean; force?: boolean }): Promise<GuildMember> {
    if (!force) {
      const existing = this.cache.get(user);
      if (existing && !existing.partial) return existing;
    }

    const data = await (this.client as unknown as {
      api: {
        guilds(id: Snowflake): {
          members(id: Snowflake): {
            get(): Promise<unknown>;
          };
        };
      };
    }).api
      .guilds(this.guild.id)
      .members(user)
      .get();
    return this._add(data, cache);
  }

  public async addRole(user: UserResolvable, role: RoleResolvable, reason?: string): Promise<GuildMember | User | Snowflake> {
    const userId = this.resolveId(user);
    const roleId = this.guild.roles.resolveId(role);
    if (!userId || !roleId) throw new DjsTypeError('INVALID_TYPE', 'user or role', 'UserResolvable/RoleResolvable');

    await (this.client as unknown as {
      api: {
        guilds(id: Snowflake): {
          members(id: Snowflake): {
            roles(rId: Snowflake): {
              put(opts: { reason?: string }): Promise<void>;
            };
          };
        };
      };
    }).api
      .guilds(this.guild.id)
      .members(userId)
      .roles(roleId)
      .put({ reason });

    return this.resolve(user) ?? (this.client.users as unknown as { resolve(u: unknown): User | null }).resolve(user) ?? userId;
  }

  public async removeRole(user: UserResolvable, role: RoleResolvable, reason?: string): Promise<GuildMember | User | Snowflake> {
    const userId = this.resolveId(user);
    const roleId = this.guild.roles.resolveId(role);
    if (!userId || !roleId) throw new DjsTypeError('INVALID_TYPE', 'user or role', 'UserResolvable/RoleResolvable');

    await (this.client as unknown as {
      api: {
        guilds(id: Snowflake): {
          members(id: Snowflake): {
            roles(rId: Snowflake): {
              delete(opts: { reason?: string }): Promise<void>;
            };
          };
        };
      };
    }).api
      .guilds(this.guild.id)
      .members(userId)
      .roles(roleId)
      .delete({ reason });

    return this.resolve(user) ?? (this.client.users as unknown as { resolve(u: unknown): User | null }).resolve(user) ?? userId;
  }

  public fetchByMemberSafety(timeout = 15_000): Promise<Collection<Snowflake, GuildMember>> {
    return new Promise(resolve => {
      const nonce = SnowflakeUtil.generate();
      const fetchedMembers = new Collection<Snowflake, GuildMember>();
      const timeout_ = setTimeout(() => {
        (this.client as unknown as { removeListener(event: string, fn: unknown): void }).removeListener(Events.GUILD_MEMBERS_CHUNK, handler);
        resolve(fetchedMembers);
      }, timeout).unref();

      const handler = (members: Collection<Snowflake, GuildMember>, guild: Guild, chunk: MemberChunkData): void => {
        if (guild.id === this.guild.id && chunk.nonce === nonce) {
          if (members.size > 0) {
            for (const member of members.values()) {
              fetchedMembers.set(member.id, member);
            }
            (this.client as unknown as { ws: { broadcast(data: unknown): void } }).ws.broadcast({
              op: Opcodes.SEARCH_RECENT_MEMBERS,
              d: {
                guild_id: this.guild.id,
                query: '',
                continuation_token: members.first()?.id,
                nonce,
              },
            });
          } else {
            clearTimeout(timeout_);
            (this.client as unknown as { removeListener(event: string, fn: unknown): void }).removeListener(Events.GUILD_MEMBERS_CHUNK, handler);
            resolve(fetchedMembers);
          }
        }
      };

      (this.client as unknown as { on(event: string, fn: unknown): void }).on(Events.GUILD_MEMBERS_CHUNK, handler);
      (this.client as unknown as { ws: { broadcast(data: unknown): void } }).ws.broadcast({
        op: Opcodes.SEARCH_RECENT_MEMBERS,
        d: {
          guild_id: this.guild.id,
          query: '',
          continuation_token: null,
          nonce,
        },
      });
    });
  }

  public _fetchMany({
    limit = 0,
    withPresences: presences = true,
    user: user_ids,
    query,
    time = 120e3,
    nonce = SnowflakeUtil.generate(),
  }: FetchMembersOptions = {}): Promise<Collection<Snowflake, GuildMember>> {
    return new Promise((resolve, reject) => {
      if (!query && !user_ids) query = '';
      if (nonce.length > 32) throw new DjsRangeError('MEMBER_FETCH_NONCE_LENGTH');

      (this.guild as unknown as { shard: { send(data: unknown): void } }).shard.send({
        op: Opcodes.REQUEST_GUILD_MEMBERS,
        d: {
          guild_id: this.guild.id,
          presences,
          user_ids,
          query,
          nonce,
          limit,
        },
      });

      const fetchedMembers = new Collection<Snowflake, GuildMember>();
      let i = 0;
      let timer: NodeJS.Timeout;

      const handler = (members: Collection<Snowflake, GuildMember>, _: unknown, chunk: MemberChunkData): void => {
        timer.refresh();
        if (chunk.nonce !== nonce) return;
        i++;
        for (const member of members.values()) {
          fetchedMembers.set(member.id, member);
        }
        if (members.size < 1_000 || (limit && fetchedMembers.size >= limit) || i === chunk.count) {
          clearTimeout(timer);
          (this.client as unknown as { removeListener(event: string, fn: unknown): void }).removeListener(Events.GUILD_MEMBERS_CHUNK, handler);
          (this.client as unknown as { decrementMaxListeners(): void }).decrementMaxListeners();
          resolve(fetchedMembers);
        }
      };

      timer = setTimeout(() => {
        (this.client as unknown as { removeListener(event: string, fn: unknown): void }).removeListener(Events.GUILD_MEMBERS_CHUNK, handler);
        (this.client as unknown as { decrementMaxListeners(): void }).decrementMaxListeners();
        reject(new DjsError('GUILD_MEMBERS_TIMEOUT'));
      }, time).unref();

      (this.client as unknown as { incrementMaxListeners(): void }).incrementMaxListeners();
      (this.client as unknown as { on(event: string, fn: unknown): void }).on(Events.GUILD_MEMBERS_CHUNK, handler);
    });
  }

  public bulkBan(users: Collection<Snowflake, UserResolvable> | UserResolvable[], options: Record<string, unknown> = {}): Promise<unknown> {
    return (this.guild as unknown as { bans: { bulkCreate(u: unknown, opts: unknown): Promise<unknown> } }).bans.bulkCreate(users, options);
  }
}

export default GuildMemberManager;
