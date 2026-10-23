import { Collection } from '@discordjs/collection';
import { Interaction, type APIGuildMember } from './Interaction.js';
import { InteractionWebhook } from './InteractionWebhook.js';
import { MessageAttachment, type APIAttachment } from './MessageAttachment.js';
import {
  InteractionResponses,
  type InteractionDeferReplyOptions,
  type InteractionReplyOptions,
  type InteractionEditReplyOptions,
  type AwaitModalSubmitOptions,
} from './interfaces/InteractionResponses.js';
import { ApplicationCommandOptionTypes, type ApplicationCommandOptionType } from '../util/Constants.js';
import type { Snowflake } from '../types/index.js';
import type { Client } from '../client/Client.js';
import type { User } from './User.js';
import type { GuildMember } from './GuildMember.js';
import type { Role } from './Role.js';
import type { Channel } from './Channel.js';
import type { Message } from './Message.js';
import type { ApplicationCommand } from './ApplicationCommand.js';
import type { ModalSubmitInteraction } from './ModalSubmitInteraction.js';
import type { MessagePayload } from './MessagePayload.js';

export interface CommandInteractionResolvedData {
  users?: Collection<Snowflake, User>;
  members?: Collection<Snowflake, GuildMember | APIGuildMember>;
  roles?: Collection<Snowflake, Role | unknown>;
  channels?: Collection<Snowflake, Channel | unknown>;
  messages?: Collection<Snowflake, Message | unknown>;
  attachments?: Collection<Snowflake, MessageAttachment>;
}

export interface CommandInteractionOption {
  name: string;
  type: ApplicationCommandOptionType;
  autocomplete?: boolean;
  value?: string | number | boolean;
  options?: CommandInteractionOption[];
  user?: User;
  member?: GuildMember | APIGuildMember;
  channel?: Channel | unknown;
  role?: Role | unknown;
  attachment?: MessageAttachment;
}

export interface APIInteractionDataResolved {
  users?: Record<Snowflake, unknown>;
  members?: Record<Snowflake, unknown>;
  roles?: Record<Snowflake, unknown>;
  channels?: Record<Snowflake, unknown>;
  messages?: Record<Snowflake, unknown>;
  attachments?: Record<Snowflake, APIAttachment>;
}

export interface APIApplicationCommandOption {
  name: string;
  type: number;
  value?: string | number | boolean;
  options?: APIApplicationCommandOption[];
  [key: string]: unknown;
}

export interface RawBaseCommandInteractionData {
  id: Snowflake;
  type: number;
  token: string;
  application_id: Snowflake;
  channel_id?: Snowflake;
  guild_id?: Snowflake;
  user?: unknown;
  member?: APIGuildMember;
  version: number;
  app_permissions?: string;
  locale?: string;
  guild_locale?: string;
  data: {
    id: Snowflake;
    name: string;
    resolved?: APIInteractionDataResolved;
    options?: APIApplicationCommandOption[];
    target_id?: Snowflake;
    type?: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * Represents a command interaction.
 * @extends {Interaction}
 * @implements {InteractionResponses}
 * @abstract
 */
export abstract class BaseCommandInteraction extends Interaction {
  /**
   * The invoked application command's id
   */
  public commandId: Snowflake;

  /**
   * The invoked application command's name
   */
  public commandName: string;

  /**
   * Whether the reply to this interaction has been deferred
   */
  public deferred: boolean = false;

  /**
   * Whether this interaction has already been replied to
   */
  public replied: boolean = false;

  /**
   * Whether the reply to this interaction is ephemeral
   */
  public ephemeral: boolean | null = null;

  /**
   * An associated interaction webhook, can be used to further interact with this interaction
   */
  public webhook: InteractionWebhook;

  public constructor(client: Client, data: RawBaseCommandInteractionData) {
    super(client, data);

    this.commandId = data.data.id;
    this.commandName = data.data.name;
    this.webhook = new InteractionWebhook(this.client, this.applicationId, this.token);
  }

  /**
   * The invoked application command, if it was fetched before
   */
  public get command(): ApplicationCommand | null {
    const id = this.commandId;
    const clientApp = (this.client as unknown as { application?: { commands?: { cache: Collection<Snowflake, ApplicationCommand> } } }).application;
    return (
      (this.guild?.commands?.cache.get(id) as ApplicationCommand | undefined) ??
      clientApp?.commands?.cache.get(id) ??
      null
    );
  }

  /**
   * Transforms the resolved received from the API.
   * @private
   */
  public transformResolved(resolved: APIInteractionDataResolved): CommandInteractionResolvedData {
    const { members, users, channels, roles, messages, attachments } = resolved;
    const result: CommandInteractionResolvedData = {};

    if (members) {
      result.members = new Collection();
      for (const [id, member] of Object.entries(members)) {
        const user = users?.[id];
        const guildMembers = this.guild?.members as unknown as { _add(data: unknown): GuildMember } | undefined;
        result.members.set(
          id,
          guildMembers?._add(Object.assign({ user }, member as Record<string, unknown>)) ?? (member as APIGuildMember),
        );
      }
    }

    if (users) {
      result.users = new Collection();
      const clientUsers = this.client.users as unknown as { _add(user: unknown): User };
      for (const user of Object.values(users)) {
        const u = clientUsers._add(user);
        result.users.set(u.id, u);
      }
    }

    if (roles) {
      result.roles = new Collection();
      const guildRoles = this.guild?.roles as unknown as { _add(role: unknown): Role } | undefined;
      for (const role of Object.values(roles)) {
        const r = (role as { id: Snowflake });
        result.roles.set(r.id, guildRoles?._add(role) ?? role);
      }
    }

    if (channels) {
      result.channels = new Collection();
      const clientChannels = this.client.channels as unknown as { _add(ch: unknown, guild?: unknown): Channel };
      for (const channel of Object.values(channels)) {
        const ch = (channel as { id: Snowflake });
        result.channels.set(ch.id, clientChannels._add(channel, this.guild) ?? channel);
      }
    }

    if (messages) {
      result.messages = new Collection();
      const chMessages = (this.channel as unknown as { messages?: { _add(m: unknown): Message } } | null)?.messages;
      for (const message of Object.values(messages)) {
        const msg = (message as { id: Snowflake });
        result.messages.set(msg.id, chMessages?._add(message) ?? message);
      }
    }

    if (attachments) {
      result.attachments = new Collection();
      for (const attachment of Object.values(attachments)) {
        if (attachment.id) {
          const patched = new MessageAttachment(attachment.url, attachment.filename as string | undefined, attachment);
          result.attachments.set(attachment.id, patched);
        }
      }
    }

    return result;
  }

  /**
   * Transforms an option received from the API.
   * @private
   */
  public transformOption(
    option: APIApplicationCommandOption,
    resolved?: APIInteractionDataResolved,
  ): CommandInteractionOption {
    const result: CommandInteractionOption = {
      name: option.name,
      type: (ApplicationCommandOptionTypes[option.type] as ApplicationCommandOptionType) ?? 'STRING',
    };

    if ('value' in option) result.value = option.value;
    if ('options' in option && option.options) {
      result.options = option.options.map(opt => this.transformOption(opt, resolved));
    }

    if (resolved && option.value !== undefined) {
      const key = String(option.value);
      const user = resolved.users?.[key];
      if (user) {
        result.user = (this.client.users as unknown as { _add(u: unknown): User })._add(user);
      }

      const member = resolved.members?.[key];
      if (member) {
        const guildMembers = this.guild?.members as unknown as { _add(m: unknown): GuildMember } | undefined;
        result.member =
          guildMembers?._add(Object.assign({ user }, member as Record<string, unknown>)) ?? (member as APIGuildMember);
      }

      const channel = resolved.channels?.[key];
      if (channel) {
        result.channel =
          (this.client.channels as unknown as { _add(ch: unknown, g?: unknown): Channel })._add(
            channel,
            this.guild,
          ) ?? channel;
      }

      const role = resolved.roles?.[key];
      if (role) {
        result.role = (this.guild?.roles as unknown as { _add(r: unknown): Role } | undefined)?._add(role) ?? role;
      }

      const attachment = resolved.attachments?.[key];
      if (attachment) {
        result.attachment = new MessageAttachment(attachment.url, attachment.filename as string | undefined, attachment);
      }
    }

    return result;
  }

  /* eslint-disable @typescript-eslint/no-empty-function */
  public deferReply(_options?: InteractionDeferReplyOptions): Promise<Message | Record<string, unknown>> {
    throw new Error('Method not implemented.');
  }

  public reply(_options: string | MessagePayload | InteractionReplyOptions): Promise<Message | Record<string, unknown>> {
    throw new Error('Method not implemented.');
  }

  public fetchReply(): Promise<Message> {
    throw new Error('Method not implemented.');
  }

  public editReply(
    _options: string | MessagePayload | InteractionEditReplyOptions,
  ): Promise<Message | Record<string, unknown>> {
    throw new Error('Method not implemented.');
  }

  public deleteReply(): Promise<void> {
    throw new Error('Method not implemented.');
  }

  public followUp(_options: string | MessagePayload | InteractionReplyOptions): Promise<Message | Record<string, unknown>> {
    throw new Error('Method not implemented.');
  }

  public showModal(_modal: unknown): Promise<void> {
    throw new Error('Method not implemented.');
  }

  public awaitModalSubmit(_options: AwaitModalSubmitOptions): Promise<ModalSubmitInteraction> {
    throw new Error('Method not implemented.');
  }
}

InteractionResponses.applyToClass(BaseCommandInteraction, ['deferUpdate', 'update']);

export default BaseCommandInteraction;
