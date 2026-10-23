import { DiscordjsTypeError as DJSTypeError } from '../errors/index.js';
import type { Client } from '../client/Client.js';
import type {
  CommandInteractionOption,
  CommandInteractionResolvedData,
} from './BaseCommandInteraction.js';
import type { ApplicationCommandOptionType } from '../util/Constants.js';
import type { User } from './User.js';
import type { GuildMember } from './GuildMember.js';
import type { Role } from './Role.js';
import type { Channel } from './Channel.js';
import type { Message } from './Message.js';
import type { MessageAttachment } from './MessageAttachment.js';
import type { APIGuildMember } from './Interaction.js';

export interface AutocompleteFocusedOption {
  name: string;
  type: ApplicationCommandOptionType;
  value: string;
  focused: boolean;
}

export interface ExtendedCommandInteractionOption extends CommandInteractionOption {
  focused?: boolean;
  message?: Message | unknown;
}

/**
 * A resolver for command interaction options.
 */
export class CommandInteractionOptionResolver {
  public readonly client: Client;
  private _group: string | null = null;
  private _subcommand: string | null = null;
  private _hoistedOptions: ExtendedCommandInteractionOption[];
  public readonly data: ReadonlyArray<CommandInteractionOption>;
  public readonly resolved: Readonly<CommandInteractionResolvedData>;

  public constructor(
    client: Client,
    options: CommandInteractionOption[],
    resolved: CommandInteractionResolvedData,
  ) {
    this.client = client;
    Object.defineProperty(this, 'client', { value: client });

    this._hoistedOptions = [...(options as ExtendedCommandInteractionOption[])];

    // Hoist subcommand group if present
    if (this._hoistedOptions[0]?.type === 'SUB_COMMAND_GROUP') {
      this._group = this._hoistedOptions[0].name;
      this._hoistedOptions = (this._hoistedOptions[0].options as ExtendedCommandInteractionOption[]) ?? [];
    }
    // Hoist subcommand if present
    if (this._hoistedOptions[0]?.type === 'SUB_COMMAND') {
      this._subcommand = this._hoistedOptions[0].name;
      this._hoistedOptions = (this._hoistedOptions[0].options as ExtendedCommandInteractionOption[]) ?? [];
    }

    this.data = Object.freeze([...options]);
    this.resolved = Object.freeze(resolved);
    Object.defineProperty(this, 'data', { value: Object.freeze([...options]) });
    Object.defineProperty(this, 'resolved', { value: Object.freeze(resolved) });
  }

  /**
   * Gets an option by its name.
   */
  public get(name: string, required: boolean = false): ExtendedCommandInteractionOption | null {
    const option = this._hoistedOptions.find(opt => opt.name === name);
    if (!option) {
      if (required) {
        throw new DJSTypeError('COMMAND_INTERACTION_OPTION_NOT_FOUND', name);
      }
      return null;
    }
    return option;
  }

  /**
   * Gets an option by name and property and checks its type.
   * @private
   */
  public _getTypedOption(
    name: string,
    type: ApplicationCommandOptionType | '_MESSAGE',
    properties: (keyof ExtendedCommandInteractionOption)[],
    required: boolean,
  ): ExtendedCommandInteractionOption | null {
    const option = this.get(name, required);
    if (!option) {
      return null;
    } else if ((option.type as string) !== type) {
      throw new DJSTypeError('COMMAND_INTERACTION_OPTION_TYPE', name, option.type, type);
    } else if (
      required &&
      properties.every(prop => option[prop] === null || typeof option[prop] === 'undefined')
    ) {
      throw new DJSTypeError('COMMAND_INTERACTION_OPTION_EMPTY', name, option.type);
    }
    return option;
  }

  /**
   * Gets the selected subcommand.
   */
  public getSubcommand(required: boolean = true): string | null {
    if (required && !this._subcommand) {
      throw new DJSTypeError('COMMAND_INTERACTION_OPTION_NO_SUB_COMMAND');
    }
    return this._subcommand;
  }

  /**
   * Gets the selected subcommand group.
   */
  public getSubcommandGroup(required: boolean = true): string | null {
    if (required && !this._group) {
      throw new DJSTypeError('COMMAND_INTERACTION_OPTION_NO_SUB_COMMAND_GROUP');
    }
    return this._group;
  }

  /**
   * Gets a boolean option.
   */
  public getBoolean(name: string, required: boolean = false): boolean | null {
    const option = this._getTypedOption(name, 'BOOLEAN', ['value'], required);
    return (option?.value as boolean | undefined) ?? null;
  }

  /**
   * Gets a channel option.
   */
  public getChannel(name: string, required: boolean = false): Channel | unknown | null {
    const option = this._getTypedOption(name, 'CHANNEL', ['channel'], required);
    return option?.channel ?? null;
  }

  /**
   * Gets a string option.
   */
  public getString(name: string, required: boolean = false): string | null {
    const option = this._getTypedOption(name, 'STRING', ['value'], required);
    return (option?.value as string | undefined) ?? null;
  }

  /**
   * Gets an integer option.
   */
  public getInteger(name: string, required: boolean = false): number | null {
    const option = this._getTypedOption(name, 'INTEGER', ['value'], required);
    return (option?.value as number | undefined) ?? null;
  }

  /**
   * Gets a number option.
   */
  public getNumber(name: string, required: boolean = false): number | null {
    const option = this._getTypedOption(name, 'NUMBER', ['value'], required);
    return (option?.value as number | undefined) ?? null;
  }

  /**
   * Gets a user option.
   */
  public getUser(name: string, required: boolean = false): User | null {
    const option = this._getTypedOption(name, 'USER', ['user'], required);
    return option?.user ?? null;
  }

  /**
   * Gets a member option.
   */
  public getMember(name: string, required: boolean = false): GuildMember | APIGuildMember | null {
    const option = this._getTypedOption(name, 'USER', ['member'], required);
    return option?.member ?? null;
  }

  /**
   * Gets a role option.
   */
  public getRole(name: string, required: boolean = false): Role | unknown | null {
    const option = this._getTypedOption(name, 'ROLE', ['role'], required);
    return option?.role ?? null;
  }

  /**
   * Gets a mentionable option.
   */
  public getMentionable(
    name: string,
    required: boolean = false,
  ): User | GuildMember | APIGuildMember | Role | unknown | null {
    const option = this._getTypedOption(name, 'MENTIONABLE', ['user', 'member', 'role'], required);
    return option?.member ?? option?.user ?? option?.role ?? null;
  }

  /**
   * Gets a message option.
   */
  public getMessage(name: string, required: boolean = false): Message | unknown | null {
    const option = this._getTypedOption(name, '_MESSAGE', ['message'], required);
    return option?.message ?? null;
  }

  /**
   * Gets the focused option.
   */
  public getFocused(getFull?: false): string;
  public getFocused(getFull: true): AutocompleteFocusedOption;
  public getFocused(getFull: boolean = false): string | AutocompleteFocusedOption {
    const focusedOption = this._hoistedOptions.find(option => option.focused);
    if (!focusedOption) throw new DJSTypeError('AUTOCOMPLETE_INTERACTION_OPTION_NO_FOCUSED_OPTION');
    return getFull ? (focusedOption as unknown as AutocompleteFocusedOption) : String(focusedOption.value);
  }

  /**
   * Gets an attachment option.
   */
  public getAttachment(name: string, required: boolean = false): MessageAttachment | null {
    const option = this._getTypedOption(name, 'ATTACHMENT', ['attachment'], required);
    return option?.attachment ?? null;
  }
}

export default CommandInteractionOptionResolver;
