import process from 'node:process';
import { Collection } from '@discordjs/collection';
import { Base } from './Base.js';
import { BaseMessageComponent, type AnyComponent } from './BaseMessageComponent.js';
import { MessageAttachment, type APIAttachment } from './MessageAttachment.js';
import { MessageEmbed, type APIEmbed, type MessageEmbedOptions } from './MessageEmbed.js';
import { MessageMentions, type APIMentionUser } from './MessageMentions.js';
import { MessagePayload, type MessageFile, type MessageTarget } from './MessagePayload.js';
import { Poll, type RawPollData } from './Poll.js';
import { ReactionCollector, type ReactionCollectorOptions } from './ReactionCollector.js';
import { Sticker, type APIStickerData } from './Sticker.js';
import { Application } from './interfaces/Application.js';
import { DiscordjsError as DJSError, DiscordjsTypeError as DJSTypeError, DiscordjsRangeError as DJSRangeError } from '../errors/index.js';
import { ReactionManager } from '../managers/ReactionManager.js';
import {
  InteractionTypes,
  MessageTypes,
  SystemMessageTypes,
  MessageComponentTypes,
  MessageReferenceTypes,
  type MessageType,
  type InteractionType,
  type MessageReferenceType,
} from '../util/Constants.js';
import MessageFlags from '../util/MessageFlags.js';
import Permissions from '../util/Permissions.js';
import SnowflakeUtil from '../util/SnowflakeUtil.js';
import Util, { type EmojiIdentifierResolvable } from '../util/Util.js';
import type { Snowflake } from '../types/index.js';
import type { Client } from '../client/Client.js';
import type { Guild } from './Guild.js';
import type { GuildMember } from './GuildMember.js';
import type { ThreadChannel } from './ThreadChannel.js';
import type { MessageReaction } from './MessageReaction.js';
import type { Webhook } from './Webhook.js';
import type { User } from './User.js';
import type { TextBasedChannels, TextBasedChannelResolvable, UserResolvable, RoleResolvable, ChannelResolvable } from '../types/index.js';
import type { MessageActionRow, MessageActionRowComponent } from './MessageActionRow.js';

export const deletedMessages = new WeakSet<Message>();
let deprecationEmittedForDeleted = false;

export type TopLevelComponent =
  | MessageActionRow
  | AnyComponent;

export interface MessageActivity {
  partyId?: string;
  type?: number;
}

export interface MessageReference {
  channelId: Snowflake;
  guildId: Snowflake | null;
  messageId: Snowflake | null;
  type: MessageReferenceType;
}

export interface MessageInteraction {
  id: Snowflake;
  type: InteractionType;
  commandName: string;
  user: User;
}

export interface MessageCall {
  endedTimestamp: number | null;
  participants: Snowflake[];
  readonly endedAt: Date | null;
}

export interface AwaitReactionsOptions extends ReactionCollectorOptions {
  errors?: string[];
}

export interface MessageEditOptions {
  content?: string | null;
  embeds?: (MessageEmbed | APIEmbed | MessageEmbedOptions)[];
  allowedMentions?: unknown;
  flags?: MessageFlags | number;
  attachments?: (MessageAttachment | APIAttachment)[];
  files?: (MessageFile | MessageAttachment | unknown)[];
  components?: TopLevelComponent[];
}

export interface ReplyMessageOptions {
  content?: string;
  embeds?: (MessageEmbed | APIEmbed | MessageEmbedOptions)[];
  allowedMentions?: unknown;
  flags?: MessageFlags | number;
  files?: (MessageFile | MessageAttachment | unknown)[];
  components?: TopLevelComponent[];
  failIfNotExists?: boolean;
  stickers?: (Sticker | Snowflake)[];
  reply?: unknown;
}

export interface StartThreadOptions {
  name: string;
  autoArchiveDuration?: number | 'MAX';
  reason?: string;
  rateLimitPerUser?: number;
}

export interface RawMessageData {
  id: Snowflake;
  channel_id: Snowflake;
  guild_id?: Snowflake;
  author?: APIMentionUser & { webhook_id?: Snowflake; [key: string]: unknown };
  content?: string;
  timestamp: string | number;
  edited_timestamp?: string | null;
  tts?: boolean;
  mention_everyone?: boolean;
  mentions?: APIMentionUser[];
  mention_roles?: Snowflake[];
  mention_channels?: { id: Snowflake; guild_id: Snowflake; type: number; name: string }[];
  attachments?: APIAttachment[];
  embeds?: APIEmbed[];
  reactions?: unknown[];
  nonce?: string | number;
  pinned?: boolean;
  webhook_id?: Snowflake;
  type?: number;
  activity?: { party_id?: string; type: number };
  application?: unknown;
  application_id?: Snowflake;
  message_reference?: {
    channel_id: Snowflake;
    guild_id?: Snowflake;
    message_id?: Snowflake;
    type?: number;
  };
  flags?: number;
  referenced_message?: RawMessageData | null;
  interaction?: {
    id: Snowflake;
    type: number;
    name: string;
    user: APIMentionUser;
  };
  thread?: unknown;
  components?: unknown[];
  sticker_items?: APIStickerData[];
  stickers?: APIStickerData[];
  position?: number;
  poll?: RawPollData;
  call?: {
    ended_timestamp?: string | null;
    participants: Snowflake[];
  };
  member?: unknown;
  message_snapshots?: { message: RawMessageData }[];
  [key: string]: unknown;
}

/**
 * Represents a message on Discord.
 * @extends {Base}
 */
export class Message extends Base {
  public channelId: Snowflake;
  public guildId: Snowflake | null;
  public declare id: Snowflake;
  public position: number | null = null;
  public createdTimestamp!: number;
  public type: MessageType | null = null;
  public system: boolean | null = null;
  public content: string | null = null;
  public author: User | null = null;
  public pinned: boolean | null = null;
  public tts: boolean | null = null;
  public nonce: string | number | null = null;
  public embeds: MessageEmbed[] = [];
  public components: TopLevelComponent[] = [];
  public attachments: Collection<Snowflake, MessageAttachment> = new Collection();
  public stickers: Collection<Snowflake, Sticker> = new Collection();
  public editedTimestamp: number | null = null;
  public reactions!: ReactionManager;
  public mentions!: MessageMentions;
  public webhookId: Snowflake | null = null;
  public poll: Poll | null = null;
  public groupActivityApplication: Application | null = null;
  public applicationId: Snowflake | null = null;
  public activity: MessageActivity | null = null;
  public flags!: Readonly<MessageFlags>;
  public reference: MessageReference | null = null;
  public interaction: MessageInteraction | null = null;
  public messageSnapshots: Collection<Snowflake, Message> = new Collection();
  public call: MessageCall | null = null;

  public constructor(client: Client, data: RawMessageData) {
    super(client);

    this.channelId = data.channel_id;
    this.guildId = data.guild_id ?? (this.channel as unknown as { guild?: { id?: Snowflake } } | null)?.guild?.id ?? null;

    this._patch(data);
  }

  public _patch(data: RawMessageData): void {
    this.id = data.id;

    if ('position' in data) {
      this.position = data.position ?? null;
    } else {
      this.position ??= null;
    }

    this.createdTimestamp = this.id ? SnowflakeUtil.timestampFrom(this.id) : new Date(data.timestamp).getTime();

    if ('type' in data && data.type !== undefined) {
      this.type = (MessageTypes[data.type] as MessageType) ?? null;
      this.system = SystemMessageTypes.includes(this.type as unknown as (typeof SystemMessageTypes)[number]);
    } else {
      this.system ??= null;
      this.type ??= null;
    }

    if ('content' in data) {
      this.content = data.content ?? null;
    } else {
      this.content ??= null;
    }

    if ('author' in data && data.author) {
      const userAdd = this.client.users as unknown as { _add(user: unknown, cache?: boolean): User };
      this.author = userAdd._add(data.author, !data.webhook_id);
    } else {
      this.author ??= null;
    }

    if ('pinned' in data) {
      this.pinned = Boolean(data.pinned);
    } else {
      this.pinned ??= null;
    }

    if ('tts' in data) {
      this.tts = Boolean(data.tts);
    } else {
      this.tts ??= null;
    }

    if ('nonce' in data) {
      this.nonce = data.nonce ?? null;
    } else {
      this.nonce ??= null;
    }

    if ('embeds' in data) {
      this.embeds = (data.embeds ?? []).map(e => new MessageEmbed(e, true));
    } else {
      this.embeds = this.embeds?.slice() ?? [];
    }

    if ('components' in data) {
      this.components = (data.components ?? []).map(c =>
        BaseMessageComponent.create(c as Parameters<typeof BaseMessageComponent.create>[0], this.client),
      ) as TopLevelComponent[];
    } else {
      this.components = this.components?.slice() ?? [];
    }

    if ('attachments' in data) {
      this.attachments = new Collection<Snowflake, MessageAttachment>();
      if (data.attachments) {
        for (const attachment of data.attachments) {
          if (attachment.id) {
            this.attachments.set(
              attachment.id,
              new MessageAttachment(attachment.url, attachment.filename as string | undefined, attachment),
            );
          }
        }
      }
    } else {
      this.attachments = new Collection(this.attachments);
    }

    if ('sticker_items' in data || 'stickers' in data) {
      const stickerList = data.sticker_items ?? data.stickers ?? [];
      this.stickers = new Collection(stickerList.map(s => [s.id, new Sticker(this.client, s)]));
    } else {
      this.stickers = new Collection(this.stickers);
    }

    if (data.edited_timestamp) {
      this.editedTimestamp = Date.parse(data.edited_timestamp);
    } else {
      this.editedTimestamp ??= null;
    }

    if ('reactions' in data) {
      this.reactions = new ReactionManager(this);
      if (data.reactions && data.reactions.length > 0) {
        for (const reaction of data.reactions) {
          this.reactions._add(reaction as Parameters<typeof this.reactions._add>[0]);
        }
      }
    } else {
      this.reactions ??= new ReactionManager(this);
    }

    if (!this.mentions) {
      this.mentions = new MessageMentions(
        this,
        data.mentions,
        data.mention_roles,
        data.mention_everyone,
        data.mention_channels as unknown as import('./MessageMentions.js').APICrosspostedChannel[],
        data.referenced_message?.author,
      );
    } else {
      this.mentions = new MessageMentions(
        this,
        data.mentions ?? (this.mentions.users as unknown as APIMentionUser[]),
        data.mention_roles ?? (this.mentions.roles as unknown as Snowflake[]),
        data.mention_everyone ?? this.mentions.everyone,
        (data.mention_channels as unknown as import('./MessageMentions.js').APICrosspostedChannel[]) ?? this.mentions.crosspostedChannels,
        data.referenced_message?.author ?? this.mentions.repliedUser,
      );
    }

    if ('webhook_id' in data) {
      this.webhookId = data.webhook_id ?? null;
    } else {
      this.webhookId ??= null;
    }

    if (data.poll) {
      this.poll = new Poll(this.client, data.poll, this);
    } else {
      this.poll ??= null;
    }

    if ('application' in data && data.application) {
      this.groupActivityApplication = new Application(this.client, data.application as unknown as import('./interfaces/Application.js').RawApplicationData);
    } else {
      this.groupActivityApplication ??= null;
    }

    if ('application_id' in data) {
      this.applicationId = data.application_id ?? null;
    } else {
      this.applicationId ??= null;
    }

    if ('activity' in data && data.activity) {
      this.activity = {
        partyId: data.activity.party_id,
        type: data.activity.type,
      };
    } else {
      this.activity ??= null;
    }

    if ('thread' in data && data.thread) {
      (this.client.channels as unknown as { _add(thread: unknown, guild?: unknown): unknown })._add(
        data.thread,
        this.guild,
      );
    }

    if (this.member && data.member) {
      (this.member as unknown as { _patch(member: unknown): void })._patch(data.member);
    } else if (data.member && this.guild && this.author) {
      (this.guild.members as unknown as { _add(data: unknown): unknown })._add(
        Object.assign(data.member as Record<string, unknown>, { user: this.author }),
      );
    }

    if ('flags' in data && data.flags !== undefined) {
      this.flags = new MessageFlags(data.flags).freeze();
    } else {
      this.flags = new MessageFlags(this.flags).freeze();
    }

    if ('message_reference' in data && data.message_reference) {
      this.reference = {
        channelId: data.message_reference.channel_id,
        guildId: data.message_reference.guild_id ?? null,
        messageId: data.message_reference.message_id ?? null,
        type: (MessageReferenceTypes[data.message_reference.type ?? 0] as MessageReferenceType) ?? 'DEFAULT',
      };
    } else {
      this.reference ??= null;
    }

    if (data.referenced_message && this.channel) {
      const channelMessages = (this.channel as unknown as { messages?: { _add(data: unknown): Message } }).messages;
      channelMessages?._add({
        guild_id: data.message_reference?.guild_id,
        ...data.referenced_message,
      });
    }

    if (data.interaction) {
      const userAdd = this.client.users as unknown as { _add(user: unknown): User };
      this.interaction = {
        id: data.interaction.id,
        type: (InteractionTypes[data.interaction.type] as InteractionType) ?? 'PING',
        commandName: data.interaction.name,
        user: userAdd._add(data.interaction.user),
      };
    } else {
      this.interaction ??= null;
    }

    if (data.message_snapshots && this.reference) {
      this.messageSnapshots = data.message_snapshots.reduce((coll, snapshot) => {
        const channel = this.client.channels.cache.get(this.reference!.channelId);
        const snapshotData = {
          ...snapshot.message,
          id: this.reference!.messageId!,
          channel_id: this.reference!.channelId,
          guild_id: this.reference!.guildId,
        };
        const resolvedMsg = channel
          ? (channel as unknown as { messages: { _add(data: unknown): Message } }).messages._add(snapshotData)
          : new (this.constructor as new (client: Client, data: RawMessageData) => Message)(this.client, snapshotData as unknown as RawMessageData);
        return coll.set(this.reference!.messageId!, resolvedMsg);
      }, new Collection<Snowflake, Message>());
    } else {
      this.messageSnapshots ??= new Collection();
    }

    if (data.call) {
      const endedTimestamp = data.call.ended_timestamp ? Date.parse(data.call.ended_timestamp) : null;
      this.call = {
        endedTimestamp,
        participants: data.call.participants,
        get endedAt(): Date | null {
          return this.endedTimestamp ? new Date(this.endedTimestamp) : null;
        },
      };
    } else {
      this.call ??= null;
    }
  }

  public get deleted(): boolean {
    if (!deprecationEmittedForDeleted) {
      deprecationEmittedForDeleted = true;
      process.emitWarning(
        'Message#deleted is deprecated, see https://github.com/discordjs/discord.js/issues/7091.',
        'DeprecationWarning',
      );
    }
    return deletedMessages.has(this);
  }

  public set deleted(value: boolean) {
    if (!deprecationEmittedForDeleted) {
      deprecationEmittedForDeleted = true;
      process.emitWarning(
        'Message#deleted is deprecated, see https://github.com/discordjs/discord.js/issues/7091.',
        'DeprecationWarning',
      );
    }
    if (value) {
      deletedMessages.add(this);
    } else {
      deletedMessages.delete(this);
    }
  }

  public get channel(): TextBasedChannels | null {
    return (this.client.channels.cache.get(this.channelId) as unknown as TextBasedChannels) ?? null;
  }

  public get partial(): boolean {
    return typeof this.content !== 'string' || !this.author;
  }

  public get member(): GuildMember | null {
    if (!this.author || !this.guild) return null;
    return this.guild.members.resolve(this.author);
  }

  public get createdAt(): Date {
    return new Date(this.createdTimestamp);
  }

  public get editedAt(): Date | null {
    return this.editedTimestamp ? new Date(this.editedTimestamp) : null;
  }

  public get guild(): Guild | null {
    return (
      (this.client.guilds.cache.get(this.guildId ?? '') as unknown as Guild) ??
      ((this.channel as unknown as { guild?: Guild } | null)?.guild ?? null)
    );
  }

  public get hasThread(): boolean {
    return this.flags.has(MessageFlags.FLAGS.HAS_THREAD);
  }

  public get thread(): ThreadChannel | null {
    return (
      (
        this.channel as unknown as { threads?: { cache: Collection<Snowflake, ThreadChannel> } } | null
      )?.threads?.cache.get(this.id) ?? null
    );
  }

  public get url(): string {
    return `https://discord.com/channels/${this.guildId ?? '@me'}/${this.channelId}/${this.id}`;
  }

  public get cleanContent(): string | null {
    return this.content != null && this.channel
      ? Util.cleanContent(this.content, this.channel as unknown as Parameters<typeof Util.cleanContent>[1])
      : null;
  }

  public createReactionCollector(options: ReactionCollectorOptions = {}): ReactionCollector {
    return new ReactionCollector(this, options);
  }

  public awaitReactions(
    options: AwaitReactionsOptions = {},
  ): Promise<Collection<string | Snowflake, MessageReaction>> {
    return new Promise((resolve, reject) => {
      const collector = this.createReactionCollector(options);
      collector.once('end', (reactions, reason) => {
        if (options.errors?.includes(reason)) {
          reject(reactions);
        } else {
          resolve(reactions);
        }
      });
    });
  }

  public get editable(): boolean {
    const precheck = Boolean(
      this.author &&
        this.client.user &&
        this.author.id === this.client.user.id &&
        !deletedMessages.has(this) &&
        (!this.guild || (this.channel as unknown as { viewable?: boolean } | null)?.viewable) &&
        this.reference?.type !== 'FORWARD',
    );

    const ch = this.channel as unknown as {
      isThread?: () => boolean;
      archived?: boolean;
      locked?: boolean;
      permissionsFor?: (user: unknown) => Permissions | null;
    } | null;

    if (ch?.isThread?.()) {
      if (ch.archived) return false;
      if (ch.locked) {
        const permissions = ch.permissionsFor?.(this.client.user);
        if (!permissions?.has(Permissions.FLAGS.MANAGE_THREADS, true)) return false;
      }
    }

    return precheck;
  }

  public get deletable(): boolean {
    if (deletedMessages.has(this)) {
      return false;
    }
    if (!this.guild) {
      return Boolean(this.author && this.client.user && this.author.id === this.client.user.id);
    }
    const ch = this.channel as unknown as {
      viewable?: boolean;
      permissionsFor?: (user: unknown) => Permissions | null;
    } | null;

    if (!ch?.viewable) {
      return false;
    }

    const permissions = ch.permissionsFor?.(this.client.user);
    if (!permissions) return false;
    if (permissions.has(Permissions.FLAGS.ADMINISTRATOR, false)) return true;

    const me = (this.guild.members as unknown as { me?: { communicationDisabledUntilTimestamp?: number } }).me;
    const isTimeout = me?.communicationDisabledUntilTimestamp ? me.communicationDisabledUntilTimestamp >= Date.now() : false;

    return Boolean(
      (this.author && this.client.user && this.author.id === this.client.user.id) ||
        (permissions.has(Permissions.FLAGS.MANAGE_MESSAGES, false) && !isTimeout),
    );
  }

  public get bulkDeletable(): boolean {
    return false;
  }

  public get pinnable(): boolean {
    const channel = this.channel as unknown as {
      viewable?: boolean;
      permissionsFor?: (user: unknown) => Permissions | null;
    } | null;
    return Boolean(
      !this.system &&
        !deletedMessages.has(this) &&
        (!this.guild ||
          (channel?.viewable &&
            channel.permissionsFor?.(this.client.user)?.has(Permissions.FLAGS.MANAGE_MESSAGES, false))),
    );
  }

  public async fetchReference(): Promise<Message> {
    if (!this.reference) throw new DJSError('MESSAGE_REFERENCE_MISSING');
    const { channelId, messageId } = this.reference;
    if (!messageId) throw new DJSError('MESSAGE_REFERENCE_MISSING');
    const channel = this.client.channels.resolve(channelId) as unknown as {
      messages?: { fetch(id: Snowflake): Promise<Message> };
    } | null;
    if (!channel?.messages) throw new DJSError('GUILD_CHANNEL_RESOLVE');
    return channel.messages.fetch(messageId);
  }

  public get crosspostable(): boolean {
    const bitfield =
      Permissions.FLAGS.SEND_MESSAGES |
      (this.author && this.client.user && this.author.id === this.client.user.id
        ? Permissions.defaultBit
        : Permissions.FLAGS.MANAGE_MESSAGES);
    const channel = this.channel as unknown as {
      type: string;
      viewable?: boolean;
      permissionsFor?: (user: unknown) => Permissions | null;
    } | null;
    return Boolean(
      channel?.type === 'GUILD_NEWS' &&
        !this.flags.has(MessageFlags.FLAGS.CROSSPOSTED) &&
        this.reference?.type !== 'FORWARD' &&
        this.type === 'DEFAULT' &&
        !this.poll &&
        channel.viewable &&
        channel.permissionsFor?.(this.client.user)?.has(bitfield, false) &&
        !deletedMessages.has(this),
    );
  }

  public async edit(options: string | MessagePayload | MessageEditOptions): Promise<Message> {
    if (!this.channel) throw new DJSError('CHANNEL_NOT_CACHED');
    const messages = (this.channel as unknown as { messages: { edit(target: Message, options: unknown): Promise<Message> } }).messages;
    return messages.edit(this, options);
  }

  public async crosspost(): Promise<Message> {
    if (!this.channel) throw new DJSError('CHANNEL_NOT_CACHED');
    const messages = (this.channel as unknown as { messages: { crosspost(id: Snowflake): Promise<Message> } }).messages;
    return messages.crosspost(this.id);
  }

  public async pin(reason?: string): Promise<Message> {
    if (!this.channel) throw new DJSError('CHANNEL_NOT_CACHED');
    const messages = (this.channel as unknown as { messages: { pin(id: Snowflake, reason?: string): Promise<void> } }).messages;
    await messages.pin(this.id, reason);
    return this;
  }

  public async unpin(reason?: string): Promise<Message> {
    if (!this.channel) throw new DJSError('CHANNEL_NOT_CACHED');
    const messages = (this.channel as unknown as { messages: { unpin(id: Snowflake, reason?: string): Promise<void> } }).messages;
    await messages.unpin(this.id, reason);
    return this;
  }

  public async react(emoji: EmojiIdentifierResolvable, burst: boolean = false): Promise<MessageReaction> {
    if (!this.channel) throw new DJSError('CHANNEL_NOT_CACHED');
    const messages = (this.channel as unknown as { messages: { react(id: Snowflake, emoji: EmojiIdentifierResolvable, burst: boolean): Promise<void> } }).messages;
    await messages.react(this.id, emoji, burst);

    interface ActionHandleResult {
      reaction: MessageReaction;
    }
    interface ActionHandler {
      handle(data: Record<string | symbol, unknown>, fromPacket?: boolean): ActionHandleResult;
    }
    const actions = this.client.actions as unknown as {
      injectedUser: symbol;
      injectedChannel: symbol;
      injectedMessage: symbol;
      MessageReactionAdd: ActionHandler;
    };

    return actions.MessageReactionAdd.handle(
      {
        [actions.injectedUser]: this.client.user,
        [actions.injectedChannel]: this.channel,
        [actions.injectedMessage]: this,
        emoji: Util.resolvePartialEmoji(emoji),
        me_burst: burst,
      },
      true,
    ).reaction;
  }

  public async delete(): Promise<Message> {
    if (!this.channel) throw new DJSError('CHANNEL_NOT_CACHED');
    const messages = (this.channel as unknown as { messages: { delete(id: Snowflake): Promise<void> } }).messages;
    await messages.delete(this.id);
    return this;
  }

  public async reply(options: string | MessagePayload | ReplyMessageOptions): Promise<Message> {
    if (!this.channel) throw new DJSError('CHANNEL_NOT_CACHED');
    let data: MessagePayload | Record<string, unknown>;

    if (options instanceof MessagePayload) {
      data = options;
    } else {
      const opts = typeof options === 'object' && options !== null ? options : {};
      data = MessagePayload.create(this as unknown as MessageTarget, options as unknown as string, {
        reply: {
          messageReference: this,
          failIfNotExists: (opts as ReplyMessageOptions).failIfNotExists ?? this.client.options.failIfNotExists,
        },
      }) as unknown as MessagePayload;
    }
    const sendChannel = this.channel as unknown as { send(data: unknown): Promise<Message> };
    return sendChannel.send(data);
  }

  public forward(channel: TextBasedChannelResolvable): Promise<Message> {
    const resolvedChannel = this.client.channels.resolve(channel as ChannelResolvable) as unknown as {
      send(data: unknown): Promise<Message>;
    } | null;
    if (!resolvedChannel) throw new DJSError('INVALID_TYPE', 'channel', 'TextBasedChannelResolvable');
    return resolvedChannel.send({
      forward: {
        message: this.id,
        channel: this.channelId,
        guild: this.guildId,
      },
    });
  }

  public async startThread(options: StartThreadOptions): Promise<ThreadChannel> {
    if (!this.channel) throw new DJSError('CHANNEL_NOT_CACHED');
    const channelType = (this.channel as unknown as { type: string }).type;
    if (!['GUILD_TEXT', 'GUILD_NEWS'].includes(channelType)) {
      throw new DJSError('MESSAGE_THREAD_PARENT');
    }
    if (this.hasThread) throw new DJSError('MESSAGE_EXISTING_THREAD');
    const threadMgr = (this.channel as unknown as { threads: { create(opts: unknown): Promise<ThreadChannel> } }).threads;
    return threadMgr.create({ ...options, startMessage: this });
  }

  public vote(...ids: (number | number[])[]): Promise<unknown> {
    const flattened = ids.flat(1).map(val => val.toString());
    const api = this.client.api as unknown as {
      channels(channelId: Snowflake): {
        polls(messageId: Snowflake): {
          answers: {
            ['@me']: {
              put(opts: { data: { answer_ids: string[] } }): Promise<unknown>;
            };
          };
        };
      };
    };
    return api
      .channels(this.channelId)
      .polls(this.id)
      .answers['@me'].put({
        data: {
          answer_ids: flattened,
        },
      });
  }

  public async fetch(force: boolean = true): Promise<Message> {
    if (!this.channel) throw new DJSError('CHANNEL_NOT_CACHED');
    const messages = (this.channel as unknown as { messages: { fetch(id: Snowflake, opts?: { force?: boolean }): Promise<Message> } }).messages;
    return messages.fetch(this.id, { force });
  }

  public async fetchWebhook(): Promise<Webhook | null> {
    if (!this.webhookId) throw new DJSError('WEBHOOK_MESSAGE');
    if (this.webhookId === this.applicationId) throw new DJSError('WEBHOOK_APPLICATION');
    return (this.client as unknown as { fetchWebhook(id: Snowflake): Promise<Webhook | null> }).fetchWebhook(this.webhookId);
  }

  public suppressEmbeds(suppress: boolean = true): Promise<Message> {
    const flags = new MessageFlags(this.flags.bitfield);
    if (suppress) {
      flags.add(MessageFlags.FLAGS.SUPPRESS_EMBEDS);
    } else {
      flags.remove(MessageFlags.FLAGS.SUPPRESS_EMBEDS);
    }
    return this.edit({ flags });
  }

  public removeAttachments(): Promise<Message> {
    return this.edit({ attachments: [] });
  }

  public resolveComponent(customId: string): MessageActionRowComponent | null {
    return (
      (
        this.components
          .flatMap(c => BaseMessageComponent.extractInteractiveComponents(c))
          .find(component => {
            const comp = component as unknown as { customId?: string; custom_id?: string };
            return (comp.customId ?? comp.custom_id) === customId;
          }) as unknown as MessageActionRowComponent
      ) ?? null
    );
  }

  public equals(message: Message | null | undefined, rawData?: RawMessageData): boolean {
    if (!message) return false;
    const embedUpdate = !message.author && !message.attachments;
    if (embedUpdate) return this.id === message.id && this.embeds.length === message.embeds.length;

    let equal =
      this.id === message.id &&
      this.author?.id === message.author?.id &&
      this.content === message.content &&
      this.tts === message.tts &&
      this.nonce === message.nonce &&
      this.embeds.length === message.embeds.length &&
      this.attachments.size === message.attachments.size &&
      this.attachments.every(attachment => message.attachments.has(attachment.id!)) &&
      this.embeds.every((embed, index) => embed.equals(message.embeds[index]));

    if (equal && rawData) {
      equal =
        this.mentions.everyone === message.mentions.everyone &&
        this.createdTimestamp === new Date(rawData.timestamp).getTime() &&
        this.editedTimestamp === (rawData.edited_timestamp ? new Date(rawData.edited_timestamp).getTime() : null);
    }

    return equal;
  }

  public inGuild(): boolean {
    return Boolean(this.guildId);
  }

  public override toString(): string {
    return this.content ?? '';
  }

  public override toJSON(): Record<string, unknown> {
    return super.toJSON({
      channel: 'channelId',
      author: 'authorId',
      groupActivityApplication: 'groupActivityApplicationId',
      guild: 'guildId',
      cleanContent: true,
      member: false,
      reactions: false,
    }) as Record<string, unknown>;
  }

  public get isMessage(): boolean {
    return true;
  }

  public clickButton(buttonid: string): Promise<Message | unknown> {
    const button = this.resolveComponent(buttonid) as unknown as {
      type: string;
      disabled?: boolean;
      customId: string;
    } | null;
    if (!button || button.type !== 'BUTTON') throw new DJSTypeError('BUTTON_NOT_FOUND');
    if (button.disabled) throw new DJSTypeError('BUTTON_CANNOT_CLICK');

    const nonce = SnowflakeUtil.generate();
    const data = {
      type: InteractionTypes.MESSAGE_COMPONENT,
      nonce,
      guild_id: this.guildId,
      channel_id: this.channelId,
      message_id: this.id,
      application_id: this.applicationId ?? this.author?.id,
      session_id: (this.client as unknown as { sessionId?: string }).sessionId,
      message_flags: this.flags.bitfield,
      data: {
        component_type: MessageComponentTypes.BUTTON,
        custom_id: button.customId,
      },
    };
    const api = this.client.api as unknown as {
      interactions: { post(opts: { data: unknown }): Promise<unknown> };
    };
    api.interactions.post({ data });
    return Util.createPromiseInteraction(this.client, nonce, 5_000, true, this);
  }

  public selectMenu(
    menu: number | string,
    values: (UserResolvable | RoleResolvable | ChannelResolvable | string)[] = [],
  ): Promise<Message | unknown> {
    interface InteractiveSelectComponent {
      type: string;
      customId: string;
      disabled?: boolean;
      minValues?: number;
      maxValues?: number;
      options?: { value: string; label: string }[];
    }

    let selectMenu: InteractiveSelectComponent | null = null;

    if (typeof menu === 'number' || (typeof menu === 'string' && /^[0-4]$/.test(menu))) {
      const idx = typeof menu === 'number' ? menu : parseInt(menu, 10);
      const row = this.components[idx] as unknown as { components?: InteractiveSelectComponent[] } | undefined;
      selectMenu = row?.components?.[0] ?? null;
    } else if (typeof menu === 'string') {
      const allComponents = this.components.flatMap(
        row => (row as unknown as { components?: InteractiveSelectComponent[] }).components ?? [],
      );
      selectMenu =
        allComponents.find(
          b =>
            ['STRING_SELECT', 'USER_SELECT', 'ROLE_SELECT', 'MENTIONABLE_SELECT', 'CHANNEL_SELECT'].includes(b.type) &&
            b.customId === menu &&
            !b.disabled,
        ) ?? null;
    }

    if (!selectMenu) {
      throw new DJSTypeError('INVALID_TYPE', 'menu', 'SelectMenuComponent');
    }

    if (selectMenu.minValues !== undefined && values.length < selectMenu.minValues) {
      throw new DJSRangeError(`[SELECT_MENU_MIN_VALUES] The minimum number of values is ${selectMenu.minValues}`);
    }
    if (selectMenu.maxValues !== undefined && values.length > selectMenu.maxValues) {
      throw new DJSRangeError(`[SELECT_MENU_MAX_VALUES] The maximum number of values is ${selectMenu.maxValues}`);
    }

    const resolvedValues = values.map(value => {
      switch (selectMenu!.type) {
        case 'STRING_SELECT': {
          const opt = selectMenu!.options?.find(
            obj => obj.value === (value as unknown) || obj.label === (value as unknown),
          );
          return opt ? opt.value : String(value);
        }
        case 'USER_SELECT': {
          return (this.client.users as unknown as { resolveId(v: unknown): Snowflake }).resolveId(value);
        }
        case 'ROLE_SELECT': {
          return (this.guild?.roles as unknown as { resolveId(v: unknown): Snowflake })?.resolveId(value) ?? String(value);
        }
        case 'MENTIONABLE_SELECT': {
          const userId = (this.client.users as unknown as { resolveId(v: unknown): Snowflake }).resolveId(value);
          if (userId) return userId;
          return (this.guild?.roles as unknown as { resolveId(v: unknown): Snowflake })?.resolveId(value) ?? String(value);
        }
        case 'CHANNEL_SELECT': {
          return (this.client.channels as unknown as { resolveId(v: unknown): Snowflake }).resolveId(value);
        }
        default: {
          return String(value);
        }
      }
    });

    const nonce = SnowflakeUtil.generate();
    const compType = (MessageComponentTypes as Record<string, number>)[selectMenu.type];
    const data = {
      type: InteractionTypes.MESSAGE_COMPONENT,
      guild_id: this.guildId,
      channel_id: this.channelId,
      message_id: this.id,
      application_id: this.applicationId ?? this.author?.id,
      session_id: (this.client as unknown as { sessionId?: string }).sessionId,
      message_flags: this.flags.bitfield,
      data: {
        component_type: compType,
        custom_id: selectMenu.customId,
        type: compType,
        values: resolvedValues,
      },
      nonce,
    };

    const api = this.client.api as unknown as {
      interactions: { post(opts: { data: unknown }): Promise<unknown> };
    };
    api.interactions.post({ data });
    return Util.createPromiseInteraction(this.client, nonce, 5_000, true, this);
  }

  public markUnread(): Promise<unknown> {
    const api = this.client.api as unknown as {
      channels: Record<
        string,
        {
          messages: Record<
            string,
            {
              ack: {
                post(opts: { data: { manual: boolean; mention_count: number } }): Promise<unknown>;
              };
            }
          >;
        }
      >;
    };
    return api.channels[this.channelId].messages[this.id].ack.post({
      data: {
        manual: true,
        mention_count: 1,
      },
    });
  }

  public markRead(): Promise<unknown> {
    const api = this.client.api as unknown as {
      channels: Record<
        string,
        {
          messages: Record<
            string,
            {
              ack: {
                post(opts: { data: { token: null } }): Promise<unknown>;
              };
            }
          >;
        }
      >;
    };
    return api.channels[this.channelId].messages[this.id].ack.post({
      data: {
        token: null,
      },
    });
  }

  public report(breadcrumbs: number[], elements: Record<string, unknown> = {}): Promise<{ report_id: Snowflake }> {
    const api = this.client.api as unknown as {
      reporting: {
        message: {
          post(opts: {
            data: {
              version: string;
              variant: string;
              language: string;
              breadcrumbs: number[];
              elements: Record<string, unknown>;
              channel_id: Snowflake;
              message_id: Snowflake;
              name: string;
            };
          }): Promise<{ report_id: Snowflake }>;
        };
      };
    };
    return api.reporting.message.post({
      data: {
        version: '1.0',
        variant: '4',
        language: 'en',
        breadcrumbs,
        elements,
        channel_id: this.channelId,
        message_id: this.id,
        name: 'message',
      },
    });
  }
}

export default Message;
