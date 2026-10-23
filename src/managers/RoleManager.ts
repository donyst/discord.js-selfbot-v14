import process from 'node:process';
import { Collection } from '@discordjs/collection';
import CachedManager from './CachedManager.js';
import { TypeError as DjsTypeError } from '../errors/index.js';
import Role, {
  type APIRoleData,
  type RoleData,
  type RoleColorsResolvable,
  type SetRolePositionOptions,
} from '../structures/Role.js';
import DataResolver from '../util/DataResolver.js';
import Permissions, { type PermissionResolvable } from '../util/Permissions.js';
import Util, { type ColorResolvable } from '../util/Util.js';
import type { Snowflake } from '../types/index.js';
import type { Guild } from '../structures/Guild.js';
import type { User } from '../structures/User.js';

let cacheWarningEmitted = false;
let deprecationEmittedForCreate = false;
let deprecationEmittedForEdit = false;

export type RoleResolvable = Role | Snowflake;

export interface BaseFetchOptions {
  cache?: boolean;
  force?: boolean;
}

export interface CreateRoleOptions {
  name?: string;
  color?: ColorResolvable;
  colors?: RoleColorsResolvable;
  hoist?: boolean;
  permissions?: PermissionResolvable;
  position?: number;
  mentionable?: boolean;
  icon?: unknown;
  unicodeEmoji?: string | null;
  reason?: string;
}

export interface GuildRolePosition {
  role: RoleResolvable;
  position: number;
}

export class RoleManager extends CachedManager<Snowflake, Role, RoleResolvable> {
  public guild: Guild;

  public constructor(guild: Guild, iterable?: Iterable<APIRoleData | Role>) {
    super(guild.client, Role, iterable as unknown as Iterable<Role>);
    if (!cacheWarningEmitted && this._cache.constructor.name !== 'Collection') {
      cacheWarningEmitted = true;
      process.emitWarning(
        `Overriding the cache handling for ${this.constructor.name} is unsupported and breaks functionality.`,
        'UnsupportedCacheOverwriteWarning',
      );
    }

    this.guild = guild;
  }

  public override _add(data: APIRoleData | Role, cache?: boolean): Role {
    return super._add(data, cache, { extras: [this.guild] });
  }

  public async fetch(
    id?: Snowflake,
    { cache = true, force = false }: BaseFetchOptions = {},
  ): Promise<Role | Collection<Snowflake, Role> | null> {
    if (id && !force) {
      const existing = this.cache.get(id);
      if (existing) return existing;
    }

    const data = await (this.client as unknown as { api: { guilds(gid: Snowflake): { roles: { get(): Promise<APIRoleData[]> } } } })
      .api.guilds(this.guild.id)
      .roles.get();
    const roles = new Collection<Snowflake, Role>();
    for (const role of data) roles.set(role.id, this._add(role, cache));
    return id ? roles.get(id) ?? null : roles;
  }

  public fetchMemberCounts(): Promise<Record<Snowflake, number>> {
    return (this.client as unknown as { api: { guilds(gid: Snowflake): { roles(sub: string): { get(): Promise<Record<Snowflake, number>> } } } })
      .api.guilds(this.guild.id)
      .roles('member-counts')
      .get();
  }

  public async fetchMemberIds(role: RoleResolvable): Promise<Snowflake[]> {
    const id = this.resolveId(role);
    if (!id) throw new DjsTypeError('INVALID_TYPE', 'role', 'RoleResolvable');

    return (this.client as unknown as { api: { guilds(gid: Snowflake): { roles(rid: Snowflake, sub: string): { get(): Promise<Snowflake[]> } } } })
      .api.guilds(this.guild.id)
      .roles(id, 'member-ids')
      .get();
  }

  public async create(options: CreateRoleOptions = {}): Promise<Role> {
    let { permissions, icon } = options;
    const { name, color, hoist, position, mentionable, reason, unicodeEmoji } = options;

    if (typeof permissions !== 'undefined') permissions = new Permissions(permissions);
    if (icon) {
      const guildEmojiURL = (this.guild.emojis as unknown as { resolve(i: unknown): { url?: string } | null }).resolve(icon)?.url;
      const resolvedIcon = guildEmojiURL
        ? await DataResolver.resolveImage(guildEmojiURL)
        : await DataResolver.resolveImage(icon as string);
      icon = typeof resolvedIcon === 'string' ? resolvedIcon : undefined;
    }

    let colors: { primary_color?: number; secondary_color?: number | null; tertiary_color?: number | null } | undefined;
    if (options.colors) {
      const c = options.colors as { primaryColor?: ColorResolvable; secondaryColor?: ColorResolvable | null; tertiaryColor?: ColorResolvable | null };
      colors = {
        primary_color: c.primaryColor ? Util.resolveColor(c.primaryColor) : undefined,
        secondary_color: c.secondaryColor ? Util.resolveColor(c.secondaryColor) : null,
        tertiary_color: c.tertiaryColor ? Util.resolveColor(c.tertiaryColor) : null,
      };
    }

    if (color !== undefined) {
      if (!deprecationEmittedForCreate) {
        process.emitWarning('Passing "color" to RoleManager#create() is deprecated. Use "colors" instead.');
      }
      deprecationEmittedForCreate = true;

      colors = {
        primary_color: Util.resolveColor(color),
        secondary_color: null,
        tertiary_color: null,
      };
    }

    const data = await (this.client as unknown as { api: { guilds(gid: Snowflake): { roles: { post(opts: { data: unknown; reason?: string }): Promise<APIRoleData> } } } })
      .api.guilds(this.guild.id)
      .roles.post({
        data: {
          name,
          colors,
          hoist,
          permissions: (permissions as Permissions)?.bitfield.toString(),
          mentionable,
          icon,
          unicode_emoji: unicodeEmoji,
        },
        reason,
      });

    const role = (this.client as unknown as { actions: { GuildRoleCreate: { handle(d: unknown): { role: Role } } } })
      .actions.GuildRoleCreate.handle({
        guild_id: this.guild.id,
        role: data,
      }).role;

    if (position) return this.setPosition(role, position, { reason });
    return role;
  }

  public async edit(role: RoleResolvable, data: RoleData, reason?: string): Promise<Role> {
    const resolvedRole = this.resolve(role);
    if (!resolvedRole) throw new DjsTypeError('INVALID_TYPE', 'role', 'RoleResolvable');

    if (typeof data.position === 'number') await this.setPosition(resolvedRole, data.position, { reason });

    let icon = data.icon;
    if (icon) {
      const guildEmojiURL = (this.guild.emojis as unknown as { resolve(i: unknown): { url?: string } | null }).resolve(icon)?.url;
      const resolvedIcon = guildEmojiURL
        ? await DataResolver.resolveImage(guildEmojiURL)
        : await DataResolver.resolveImage(icon as string);
      icon = typeof resolvedIcon === 'string' ? resolvedIcon : undefined;
    }

    let colors: { primary_color?: number; secondary_color?: number | null; tertiary_color?: number | null } | undefined;
    if (data.colors) {
      const c = data.colors as { primaryColor?: ColorResolvable; secondaryColor?: ColorResolvable | null; tertiaryColor?: ColorResolvable | null };
      colors = {
        primary_color: c.primaryColor ? Util.resolveColor(c.primaryColor) : undefined,
        secondary_color: c.secondaryColor ? Util.resolveColor(c.secondaryColor) : null,
        tertiary_color: c.tertiaryColor ? Util.resolveColor(c.tertiaryColor) : null,
      };
    }

    if (data.color !== undefined) {
      if (!deprecationEmittedForEdit) {
        process.emitWarning('Passing "color" to RoleManager#edit() is deprecated. Use "colors" instead.');
      }
      deprecationEmittedForEdit = true;

      colors = {
        primary_color: Util.resolveColor(data.color),
        secondary_color: null,
        tertiary_color: null,
      };
    }

    const payload = {
      name: data.name,
      colors,
      hoist: data.hoist,
      permissions: typeof data.permissions === 'undefined' ? undefined : new Permissions(data.permissions).bitfield.toString(),
      mentionable: data.mentionable,
      icon,
      unicode_emoji: data.unicodeEmoji,
    };

    const d = await (this.client as unknown as { api: { guilds(gid: Snowflake): { roles(rid: Snowflake): { patch(opts: { data: unknown; reason?: string }): Promise<APIRoleData> } } } })
      .api.guilds(this.guild.id)
      .roles(resolvedRole.id)
      .patch({ data: payload, reason });

    const clone = resolvedRole._clone();
    clone._patch(d);
    return clone;
  }

  public async delete(role: RoleResolvable, reason?: string): Promise<void> {
    const id = this.resolveId(role);
    if (!id) throw new DjsTypeError('INVALID_TYPE', 'role', 'RoleResolvable');

    await (this.client as unknown as { api: { guilds: Record<string, { roles: Record<string, { delete(opts: { reason?: string }): Promise<unknown> }> }> } })
      .api.guilds[this.guild.id].roles[id].delete({ reason });
    (this.client as unknown as { actions: { GuildRoleDelete: { handle(d: unknown): void } } })
      .actions.GuildRoleDelete.handle({ guild_id: this.guild.id, role_id: id });
  }

  public async setPosition(role: RoleResolvable, position: number, { relative, reason }: SetRolePositionOptions = {}): Promise<Role> {
    const resolvedRole = this.resolve(role);
    if (!resolvedRole) throw new DjsTypeError('INVALID_TYPE', 'role', 'RoleResolvable');

    const updatedRoles = await (Util as unknown as {
      setPosition(
        item: unknown,
        pos: number,
        rel?: boolean,
        sorted?: unknown[],
        route?: unknown,
        r?: string,
      ): Promise<unknown[]>;
    }).setPosition(
      resolvedRole,
      position,
      relative,
      (this.guild as unknown as { _sortedRoles(): Role[] })._sortedRoles(),
      (this.client as unknown as { api: { guilds(gid: Snowflake): { roles: unknown } } }).api.guilds(this.guild.id).roles,
      reason,
    );

    (this.client as unknown as { actions: { GuildRolesPositionUpdate: { handle(d: unknown): void } } })
      .actions.GuildRolesPositionUpdate.handle({
        guild_id: this.guild.id,
        roles: updatedRoles,
      });
    return resolvedRole;
  }

  public async setPositions(rolePositions: GuildRolePosition[]): Promise<Guild> {
    const formatted = rolePositions.map(o => ({
      id: this.resolveId(o.role)!,
      position: o.position,
    }));

    await (this.client as unknown as { api: { guilds(gid: Snowflake): { roles: { patch(opts: { data: unknown }): Promise<unknown> } } } })
      .api.guilds(this.guild.id)
      .roles.patch({
        data: formatted,
      });

    return (this.client as unknown as { actions: { GuildRolesPositionUpdate: { handle(d: unknown): { guild: Guild } } } })
      .actions.GuildRolesPositionUpdate.handle({
        guild_id: this.guild.id,
        roles: formatted,
      }).guild;
  }

  public comparePositions(role1: RoleResolvable, role2: RoleResolvable): number {
    const resolvedRole1 = this.resolve(role1);
    const resolvedRole2 = this.resolve(role2);
    if (!resolvedRole1 || !resolvedRole2) throw new DjsTypeError('INVALID_TYPE', 'role', 'Role nor a Snowflake');

    const role1Position = resolvedRole1.position;
    const role2Position = resolvedRole2.position;

    if (role1Position === role2Position) {
      return Number(BigInt(resolvedRole2.id) - BigInt(resolvedRole1.id));
    }

    return role1Position - role2Position;
  }

  public botRoleFor(user: User | Snowflake): Role | null {
    const userId = (this.client.users as unknown as { resolveId(u: unknown): Snowflake | null }).resolveId(user);
    if (!userId) return null;
    return this.cache.find(role => role.tags?.botId === userId) ?? null;
  }

  public get everyone(): Role | undefined {
    return this.cache.get(this.guild.id);
  }

  public get premiumSubscriberRole(): Role | null {
    return this.cache.find(role => Boolean(role.tags?.premiumSubscriberRole)) ?? null;
  }

  public get highest(): Role {
    return this.cache.reduce(
      (prev, role) => (prev ? (role.comparePositionTo(prev) > 0 ? role : prev) : role),
      this.cache.first()!,
    );
  }
}

export default RoleManager;
