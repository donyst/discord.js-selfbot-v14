import { Collection } from '@discordjs/collection';
import DataManager from './DataManager.js';
import { TypeError as DjsTypeError } from '../errors/index.js';
import Role from '../structures/Role.js';
import type { Snowflake } from '../types/index.js';
import type { GuildMember } from '../structures/GuildMember.js';
import type { Guild } from '../structures/Guild.js';

export type RoleResolvable = Role | Snowflake;

export class GuildMemberRoleManager extends DataManager<Snowflake, Role, RoleResolvable> {
  public member: GuildMember;
  public guild: Guild;

  public constructor(member: GuildMember) {
    super(member.client, Role);
    this.member = member;
    this.guild = member.guild;
  }

  public get cache(): Collection<Snowflake, Role> {
    const everyone = this.guild.roles.everyone;
    const res = (this.guild.roles.cache as Collection<Snowflake, Role>).filter(role =>
      this.member._roles.includes(role.id),
    );
    if (everyone) {
      res.set(everyone.id, everyone);
    }
    return res;
  }

  public get hoist(): Role | null {
    const hoistedRoles = this.cache.filter(role => role.hoist);
    if (!hoistedRoles.size) return null;
    return hoistedRoles.reduce((prev, role) => (role.comparePositionTo(prev) > 0 ? role : prev));
  }

  public get icon(): Role | null {
    const iconRoles = this.cache.filter(role => Boolean(role.icon || role.unicodeEmoji));
    if (!iconRoles.size) return null;
    return iconRoles.reduce((prev, role) => (role.comparePositionTo(prev) > 0 ? role : prev));
  }

  public get color(): Role | null {
    const coloredRoles = this.cache.filter(role => Boolean(role.colors.primaryColor));
    if (!coloredRoles.size) return null;
    return coloredRoles.reduce((prev, role) => (role.comparePositionTo(prev) > 0 ? role : prev));
  }

  public get highest(): Role {
    return this.cache.reduce(
      (prev, role) => (prev ? (role.comparePositionTo(prev) > 0 ? role : prev) : role),
      this.cache.first()!,
    );
  }

  public get premiumSubscriberRole(): Role | null {
    return this.cache.find(role => Boolean(role.tags?.premiumSubscriberRole)) ?? null;
  }

  public get botRole(): Role | null {
    if (!this.member.user?.bot) return null;
    return this.cache.find(role => role.tags?.botId === this.member.user.id) ?? null;
  }

  public async add(
    roleOrRoles: RoleResolvable | RoleResolvable[] | Collection<Snowflake, Role>,
    reason?: string,
  ): Promise<GuildMember> {
    if (roleOrRoles instanceof Collection || Array.isArray(roleOrRoles)) {
      const resolvedRoles: Snowflake[] = [];
      const values = roleOrRoles instanceof Collection ? roleOrRoles.values() : roleOrRoles;
      for (const role of values) {
        const resolvedRole = this.guild.roles.resolveId(role as Snowflake);
        if (!resolvedRole) throw new DjsTypeError('INVALID_ELEMENT', 'Array or Collection', 'roles', role);
        resolvedRoles.push(resolvedRole);
      }

      const newRoles = [...new Set(resolvedRoles.concat(...this.cache.keys()))];
      return this.set(newRoles, reason);
    } else {
      const resolvedRole = this.guild.roles.resolveId(roleOrRoles as Snowflake);
      if (resolvedRole === null) {
        throw new DjsTypeError('INVALID_TYPE', 'roles', 'Role, Snowflake or Array or Collection of Roles or Snowflakes');
      }

      await (this.client as unknown as { api: { guilds: Record<string, { members: Record<string, { roles: Record<string, { put(opts: { reason?: string }): Promise<unknown> }> }> }> } })
        .api.guilds[this.guild.id].members[this.member.id].roles[resolvedRole].put({ reason });

      const clone = this.member._clone();
      clone._roles = [...this.cache.keys(), resolvedRole];
      return clone;
    }
  }

  public async remove(
    roleOrRoles: RoleResolvable | RoleResolvable[] | Collection<Snowflake, Role>,
    reason?: string,
  ): Promise<GuildMember> {
    if (roleOrRoles instanceof Collection || Array.isArray(roleOrRoles)) {
      const resolvedRoles: Snowflake[] = [];
      const values = roleOrRoles instanceof Collection ? roleOrRoles.values() : roleOrRoles;
      for (const role of values) {
        const resolvedRole = this.guild.roles.resolveId(role as Snowflake);
        if (!resolvedRole) throw new DjsTypeError('INVALID_ELEMENT', 'Array or Collection', 'roles', role);
        resolvedRoles.push(resolvedRole);
      }

      const newRoles = this.cache.filter(role => !resolvedRoles.includes(role.id));
      return this.set([...newRoles.keys()], reason);
    } else {
      const resolvedRole = this.guild.roles.resolveId(roleOrRoles as Snowflake);
      if (resolvedRole === null) {
        throw new DjsTypeError('INVALID_TYPE', 'roles', 'Role, Snowflake or Array or Collection of Roles or Snowflakes');
      }

      await (this.client as unknown as { api: { guilds: Record<string, { members: Record<string, { roles: Record<string, { delete(opts: { reason?: string }): Promise<unknown> }> }> }> } })
        .api.guilds[this.guild.id].members[this.member.id].roles[resolvedRole].delete({ reason });

      const clone = this.member._clone();
      const newRoles = this.cache.filter(role => role.id !== resolvedRole);
      clone._roles = [...newRoles.keys()];
      return clone;
    }
  }

  public set(roles: Collection<Snowflake, Role> | (RoleResolvable | { id: Snowflake })[], reason?: string): Promise<GuildMember> {
    const roleIds = roles instanceof Collection ? [...roles.keys()] : roles;
    return this.member.edit({ roles: roleIds as (Snowflake | { id: Snowflake })[] }, reason);
  }

  public clone(): GuildMemberRoleManager {
    const clone = new (this.constructor as typeof GuildMemberRoleManager)(this.member);
    clone.member._roles = [...this.cache.keys()];
    return clone;
  }
}

export default GuildMemberRoleManager;
