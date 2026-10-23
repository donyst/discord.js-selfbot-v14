import { Base } from './Base.js';
import {
  InteractionTypes,
  MessageComponentTypes,
  ApplicationCommandTypes,
  type InteractionType,
} from '../util/Constants.js';
import Permissions from '../util/Permissions.js';
import SnowflakeUtil from '../util/SnowflakeUtil.js';
import type { Snowflake } from '../types/index.js';
import type { Client } from '../client/Client.js';
import type { User } from './User.js';
import type { Guild } from './Guild.js';
import type { GuildMember } from './GuildMember.js';
import type { TextBasedChannels } from '../types/index.js';

export interface APIGuildMember {
  user?: unknown;
  roles?: Snowflake[];
  premium_since?: string | null;
  permissions?: string;
  pending?: boolean;
  nick?: string | null;
  mute?: boolean;
  joined_at?: string;
  is_pending?: boolean;
  deaf?: boolean;
  avatar?: string | null;
  communication_disabled_until?: string | null;
  [key: string]: unknown;
}

export interface RawInteractionData {
  id: Snowflake;
  type: number;
  token: string;
  application_id: Snowflake;
  channel_id?: Snowflake | null;
  guild_id?: Snowflake | null;
  user?: unknown;
  member?: APIGuildMember;
  version: number;
  app_permissions?: string;
  locale?: string;
  guild_locale?: string | null;
  data?: unknown;
  [key: string]: unknown;
}

/**
 * Represents an interaction.
 * @extends {Base}
 */
export class Interaction extends Base {
  /**
   * The interaction's type
   */
  public type: InteractionType;

  /**
   * The interaction's id
   */
  public declare id: Snowflake;

  /**
   * The interaction's token
   */
  public readonly token!: string;

  /**
   * The application's id
   */
  public applicationId: Snowflake;

  /**
   * The id of the channel this interaction was sent in
   */
  public channelId: Snowflake | null;

  /**
   * The id of the guild this interaction was sent in
   */
  public guildId: Snowflake | null;

  /**
   * The user which sent this interaction
   */
  public user: User;

  /**
   * If this interaction was sent in a guild, the member which sent it
   */
  public member: GuildMember | APIGuildMember | null;

  /**
   * The version
   */
  public version: number;

  /**
   * Set of permissions the application or bot has within the channel the interaction was sent from
   */
  public appPermissions: Readonly<Permissions> | null;

  /**
   * The permissions of the member, if one exists, in the channel this interaction was executed in
   */
  public memberPermissions: Readonly<Permissions> | null;

  /**
   * The locale of the user who invoked this interaction
   */
  public locale?: string;

  /**
   * The preferred locale from the guild this interaction was sent in
   */
  public guildLocale: string | null;

  // Subclass fields checked in type guards
  public targetId?: Snowflake;
  public targetType?: string | number;
  public componentType?: string | number;

  public constructor(client: Client, data: RawInteractionData) {
    super(client);

    this.type = (InteractionTypes[data.type] as InteractionType) ?? 'PING';
    this.id = data.id;

    Object.defineProperty(this, 'token', { value: data.token });

    this.applicationId = data.application_id;
    this.channelId = data.channel_id ?? null;
    this.guildId = data.guild_id ?? null;

    const userAdd = this.client.users as unknown as { _add(user: unknown): User };
    this.user = userAdd._add(data.user ?? data.member?.user);

    if (data.member) {
      const guild = this.guild as unknown as { members?: { _add(member: unknown): GuildMember } } | null;
      this.member = guild?.members?._add(data.member) ?? data.member;
    } else {
      this.member = null;
    }

    this.version = data.version;
    this.appPermissions = data.app_permissions ? new Permissions(BigInt(data.app_permissions)).freeze() : null;
    this.memberPermissions = data.member?.permissions ? new Permissions(BigInt(data.member.permissions)).freeze() : null;
    this.locale = data.locale;
    this.guildLocale = data.guild_locale ?? null;
  }

  /**
   * The timestamp the interaction was created at
   */
  public get createdTimestamp(): number {
    return SnowflakeUtil.timestampFrom(this.id);
  }

  /**
   * The time the interaction was created at
   */
  public get createdAt(): Date {
    return new Date(this.createdTimestamp);
  }

  /**
   * The channel this interaction was sent in
   */
  public get channel(): TextBasedChannels | null {
    return (this.client.channels.cache.get(this.channelId ?? '') as unknown as TextBasedChannels) ?? null;
  }

  /**
   * The guild this interaction was sent in
   */
  public get guild(): Guild | null {
    return (this.client.guilds.cache.get(this.guildId ?? '') as unknown as Guild) ?? null;
  }

  /**
   * Indicates whether this interaction is received from a guild.
   */
  public inGuild(): boolean {
    return Boolean(this.guildId && this.member);
  }

  /**
   * Indicates whether or not this interaction is both cached and received from a guild.
   */
  public inCachedGuild(): boolean {
    return Boolean(this.guild && this.member);
  }

  /**
   * Indicates whether or not this interaction is received from an uncached guild.
   */
  public inRawGuild(): boolean {
    return Boolean(this.guildId && !this.guild && this.member);
  }

  /**
   * Indicates whether this interaction is a BaseCommandInteraction.
   */
  public isApplicationCommand(): boolean {
    return (InteractionTypes as Record<string, number>)[this.type] === InteractionTypes.APPLICATION_COMMAND;
  }

  /**
   * Indicates whether this interaction is a CommandInteraction.
   */
  public isCommand(): boolean {
    return (
      (InteractionTypes as Record<string, number>)[this.type] === InteractionTypes.APPLICATION_COMMAND &&
      typeof this.targetId === 'undefined'
    );
  }

  /**
   * Indicates whether this interaction is a ContextMenuInteraction.
   */
  public isContextMenu(): boolean {
    return (
      (InteractionTypes as Record<string, number>)[this.type] === InteractionTypes.APPLICATION_COMMAND &&
      typeof this.targetId !== 'undefined'
    );
  }

  /**
   * Indicates whether this interaction is a ModalSubmitInteraction.
   */
  public isModalSubmit(): boolean {
    return (InteractionTypes as Record<string, number>)[this.type] === InteractionTypes.MODAL_SUBMIT;
  }

  /**
   * Indicates whether this interaction is a UserContextMenuInteraction.
   */
  public isUserContextMenu(): boolean {
    return (
      this.isContextMenu() &&
      (ApplicationCommandTypes as Record<string, number>)[String(this.targetType)] === ApplicationCommandTypes.USER
    );
  }

  /**
   * Indicates whether this interaction is a MessageContextMenuInteraction.
   */
  public isMessageContextMenu(): boolean {
    return (
      this.isContextMenu() &&
      (ApplicationCommandTypes as Record<string, number>)[String(this.targetType)] === ApplicationCommandTypes.MESSAGE
    );
  }

  /**
   * Indicates whether this interaction is an AutocompleteInteraction.
   */
  public isAutocomplete(): boolean {
    return (InteractionTypes as Record<string, number>)[this.type] === InteractionTypes.APPLICATION_COMMAND_AUTOCOMPLETE;
  }

  /**
   * Indicates whether this interaction is a MessageComponentInteraction.
   */
  public isMessageComponent(): boolean {
    return (InteractionTypes as Record<string, number>)[this.type] === InteractionTypes.MESSAGE_COMPONENT;
  }

  /**
   * Indicates whether this interaction is a ButtonInteraction.
   */
  public isButton(): boolean {
    return (
      (InteractionTypes as Record<string, number>)[this.type] === InteractionTypes.MESSAGE_COMPONENT &&
      (MessageComponentTypes as Record<string, number>)[String(this.componentType)] === MessageComponentTypes.BUTTON
    );
  }

  /**
   * Indicates whether this interaction is a SelectMenuInteraction.
   */
  public isSelectMenu(): boolean {
    return (
      (InteractionTypes as Record<string, number>)[this.type] === InteractionTypes.MESSAGE_COMPONENT &&
      (MessageComponentTypes as Record<string, number>)[String(this.componentType)] === MessageComponentTypes.SELECT_MENU
    );
  }

  /**
   * Indicates whether this interaction can be replied to.
   */
  public isRepliable(): boolean {
    const numericType = (InteractionTypes as Record<string, number>)[this.type];
    return ![InteractionTypes.PING, InteractionTypes.APPLICATION_COMMAND_AUTOCOMPLETE].includes(numericType);
  }
}

export default Interaction;
