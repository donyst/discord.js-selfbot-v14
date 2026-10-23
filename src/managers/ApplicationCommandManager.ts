import { Collection } from '@discordjs/collection';
import type { Snowflake } from 'discord-api-types/v10';
import ApplicationCommandPermissionsManager from './ApplicationCommandPermissionsManager.js';
import CachedManager from './CachedManager.js';
import { DiscordjsTypeError as TypeError } from '../errors/index.js';
import {
  ApplicationCommand,
  type ApplicationCommandData,
  type ApplicationCommandOptionData,
  type ApplicationCommandOption,
} from '../structures/ApplicationCommand.js';
import { ApplicationCommandTypes } from '../util/Constants.js';
import Permissions, { PermissionResolvable } from '../util/Permissions.js';
import type { Client } from '../client/Client.js';
import type { Guild } from '../structures/Guild.js';

export type ApplicationCommandResolvable = ApplicationCommand | Snowflake;

export interface JSONEncodableLike {
  toJSON(): Record<string, unknown>;
}

export function isJSONEncodable(obj: unknown): obj is JSONEncodableLike {
  return typeof obj === 'object' && obj !== null && 'toJSON' in obj && typeof (obj as JSONEncodableLike).toJSON === 'function';
}

export interface CommandPathRoute {
  get(options?: Record<string, unknown>): Promise<unknown>;
  post(options?: Record<string, unknown>): Promise<unknown>;
  put(options?: Record<string, unknown>): Promise<unknown>;
  patch(options?: Record<string, unknown>): Promise<unknown>;
  delete(options?: Record<string, unknown>): Promise<unknown>;
  [key: string]: unknown;
}

export type ApplicationCommandDataResolvable =
  | ApplicationCommandData
  | JSONEncodableLike
  | Record<string, unknown>;

export interface BaseFetchOptions {
  cache?: boolean;
  force?: boolean;
}

export interface FetchApplicationCommandOptions extends BaseFetchOptions {
  guildId?: Snowflake;
  locale?: string;
  withLocalizations?: boolean;
}

export interface FetchApplicationCommandsOptions extends BaseFetchOptions {
  guildId?: Snowflake;
  locale?: string;
  withLocalizations?: boolean;
}

/**
 * Manages API methods for application commands and stores their cache.
 * @extends {CachedManager}
 */
export class ApplicationCommandManager extends CachedManager<Snowflake, ApplicationCommand, ApplicationCommandResolvable> {
  /**
   * The manager for permissions of arbitrary commands on arbitrary guilds
   */
  public permissions: ApplicationCommandPermissionsManager;

  /**
   * The guild this manager belongs to, if any
   */
  public guild: Guild | null = null;

  public constructor(client: Client, iterable?: Iterable<ApplicationCommand>) {
    super(client, ApplicationCommand, iterable);
    this.permissions = new ApplicationCommandPermissionsManager(this);
  }

  public override _add(
    data: unknown,
    cache = true,
    options?: { id?: Snowflake; extras?: unknown[] } | Snowflake,
  ): ApplicationCommand {
    const guildId = typeof options === 'string' ? options : undefined;
    const extras = typeof options === 'object' && options?.extras ? options.extras : [this.guild, guildId];
    return super._add(data, cache, { extras });
  }

  /**
   * The APIRouter path to the commands
   * @param options The options for the command path
   * @private
   */
  public commandPath({ id, guildId }: { id?: Snowflake; guildId?: Snowflake } = {}): CommandPathRoute {
    const client = this.client as unknown as {
      application?: { id: Snowflake };
      api: {
        applications: (appId: Snowflake) => {
          guilds: (gId: Snowflake) => { commands: ((cId?: Snowflake) => CommandPathRoute) & CommandPathRoute };
          commands: ((cId?: Snowflake) => CommandPathRoute) & CommandPathRoute;
        };
      };
    };
    let path = client.api.applications(client.application?.id ?? '');
    if (this.guild ?? guildId) {
      path = path.guilds((this.guild?.id ?? guildId) as Snowflake) as unknown as typeof path;
    }
    return (id ? path.commands(id) : path.commands) as unknown as CommandPathRoute;
  }

  /**
   * Obtains one or multiple application commands from Discord, or the cache if it's already available.
   * @param id The application command's id
   * @param options Additional options for this fetch
   */
  public async fetch(
    id: Snowflake,
    options?: FetchApplicationCommandOptions,
  ): Promise<ApplicationCommand>;
  public async fetch(
    options?: FetchApplicationCommandsOptions,
  ): Promise<Collection<Snowflake, ApplicationCommand>>;
  public async fetch(
    id?: Snowflake | FetchApplicationCommandsOptions,
    options?: FetchApplicationCommandOptions,
  ): Promise<ApplicationCommand | Collection<Snowflake, ApplicationCommand>> {
    let guildId: Snowflake | undefined;
    let cache = true;
    let force = false;
    let locale: string | undefined;
    let withLocalizations: boolean | undefined;

    if (typeof id === 'object' && id !== null) {
      guildId = id.guildId;
      cache = id.cache ?? true;
      force = id.force ?? false;
      locale = id.locale;
      withLocalizations = id.withLocalizations;
    } else if (typeof id === 'string') {
      if (options) {
        guildId = options.guildId;
        cache = options.cache ?? true;
        force = options.force ?? false;
        locale = options.locale;
        withLocalizations = options.withLocalizations;
      }
      if (!force) {
        const existing = this.cache.get(id);
        if (existing) return existing;
      }
      const command = await this.commandPath({ id, guildId }).get();
      return this._add(command, cache);
    }

    const query = typeof withLocalizations === 'boolean' ? { with_localizations: withLocalizations } : undefined;
    const headers = locale ? { 'X-Discord-Locale': locale } : undefined;

    const data = await this.commandPath({ guildId }).get({
      headers,
      query,
    });
    return (data as Array<Record<string, unknown>>).reduce(
      (coll: Collection<Snowflake, ApplicationCommand>, command: Record<string, unknown>) =>
        coll.set(command.id as Snowflake, this._add(command, cache, guildId)),
      new Collection<Snowflake, ApplicationCommand>(),
    );
  }

  /**
   * Creates an application command.
   * @param command The command
   * @param guildId The guild's id to create this command in
   */
  public async create(
    command: ApplicationCommandDataResolvable,
    guildId?: Snowflake,
  ): Promise<ApplicationCommand> {
    const data = await this.commandPath({ guildId }).post({
      data: (this.constructor as typeof ApplicationCommandManager).transformCommand(command),
    });
    return this._add(data, true, guildId);
  }

  /**
   * Sets all the commands for this application or guild.
   * @param commands The commands
   * @param guildId The guild's id to create the commands in
   */
  public async set(
    commands: ApplicationCommandDataResolvable[],
    guildId?: Snowflake,
  ): Promise<Collection<Snowflake, ApplicationCommand>> {
    const data = await this.commandPath({ guildId }).put({
      data: commands.map((c) =>
        (this.constructor as typeof ApplicationCommandManager).transformCommand(c),
      ),
    });
    return (data as Array<Record<string, unknown>>).reduce(
      (coll: Collection<Snowflake, ApplicationCommand>, command: Record<string, unknown>) =>
        coll.set(command.id as Snowflake, this._add(command, true, guildId)),
      new Collection<Snowflake, ApplicationCommand>(),
    );
  }

  /**
   * Edits an application command.
   * @param command The command to edit
   * @param data The data to update the command with
   * @param guildId The guild's id where the command registered
   */
  public async edit(
    command: ApplicationCommandResolvable,
    data: Partial<ApplicationCommandDataResolvable>,
    guildId?: Snowflake,
  ): Promise<ApplicationCommand> {
    const id = this.resolveId(command);
    if (!id) throw new TypeError('INVALID_TYPE', 'command', 'ApplicationCommandResolvable');

    const patched = await this.commandPath({ id, guildId }).patch({
      data: (this.constructor as typeof ApplicationCommandManager).transformCommand(
        data as ApplicationCommandDataResolvable,
      ),
    });
    return this._add(patched, true, guildId);
  }

  /**
   * Deletes an application command.
   * @param command The command to delete
   * @param guildId The guild's id where the command is registered
   */
  public async delete(
    command: ApplicationCommandResolvable,
    guildId?: Snowflake,
  ): Promise<ApplicationCommand | null> {
    const id = this.resolveId(command);
    if (!id) throw new TypeError('INVALID_TYPE', 'command', 'ApplicationCommandResolvable');

    await this.commandPath({ id, guildId }).delete();

    const cached = this.cache.get(id);
    this.cache.delete(id);
    return cached ?? null;
  }

  /**
   * Transforms an {@link ApplicationCommandData} object into something that can be used with the API.
   * @param command The command to transform
   * @private
   */
  public static transformCommand(command: ApplicationCommandDataResolvable): Record<string, unknown> {
    if (isJSONEncodable(command)) {
      return command.toJSON();
    }

    const cmd = command as Record<string, unknown>;
    let default_member_permissions: string | null | undefined;

    if ('default_member_permissions' in cmd) {
      default_member_permissions = cmd.default_member_permissions
        ? new Permissions(BigInt(cmd.default_member_permissions as string | bigint | number)).bitfield.toString()
        : (cmd.default_member_permissions as string | null | undefined);
    }

    if ('defaultMemberPermissions' in cmd) {
      default_member_permissions =
        cmd.defaultMemberPermissions !== null && cmd.defaultMemberPermissions !== undefined
          ? new Permissions(cmd.defaultMemberPermissions as PermissionResolvable).bitfield.toString()
          : (cmd.defaultMemberPermissions as string | null | undefined);
    }

    const typeValue =
      typeof cmd.type === 'number'
        ? cmd.type
        : typeof cmd.type === 'string'
        ? (ApplicationCommandTypes as Record<string, number>)[cmd.type]
        : undefined;

    return {
      name: cmd.name,
      name_localizations: cmd.nameLocalizations ?? cmd.name_localizations,
      description: cmd.description,
      description_localizations: cmd.descriptionLocalizations ?? cmd.description_localizations,
      type: typeValue,
      options: (cmd.options as unknown[] | undefined)?.map((o) =>
        ApplicationCommand.transformOption(o as ApplicationCommandOptionData | ApplicationCommandOption),
      ),
      default_permission: cmd.defaultPermission ?? cmd.default_permission,
      default_member_permissions,
      dm_permission: cmd.dmPermission ?? cmd.dm_permission,
    };
  }
}

export default ApplicationCommandManager;
