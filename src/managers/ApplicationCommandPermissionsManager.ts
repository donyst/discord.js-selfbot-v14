import { Collection } from '@discordjs/collection';
import type { Snowflake } from 'discord-api-types/v10';
import BaseManager from './BaseManager.js';
import { DiscordjsError as Error, DiscordjsTypeError as TypeError } from '../errors/index.js';
import { ApplicationCommandPermissionTypes, APIErrors } from '../util/Constants.js';
import type { Guild } from '../structures/Guild.js';
import type { ApplicationCommand } from '../structures/ApplicationCommand.js';
import type { ApplicationCommandManager } from './ApplicationCommandManager.js';

export type ApplicationCommandPermissionType = 'ROLE' | 'USER' | string;

export interface ApplicationCommandPermissionData {
  id: Snowflake;
  type: ApplicationCommandPermissionType | number;
  permission: boolean;
}

export interface ApplicationCommandPermissions {
  id: Snowflake;
  type: ApplicationCommandPermissionType | number;
  permission: boolean;
}

export interface BaseApplicationCommandPermissionsOptions {
  guild?: unknown;
  command?: unknown;
}

export interface GuildApplicationCommandPermissionData {
  id: Snowflake;
  permissions: ApplicationCommandPermissionData[];
}

export interface SetApplicationCommandPermissionsOptions extends BaseApplicationCommandPermissionsOptions {
  permissions?: ApplicationCommandPermissionData[];
  fullPermissions?: GuildApplicationCommandPermissionData[];
}

export interface AddApplicationCommandPermissionsOptions extends BaseApplicationCommandPermissionsOptions {
  permissions: ApplicationCommandPermissionData[];
}

export interface RemoveApplicationCommandPermissionsOptions extends BaseApplicationCommandPermissionsOptions {
  users?: unknown | unknown[];
  roles?: unknown | unknown[];
}

export interface HasApplicationCommandPermissionsOptions extends BaseApplicationCommandPermissionsOptions {
  permissionId: unknown;
}

export interface RawAPIPermission {
  id: Snowflake;
  type: number | string;
  permission: boolean;
}

/**
 * Manages API methods for permissions of Application Commands.
 * @extends {BaseManager}
 */
export class ApplicationCommandPermissionsManager extends BaseManager {
  public manager: ApplicationCommandManager | ApplicationCommand;
  public guild: Guild | null;
  public guildId: Snowflake | null;
  public commandId: Snowflake | null;

  public constructor(manager: ApplicationCommandManager | ApplicationCommand) {
    super(manager.client);
    this.manager = manager;
    this.guild = (manager as { guild?: Guild | null }).guild ?? null;
    this.guildId =
      (manager as { guildId?: Snowflake | null }).guildId ??
      (manager as { guild?: { id: Snowflake } | null }).guild?.id ??
      null;
    this.commandId = (manager as { id?: Snowflake }).id ?? null;
  }

  public permissionsPath(guildId: Snowflake, commandId?: Snowflake | null): unknown {
    const api = (this.client as unknown as { api: { applications: (appId: Snowflake) => { guilds: (gid: Snowflake) => { commands: (cid?: Snowflake | null) => { permissions: unknown } } } } }).api;
    const clientApp = (this.client as unknown as { application: { id: Snowflake } }).application;
    return api.applications(clientApp.id).guilds(guildId).commands(commandId).permissions;
  }

  public async fetch(options: BaseApplicationCommandPermissionsOptions = {}): Promise<ApplicationCommandPermissions[] | Collection<Snowflake, ApplicationCommandPermissions[]>> {
    const { guildId, commandId } = this._validateOptions(options.guild, options.command);
    const path = this.permissionsPath(guildId, commandId) as { get: () => Promise<{ permissions: RawAPIPermission[] } & RawAPIPermission[]> };

    if (commandId) {
      const data = await path.get();
      return data.permissions.map(perm => ApplicationCommandPermissionsManager.transformPermissions(perm, true));
    }

    const data = await (path as unknown as { get: () => Promise<{ id: Snowflake; permissions: RawAPIPermission[] }[]> }).get();
    return data.reduce(
      (coll, perm) =>
        coll.set(
          perm.id,
          perm.permissions.map(p => ApplicationCommandPermissionsManager.transformPermissions(p, true)),
        ),
      new Collection<Snowflake, ApplicationCommandPermissions[]>(),
    );
  }

  public async set(options: SetApplicationCommandPermissionsOptions = {}): Promise<ApplicationCommandPermissions[] | Collection<Snowflake, ApplicationCommandPermissions[]>> {
    const { guildId, commandId } = this._validateOptions(options.guild, options.command);
    const path = this.permissionsPath(guildId, commandId) as { put: (opts: { data: unknown }) => Promise<{ permissions: RawAPIPermission[] } & { id: Snowflake; permissions: RawAPIPermission[] }[]> };

    if (commandId) {
      if (!Array.isArray(options.permissions)) {
        throw new TypeError('INVALID_TYPE', 'permissions', 'Array of ApplicationCommandPermissionData', true);
      }
      const data = await path.put({
        data: { permissions: options.permissions.map(perm => ApplicationCommandPermissionsManager.transformPermissions(perm)) },
      });
      return data.permissions.map(perm => ApplicationCommandPermissionsManager.transformPermissions(perm, true));
    }

    if (!Array.isArray(options.fullPermissions)) {
      throw new TypeError('INVALID_TYPE', 'fullPermissions', 'Array of GuildApplicationCommandPermissionData', true);
    }

    const APIPermissions = [];
    for (const perm of options.fullPermissions) {
      if (!Array.isArray(perm.permissions)) throw new TypeError('INVALID_ELEMENT', 'Array', 'fullPermissions', perm);
      APIPermissions.push({
        id: perm.id,
        permissions: perm.permissions.map(p => ApplicationCommandPermissionsManager.transformPermissions(p)),
      });
    }
    const data = await path.put({
      data: APIPermissions,
    });
    return data.reduce(
      (coll, perm) =>
        coll.set(
          perm.id,
          perm.permissions.map(p => ApplicationCommandPermissionsManager.transformPermissions(p, true)),
        ),
      new Collection<Snowflake, ApplicationCommandPermissions[]>(),
    );
  }

  public async add({ guild, command, permissions }: AddApplicationCommandPermissionsOptions): Promise<ApplicationCommandPermissions[]> {
    const { guildId, commandId } = this._validateOptions(guild, command);
    if (!commandId) throw new TypeError('INVALID_TYPE', 'command', 'ApplicationCommandResolvable');
    if (!Array.isArray(permissions)) {
      throw new TypeError('INVALID_TYPE', 'permissions', 'Array of ApplicationCommandPermissionData', true);
    }

    let existing: ApplicationCommandPermissions[] = [];
    try {
      existing = (await this.fetch({ guild: guildId, command: commandId })) as ApplicationCommandPermissions[];
    } catch (error: unknown) {
      if ((error as { code?: number }).code !== APIErrors.UNKNOWN_APPLICATION_COMMAND_PERMISSIONS) throw error;
    }

    const newPermissions = permissions.slice();
    for (const perm of existing) {
      if (!newPermissions.some(x => x.id === perm.id)) {
        newPermissions.push(perm);
      }
    }

    return (await this.set({ guild: guildId, command: commandId, permissions: newPermissions })) as ApplicationCommandPermissions[];
  }

  public async remove({ guild, command, users, roles }: RemoveApplicationCommandPermissionsOptions): Promise<ApplicationCommandPermissions[]> {
    const { guildId, commandId } = this._validateOptions(guild, command);
    if (!commandId) throw new TypeError('INVALID_TYPE', 'command', 'ApplicationCommandResolvable');

    if (!users && !roles) throw new TypeError('INVALID_TYPE', 'users OR roles', 'Array or Resolvable', true);

    const resolvedIds: Snowflake[] = [];
    const clientUsers = (this.client as unknown as { users: { resolveId: (u: unknown) => Snowflake | null } }).users;

    if (Array.isArray(users)) {
      users.forEach(user => {
        const userId = clientUsers.resolveId(user);
        if (!userId) throw new TypeError('INVALID_ELEMENT', 'Array', 'users', user);
        resolvedIds.push(userId);
      });
    } else if (users) {
      const userId = clientUsers.resolveId(users);
      if (!userId) {
        throw new TypeError('INVALID_TYPE', 'users', 'Array or UserResolvable');
      }
      resolvedIds.push(userId);
    }

    if (Array.isArray(roles)) {
      roles.forEach(role => {
        if (typeof role === 'string') {
          resolvedIds.push(role);
          return;
        }
        if (!this.guild) throw new Error('GUILD_UNCACHED_ROLE_RESOLVE');
        const roleId = (this.guild.roles as unknown as { resolveId: (r: unknown) => Snowflake | null }).resolveId(role);
        if (!roleId) throw new TypeError('INVALID_ELEMENT', 'Array', 'users', role);
        resolvedIds.push(roleId);
      });
    } else if (roles) {
      if (typeof roles === 'string') {
        resolvedIds.push(roles);
      } else {
        if (!this.guild) throw new Error('GUILD_UNCACHED_ROLE_RESOLVE');
        const roleId = (this.guild.roles as unknown as { resolveId: (r: unknown) => Snowflake | null }).resolveId(roles);
        if (!roleId) {
          throw new TypeError('INVALID_TYPE', 'users', 'Array or RoleResolvable');
        }
        resolvedIds.push(roleId);
      }
    }

    let existing: ApplicationCommandPermissions[] = [];
    try {
      existing = (await this.fetch({ guild: guildId, command: commandId })) as ApplicationCommandPermissions[];
    } catch (error: unknown) {
      if ((error as { code?: number }).code !== APIErrors.UNKNOWN_APPLICATION_COMMAND_PERMISSIONS) throw error;
    }

    const permissions = existing.filter(perm => !resolvedIds.includes(perm.id));

    return (await this.set({ guild: guildId, command: commandId, permissions })) as ApplicationCommandPermissions[];
  }

  public async has({ guild, command, permissionId }: HasApplicationCommandPermissionsOptions): Promise<boolean> {
    const { guildId, commandId } = this._validateOptions(guild, command);
    if (!commandId) throw new TypeError('INVALID_TYPE', 'command', 'ApplicationCommandResolvable');

    if (!permissionId) throw new TypeError('INVALID_TYPE', 'permissionId', 'UserResolvable or RoleResolvable');
    let resolvedId: Snowflake | null = typeof permissionId === 'string' ? permissionId : null;
    if (typeof permissionId !== 'string') {
      const clientUsers = (this.client as unknown as { users: { resolveId: (u: unknown) => Snowflake | null } }).users;
      resolvedId = clientUsers.resolveId(permissionId);
      if (!resolvedId) {
        if (!this.guild) throw new Error('GUILD_UNCACHED_ROLE_RESOLVE');
        resolvedId = (this.guild.roles as unknown as { resolveId: (r: unknown) => Snowflake | null }).resolveId(permissionId);
      }
      if (!resolvedId) {
        throw new TypeError('INVALID_TYPE', 'permissionId', 'UserResolvable or RoleResolvable');
      }
    }

    let existing: ApplicationCommandPermissions[] = [];
    try {
      existing = (await this.fetch({ guild: guildId, command: commandId })) as ApplicationCommandPermissions[];
    } catch (error: unknown) {
      if ((error as { code?: number }).code !== APIErrors.UNKNOWN_APPLICATION_COMMAND_PERMISSIONS) throw error;
    }

    return existing.some(perm => perm.id === resolvedId);
  }

  public _validateOptions(guild?: unknown, command?: unknown): { guildId: Snowflake; commandId: Snowflake | null } {
    const clientGuilds = (this.client as unknown as { guilds: { resolveId: (g: unknown) => Snowflake | null } }).guilds;
    const guildId = this.guildId ?? clientGuilds.resolveId(guild);
    if (!guildId) throw new Error('GLOBAL_COMMAND_PERMISSIONS');
    let commandId = this.commandId;
    if (command && !commandId) {
      commandId = (this.manager as unknown as { resolveId?: (c: unknown) => Snowflake | null }).resolveId?.(command) ?? null;
      if (!commandId && this.guild) {
        commandId = (this.guild as unknown as { commands: { resolveId: (c: unknown) => Snowflake | null } }).commands.resolveId(command);
      }
      const clientApp = (this.client as unknown as { application?: { commands: { resolveId: (c: unknown) => Snowflake | null } } }).application;
      commandId ??= clientApp?.commands.resolveId(command) ?? null;
      if (!commandId) {
        throw new TypeError('INVALID_TYPE', 'command', 'ApplicationCommandResolvable', true);
      }
    }
    return { guildId, commandId };
  }

  public static transformPermissions(permissions: ApplicationCommandPermissionData | RawAPIPermission, received?: boolean): ApplicationCommandPermissions {
    return {
      id: permissions.id,
      permission: permissions.permission,
      type:
        typeof permissions.type === 'number' && !received
          ? permissions.type
          : (ApplicationCommandPermissionTypes as unknown as Record<number | string, ApplicationCommandPermissionType>)[permissions.type] ?? String(permissions.type),
    };
  }
}

export default ApplicationCommandPermissionsManager;
