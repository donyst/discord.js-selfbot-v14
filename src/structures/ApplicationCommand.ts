import type { Snowflake } from 'discord-api-types/v10';
import Base from './Base.js';
import ApplicationCommandPermissionsManager from '../managers/ApplicationCommandPermissionsManager.js';
import {
  ApplicationCommandOptionTypes,
  ApplicationCommandTypes,
  ChannelTypes,
} from '../util/Constants.js';
import Permissions from '../util/Permissions.js';
import SnowflakeUtil from '../util/SnowflakeUtil.js';
import type { Client } from '../client/Client.js';
import type { Guild } from './Guild.js';
import type { ApplicationCommandManager } from '../managers/ApplicationCommandManager.js';
import type { PermissionResolvable } from '../util/Permissions.js';

export type ApplicationCommandType = 'CHAT_INPUT' | 'USER' | 'MESSAGE' | string;
export type ApplicationCommandOptionType =
  | 'SUB_COMMAND'
  | 'SUB_COMMAND_GROUP'
  | 'STRING'
  | 'INTEGER'
  | 'BOOLEAN'
  | 'USER'
  | 'CHANNEL'
  | 'ROLE'
  | 'MENTIONABLE'
  | 'NUMBER'
  | 'ATTACHMENT'
  | string;

export interface ApplicationCommandOptionChoice {
  name: string;
  nameLocalized?: string | null;
  nameLocalizations?: Record<string, string> | null;
  value: string | number;
}

export interface ApplicationCommandOption {
  type: ApplicationCommandOptionType;
  name: string;
  nameLocalizations?: Record<string, string> | null;
  nameLocalized?: string | null;
  description: string;
  descriptionLocalizations?: Record<string, string> | null;
  descriptionLocalized?: string | null;
  required?: boolean;
  autocomplete?: boolean;
  choices?: ApplicationCommandOptionChoice[];
  options?: ApplicationCommandOption[];
  channelTypes?: unknown[];
  minValue?: number;
  maxValue?: number;
  minLength?: number;
  maxLength?: number;
}

export interface ApplicationCommandOptionChoiceData {
  name: string;
  nameLocalizations?: Record<string, string>;
  name_localizations?: Record<string, string>;
  nameLocalized?: string;
  name_localized?: string;
  value: string | number;
}

export interface ApplicationCommandOptionData {
  type: ApplicationCommandOptionType | number;
  name: string;
  nameLocalizations?: Record<string, string>;
  name_localizations?: Record<string, string>;
  nameLocalized?: string;
  name_localized?: string;
  description: string;
  descriptionLocalizations?: Record<string, string>;
  description_localizations?: Record<string, string>;
  descriptionLocalized?: string;
  description_localized?: string;
  autocomplete?: boolean;
  required?: boolean;
  choices?: ApplicationCommandOptionChoiceData[];
  options?: ApplicationCommandOptionData[];
  channelTypes?: unknown[];
  channel_types?: unknown[];
  minValue?: number;
  min_value?: number;
  maxValue?: number;
  max_value?: number;
  minLength?: number;
  min_length?: number;
  maxLength?: number;
  max_length?: number;
}

export interface ApplicationCommandData {
  name: string;
  nameLocalizations?: Record<string, string>;
  description: string;
  descriptionLocalizations?: Record<string, string>;
  type?: ApplicationCommandType;
  options?: ApplicationCommandOptionData[];
  defaultPermission?: boolean;
  defaultMemberPermissions?: PermissionResolvable | null;
  dmPermission?: boolean;
}

export interface RawApplicationCommandData {
  id: Snowflake;
  application_id: Snowflake;
  name: string;
  name_localizations?: Record<string, string> | null;
  name_localized?: string | null;
  description: string;
  description_localizations?: Record<string, string> | null;
  description_localized?: string | null;
  type: number | string;
  options?: ApplicationCommandOptionData[];
  default_permission?: boolean;
  default_member_permissions?: string | null;
  dm_permission?: boolean | null;
  version?: Snowflake;
}

/**
 * Represents an application command.
 * @extends {Base}
 */
export class ApplicationCommand extends Base {
  public declare id: Snowflake;

  /**
   * The parent application's id
   */
  public applicationId: Snowflake;

  /**
   * The guild this command is part of
   */
  public guild: Guild | null;

  /**
   * The guild's id this command is part of
   */
  public guildId: Snowflake | null;

  /**
   * The manager for permissions of this command
   */
  public permissions: ApplicationCommandPermissionsManager;

  /**
   * The type of this application command
   */
  public type: ApplicationCommandType;

  /**
   * The name of this command
   */
  public name!: string;

  /**
   * The name localizations for this command
   */
  public nameLocalizations!: Record<string, string> | null;

  /**
   * The localized name for this command
   */
  public nameLocalized!: string | null;

  /**
   * The description of this command
   */
  public description!: string;

  /**
   * The description localizations for this command
   */
  public descriptionLocalizations!: Record<string, string> | null;

  /**
   * The localized description for this command
   */
  public descriptionLocalized!: string | null;

  /**
   * The options of this command
   */
  public options!: ApplicationCommandOption[];

  /**
   * Whether the command is enabled by default
   */
  public defaultPermission?: boolean;

  /**
   * The default bitfield used to determine whether this command be used in a guild
   */
  public defaultMemberPermissions!: Readonly<Permissions> | null;

  /**
   * Whether the command can be used in DMs
   */
  public dmPermission!: boolean | null;

  /**
   * Autoincrementing version identifier
   */
  public version?: Snowflake;

  public constructor(client: Client, data: RawApplicationCommandData, guild?: Guild | null, guildId?: Snowflake | null) {
    super(client);
    this.id = data.id;
    this.applicationId = data.application_id;
    this.guild = guild ?? null;
    this.guildId = guild?.id ?? guildId ?? null;
    this.permissions = new ApplicationCommandPermissionsManager(this);
    this.type = (ApplicationCommandTypes as unknown as Record<number | string, ApplicationCommandType>)[data.type] ?? String(data.type);
    this._patch(data);
  }

  public _patch(data: Partial<RawApplicationCommandData>): void {
    if ('name' in data && data.name !== undefined) {
      this.name = data.name;
    }

    if ('name_localizations' in data) {
      this.nameLocalizations = data.name_localizations ?? null;
    } else {
      this.nameLocalizations ??= null;
    }

    if ('name_localized' in data) {
      this.nameLocalized = data.name_localized ?? null;
    } else {
      this.nameLocalized ??= null;
    }

    if ('description' in data && data.description !== undefined) {
      this.description = data.description;
    }

    if ('description_localizations' in data) {
      this.descriptionLocalizations = data.description_localizations ?? null;
    } else {
      this.descriptionLocalizations ??= null;
    }

    if ('description_localized' in data) {
      this.descriptionLocalized = data.description_localized ?? null;
    } else {
      this.descriptionLocalized ??= null;
    }

    if ('options' in data && data.options !== undefined) {
      this.options = data.options.map(o => ApplicationCommand.transformOption(o, true) as unknown as ApplicationCommandOption);
    } else {
      this.options ??= [];
    }

    if ('default_permission' in data) {
      this.defaultPermission = data.default_permission;
    }

    if ('default_member_permissions' in data) {
      this.defaultMemberPermissions = data.default_member_permissions
        ? new Permissions(BigInt(data.default_member_permissions)).freeze()
        : null;
    } else {
      this.defaultMemberPermissions ??= null;
    }

    if ('dm_permission' in data) {
      this.dmPermission = data.dm_permission ?? null;
    } else {
      this.dmPermission ??= null;
    }

    if ('version' in data && data.version !== undefined) {
      this.version = data.version;
    }
  }

  public get createdTimestamp(): number {
    return SnowflakeUtil.timestampFrom(this.id);
  }

  public get createdAt(): Date {
    return new Date(this.createdTimestamp);
  }

  public get manager(): ApplicationCommandManager {
    return (this.guild ?? (this.client as unknown as { application: { commands: ApplicationCommandManager } }).application).commands;
  }

  public edit(data: Partial<ApplicationCommandData>): Promise<ApplicationCommand> {
    return this.manager.edit(this, data, this.guildId ?? undefined);
  }

  public setName(name: string): Promise<ApplicationCommand> {
    return this.edit({ name });
  }

  public setNameLocalizations(nameLocalizations: Record<string, string>): Promise<ApplicationCommand> {
    return this.edit({ nameLocalizations });
  }

  public setDescription(description: string): Promise<ApplicationCommand> {
    return this.edit({ description });
  }

  public setDescriptionLocalizations(descriptionLocalizations: Record<string, string>): Promise<ApplicationCommand> {
    return this.edit({ descriptionLocalizations });
  }

  public setDefaultPermission(defaultPermission = true): Promise<ApplicationCommand> {
    return this.edit({ defaultPermission });
  }

  public setDefaultMemberPermissions(defaultMemberPermissions: PermissionResolvable | null): Promise<ApplicationCommand> {
    return this.edit({ defaultMemberPermissions });
  }

  public setDMPermission(dmPermission = true): Promise<ApplicationCommand> {
    return this.edit({ dmPermission });
  }

  public setOptions(options: ApplicationCommandOptionData[]): Promise<ApplicationCommand> {
    return this.edit({ options });
  }

  public delete(): Promise<ApplicationCommand | null> {
    return this.manager.delete(this, this.guildId ?? undefined);
  }

  public equals(command: Partial<ApplicationCommandData> & { id?: Snowflake; type?: unknown; version?: Snowflake; autocomplete?: boolean; default_permission?: boolean; default_member_permissions?: unknown; dm_permission?: boolean }, enforceOptionOrder = false): boolean {
    if (command.id && this.id !== command.id) return false;

    let defaultMemberPermissions: bigint | null = null;
    const dmPermission = command.dmPermission ?? command.dm_permission;

    if ('default_member_permissions' in command) {
      defaultMemberPermissions = command.default_member_permissions
        ? new Permissions(BigInt(command.default_member_permissions as string | number | bigint)).bitfield
        : null;
    }

    if ('defaultMemberPermissions' in command) {
      defaultMemberPermissions =
        command.defaultMemberPermissions !== null && command.defaultMemberPermissions !== undefined
          ? new Permissions(command.defaultMemberPermissions).bitfield
          : null;
    }

    const commandType =
      typeof command.type === 'string'
        ? command.type
        : typeof command.type === 'number'
        ? (ApplicationCommandTypes as unknown as Record<number, string>)[command.type]
        : undefined;
    if (
      command.name !== this.name ||
      ('description' in command && command.description !== this.description) ||
      ('version' in command && command.version !== this.version) ||
      ('autocomplete' in command && (command as unknown as { autocomplete: boolean }).autocomplete !== (this as unknown as { autocomplete: boolean }).autocomplete) ||
      (commandType && commandType !== this.type) ||
      defaultMemberPermissions !== (this.defaultMemberPermissions?.bitfield ?? null) ||
      (typeof dmPermission !== 'undefined' && dmPermission !== this.dmPermission) ||
      (command.options?.length ?? 0) !== (this.options?.length ?? 0) ||
      (command.defaultPermission ?? command.default_permission ?? true) !== (this.defaultPermission ?? true)
    ) {
      return false;
    }

    if (command.options) {
      return ApplicationCommand.optionsEqual(this.options as unknown as ApplicationCommandOptionData[], command.options, enforceOptionOrder);
    }
    return true;
  }

  public static optionsEqual(existing: ApplicationCommandOptionData[], options: ApplicationCommandOptionData[], enforceOptionOrder = false): boolean {
    if (existing.length !== options.length) return false;
    if (enforceOptionOrder) {
      return existing.every((option, index) => this._optionEquals(option, options[index], enforceOptionOrder));
    }
    const newOptions = new Map(options.map(option => [option.name, option]));
    for (const option of existing) {
      const foundOption = newOptions.get(option.name);
      if (!foundOption || !this._optionEquals(option, foundOption)) return false;
    }
    return true;
  }

  public static _optionEquals(existing: ApplicationCommandOptionData, option: ApplicationCommandOptionData, enforceOptionOrder = false): boolean {
    const optionType = typeof option.type === 'string' ? option.type : (ApplicationCommandOptionTypes as unknown as Record<number | string, string>)[option.type];
    if (
      option.name !== existing.name ||
      optionType !== existing.type ||
      option.description !== existing.description ||
      option.autocomplete !== existing.autocomplete ||
      (option.required ?? (['SUB_COMMAND', 'SUB_COMMAND_GROUP'].includes(optionType) ? undefined : false)) !==
        existing.required ||
      option.choices?.length !== existing.choices?.length ||
      option.options?.length !== existing.options?.length ||
      (option.channelTypes ?? option.channel_types)?.length !== (existing.channelTypes ?? existing.channel_types)?.length ||
      (option.minValue ?? option.min_value) !== (existing.minValue ?? existing.min_value) ||
      (option.maxValue ?? option.max_value) !== (existing.maxValue ?? existing.max_value) ||
      (option.minLength ?? option.min_length) !== (existing.minLength ?? existing.min_length) ||
      (option.maxLength ?? option.max_length) !== (existing.maxLength ?? existing.max_length)
    ) {
      return false;
    }

    if (existing.choices && option.choices) {
      if (
        enforceOptionOrder &&
        !existing.choices.every(
          (choice, index) => choice.name === option.choices![index].name && choice.value === option.choices![index].value,
        )
      ) {
        return false;
      }
      if (!enforceOptionOrder) {
        const newChoices = new Map(option.choices.map(choice => [choice.name, choice]));
        for (const choice of existing.choices) {
          const foundChoice = newChoices.get(choice.name);
          if (!foundChoice || foundChoice.value !== choice.value) return false;
        }
      }
    }

    if (existing.channelTypes) {
      const rawTypes = option.channelTypes ?? option.channel_types ?? [];
      const newTypes = rawTypes.map(type =>
        typeof type === 'number' ? (ChannelTypes as unknown as Record<number, string>)[type] : type,
      );
      for (const type of existing.channelTypes) {
        if (!newTypes.includes(type)) return false;
      }
    }

    if (existing.options && option.options) {
      return this.optionsEqual(existing.options, option.options, enforceOptionOrder);
    }
    return true;
  }

  public static transformOption(option: ApplicationCommandOptionData | ApplicationCommandOption, received?: boolean): Record<string, unknown> {
    const stringType = typeof option.type === 'string' ? option.type : (ApplicationCommandOptionTypes as unknown as Record<number | string, string>)[option.type];
    const channelTypesKey = received ? 'channelTypes' : 'channel_types';
    const minValueKey = received ? 'minValue' : 'min_value';
    const maxValueKey = received ? 'maxValue' : 'max_value';
    const minLengthKey = received ? 'minLength' : 'min_length';
    const maxLengthKey = received ? 'maxLength' : 'max_length';
    const nameLocalizationsKey = received ? 'nameLocalizations' : 'name_localizations';
    const nameLocalizedKey = received ? 'nameLocalized' : 'name_localized';
    const descriptionLocalizationsKey = received ? 'descriptionLocalizations' : 'description_localizations';
    const descriptionLocalizedKey = received ? 'descriptionLocalized' : 'description_localized';
    const rawOpt = option as ApplicationCommandOptionData;

    return {
      type: typeof option.type === 'number' && !received ? option.type : (ApplicationCommandOptionTypes as unknown as Record<number | string, string>)[option.type],
      name: option.name,
      [nameLocalizationsKey]: rawOpt.nameLocalizations ?? rawOpt.name_localizations,
      [nameLocalizedKey]: rawOpt.nameLocalized ?? rawOpt.name_localized,
      description: option.description,
      [descriptionLocalizationsKey]: rawOpt.descriptionLocalizations ?? rawOpt.description_localizations,
      [descriptionLocalizedKey]: rawOpt.descriptionLocalized ?? rawOpt.description_localized,
      required:
        option.required ?? (stringType === 'SUB_COMMAND' || stringType === 'SUB_COMMAND_GROUP' ? undefined : false),
      autocomplete: option.autocomplete,
      choices: option.choices?.map(choice => ({
        name: choice.name,
        [nameLocalizedKey]: (choice as ApplicationCommandOptionChoiceData).nameLocalized ?? (choice as ApplicationCommandOptionChoiceData).name_localized,
        [nameLocalizationsKey]: (choice as ApplicationCommandOptionChoiceData).nameLocalizations ?? (choice as ApplicationCommandOptionChoiceData).name_localizations,
        value: choice.value,
      })),
      options: option.options?.map(o => this.transformOption(o, received)),
      [channelTypesKey]: received
        ? rawOpt.channel_types?.map(type => typeof type === 'number' ? (ChannelTypes as unknown as Record<number, string>)[type] : type)
        : rawOpt.channelTypes?.map(type => (typeof type === 'string' ? (ChannelTypes as unknown as Record<string, number>)[type] : type)) ??
          rawOpt.channel_types,
      [minValueKey]: rawOpt.minValue ?? rawOpt.min_value,
      [maxValueKey]: rawOpt.maxValue ?? rawOpt.max_value,
      [minLengthKey]: rawOpt.minLength ?? rawOpt.min_length,
      [maxLengthKey]: rawOpt.maxLength ?? rawOpt.max_length,
    };
  }
}

export default ApplicationCommand;
