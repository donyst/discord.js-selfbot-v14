import { Collection } from '@discordjs/collection';
import DataManager from './DataManager.js';
import { DiscordjsTypeError as DjsTypeError } from '../errors/index.js';
import { Role } from '../structures/Role.js';
import type { Snowflake } from '../types/index.js';
import type { GuildEmoji } from '../structures/GuildEmoji.js';
import type { Guild } from '../structures/Guild.js';
import type { RoleResolvable } from './RoleManager.js';

/**
 * Manages API methods for roles belonging to emojis and stores their cache.
 */
export class GuildEmojiRoleManager extends DataManager<Snowflake, Role, typeof Role> {
  public emoji: GuildEmoji;
  public guild: Guild;

  public constructor(emoji: GuildEmoji) {
    super(emoji.client, Role);
    this.emoji = emoji;
    this.guild = emoji.guild;
  }

  public get cache(): Collection<Snowflake, Role> {
    return this.guild.roles.cache.filter(role => this.emoji._roles.includes(role.id));
  }

  public async add(
    roleOrRoles: RoleResolvable | RoleResolvable[] | Collection<Snowflake, Role>,
  ): Promise<GuildEmoji> {
    let rolesArray: Iterable<RoleResolvable>;
    if (roleOrRoles instanceof Collection) {
      rolesArray = roleOrRoles.values();
    } else if (Array.isArray(roleOrRoles)) {
      rolesArray = roleOrRoles;
    } else {
      rolesArray = [roleOrRoles];
    }

    const resolvedRoles: Snowflake[] = [];
    for (const role of rolesArray) {
      const resolvedRole = this.guild.roles.resolveId(role);
      if (!resolvedRole) {
        throw new DjsTypeError('INVALID_ELEMENT', 'Array or Collection', 'roles', role);
      }
      resolvedRoles.push(resolvedRole);
    }

    const newRoles = [...new Set([...resolvedRoles, ...this.cache.keys()])];
    return this.set(newRoles);
  }

  public async remove(
    roleOrRoles: RoleResolvable | RoleResolvable[] | Collection<Snowflake, Role>,
  ): Promise<GuildEmoji> {
    let rolesArray: Iterable<RoleResolvable>;
    if (roleOrRoles instanceof Collection) {
      rolesArray = roleOrRoles.values();
    } else if (Array.isArray(roleOrRoles)) {
      rolesArray = roleOrRoles;
    } else {
      rolesArray = [roleOrRoles];
    }

    const resolvedRoleIds: Snowflake[] = [];
    for (const role of rolesArray) {
      const roleId = this.guild.roles.resolveId(role);
      if (!roleId) {
        throw new DjsTypeError('INVALID_ELEMENT', 'Array or Collection', 'roles', role);
      }
      resolvedRoleIds.push(roleId);
    }

    const newRoles = [...this.cache.keys()].filter(id => !resolvedRoleIds.includes(id));
    return this.set(newRoles);
  }

  public set(roles: (Snowflake | RoleResolvable)[] | Collection<Snowflake, Role>): Promise<GuildEmoji> {
    const rolesArray = roles instanceof Collection ? [...roles.keys()] : roles;
    return this.emoji.edit({ roles: rolesArray as RoleResolvable[] });
  }

  public clone(): GuildEmojiRoleManager {
    const Cls = this.constructor as typeof GuildEmojiRoleManager;
    const clone = new Cls(this.emoji);
    clone._patch([...this.cache.keys()]);
    return clone;
  }

  public _patch(roles: Snowflake[]): void {
    this.emoji._roles = roles;
  }

  public override valueOf(): Collection<Snowflake, Role> {
    return this.cache;
  }
}

export default GuildEmojiRoleManager;
