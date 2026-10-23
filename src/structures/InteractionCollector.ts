import { Collection } from '@discordjs/collection';
import { Collector, type CollectorOptions } from './interfaces/Collector.js';
import {
  Events,
  InteractionTypes,
  MessageComponentTypes,
  type InteractionType,
  type MessageComponentType,
} from '../util/Constants.js';
import type { Snowflake, TextBasedChannelResolvable, GuildResolvable } from '../types/index.js';
import type { Client } from '../client/Client.js';
import type { Interaction } from './Interaction.js';
import type { User } from './User.js';
import type { Message } from './Message.js';
import type { Guild } from './Guild.js';
import type { GuildChannel } from './GuildChannel.js';
import type { ThreadChannel } from './ThreadChannel.js';

export interface InteractionCollectorOptions<T extends Interaction = Interaction>
  extends CollectorOptions<[T]> {
  channel?: TextBasedChannelResolvable;
  componentType?: MessageComponentType | number;
  guild?: GuildResolvable;
  interactionType?: InteractionType | number;
  max?: number;
  maxComponents?: number;
  maxUsers?: number;
  message?:
    | Message
    | { id: Snowflake; channel?: unknown; channel_id?: Snowflake; guild?: unknown; guild_id?: Snowflake };
}

/**
 * Collects interactions.
 * @extends {Collector}
 */
export class InteractionCollector<T extends Interaction = Interaction> extends Collector<
  Snowflake,
  T,
  []
> {
  public declare readonly client: Client;
  public declare readonly options: InteractionCollectorOptions<T>;

  /**
   * The message from which to collect interactions, if provided
   */
  public messageId: Snowflake | null;

  /**
   * The channel from which to collect interactions, if provided
   */
  public channelId: Snowflake | null;

  /**
   * The guild from which to collect interactions, if provided
   */
  public guildId: Snowflake | null;

  /**
   * The type of interaction to collect
   */
  public interactionType: InteractionType | null;

  /**
   * The type of component to collect
   */
  public componentType: MessageComponentType | null;

  /**
   * The users that have interacted with this collector
   */
  public users: Collection<Snowflake, User>;

  /**
   * The total number of interactions collected
   */
  public total: number = 0;

  private _handleMessageDeletion?: (message: Message) => void;
  private _handleChannelDeletion?: (channel: GuildChannel) => void;
  private _handleThreadDeletion?: (thread: ThreadChannel) => void;
  private _handleGuildDeletion?: (guild: Guild) => void;

  public constructor(client: Client, options: InteractionCollectorOptions<T> = {}) {
    super(client, options);

    this.messageId = options.message?.id ?? null;

    const channels = this.client.channels as unknown as { resolveId(c: unknown): Snowflake | null };
    const guilds = this.client.guilds as unknown as { resolveId(g: unknown): Snowflake | null };

    this.channelId =
      channels.resolveId(options.message?.channel) ??
      (options.message && 'channel_id' in options.message ? (options.message as { channel_id?: Snowflake }).channel_id : undefined) ??
      channels.resolveId(options.channel);

    const chGuild = (options.channel as { guild?: unknown })?.guild;
    this.guildId =
      guilds.resolveId(options.message?.guild) ??
      (options.message && 'guild_id' in options.message ? (options.message as { guild_id?: Snowflake }).guild_id : undefined) ??
      guilds.resolveId(chGuild) ??
      guilds.resolveId(options.guild);

    this.interactionType =
      typeof options.interactionType === 'number'
        ? (InteractionTypes[options.interactionType] as InteractionType)
        : options.interactionType ?? null;

    this.componentType =
      typeof options.componentType === 'number'
        ? (MessageComponentTypes[options.componentType] as MessageComponentType)
        : options.componentType ?? null;

    this.users = new Collection();

    this.empty = this.empty.bind(this);

    const clientEmitter = this.client as unknown as {
      incrementMaxListeners(): void;
      decrementMaxListeners(): void;
      on(event: string, listener: (...args: unknown[]) => void): void;
      removeListener(event: string, listener: (...args: unknown[]) => void): void;
    };

    clientEmitter.incrementMaxListeners();

    const bulkDeleteListener = (messages: Collection<Snowflake, Message>): void => {
      if (this.messageId && messages.has(this.messageId)) {
        this.stop('messageDelete');
      }
    };

    if (this.messageId) {
      this._handleMessageDeletion = this._handleMessageDeletionMethod.bind(this);
      clientEmitter.on(Events.MESSAGE_DELETE, this._handleMessageDeletion as unknown as (...args: unknown[]) => void);
      clientEmitter.on(Events.MESSAGE_BULK_DELETE, bulkDeleteListener as unknown as (...args: unknown[]) => void);
    }

    if (this.channelId) {
      this._handleChannelDeletion = this._handleChannelDeletionMethod.bind(this);
      this._handleThreadDeletion = this._handleThreadDeletionMethod.bind(this);
      clientEmitter.on(Events.CHANNEL_DELETE, this._handleChannelDeletion as unknown as (...args: unknown[]) => void);
      clientEmitter.on(Events.THREAD_DELETE, this._handleThreadDeletion as unknown as (...args: unknown[]) => void);
    }

    if (this.guildId) {
      this._handleGuildDeletion = this._handleGuildDeletionMethod.bind(this);
      clientEmitter.on(Events.GUILD_DELETE, this._handleGuildDeletion as unknown as (...args: unknown[]) => void);
    }

    clientEmitter.on(Events.INTERACTION_CREATE, this.handleCollect as (...args: unknown[]) => void);

    this.once('end', () => {
      clientEmitter.removeListener(Events.INTERACTION_CREATE, this.handleCollect as (...args: unknown[]) => void);
      if (this._handleMessageDeletion) {
        clientEmitter.removeListener(Events.MESSAGE_DELETE, this._handleMessageDeletion as unknown as (...args: unknown[]) => void);
      }
      clientEmitter.removeListener(Events.MESSAGE_BULK_DELETE, bulkDeleteListener as unknown as (...args: unknown[]) => void);
      if (this._handleChannelDeletion) {
        clientEmitter.removeListener(Events.CHANNEL_DELETE, this._handleChannelDeletion as unknown as (...args: unknown[]) => void);
      }
      if (this._handleThreadDeletion) {
        clientEmitter.removeListener(Events.THREAD_DELETE, this._handleThreadDeletion as unknown as (...args: unknown[]) => void);
      }
      if (this._handleGuildDeletion) {
        clientEmitter.removeListener(Events.GUILD_DELETE, this._handleGuildDeletion as unknown as (...args: unknown[]) => void);
      }
      clientEmitter.decrementMaxListeners();
    });

    this.on('collect', (interaction: T) => {
      this.total++;
      this.users.set(interaction.user.id, interaction.user);
    });
  }

  /**
   * Handles an incoming interaction for possible collection.
   */
  public override collect(interaction: T): Snowflake | null {
    if (this.interactionType && interaction.type !== this.interactionType) return null;
    if (this.componentType && (interaction as unknown as { componentType?: string }).componentType !== this.componentType) {
      return null;
    }
    const msgId = (interaction as unknown as { message?: { id?: Snowflake } }).message?.id;
    if (this.messageId && msgId !== this.messageId) return null;
    if (this.channelId && interaction.channelId !== this.channelId) return null;
    if (this.guildId && interaction.guildId !== this.guildId) return null;

    return interaction.id;
  }

  /**
   * Handles an interaction for possible disposal.
   */
  public override dispose(interaction: T): Snowflake | null {
    if (this.interactionType && interaction.type !== this.interactionType) return null;
    if (this.componentType && (interaction as unknown as { componentType?: string }).componentType !== this.componentType) {
      return null;
    }
    const msgId = (interaction as unknown as { message?: { id?: Snowflake } }).message?.id;
    if (this.messageId && msgId !== this.messageId) return null;
    if (this.channelId && interaction.channelId !== this.channelId) return null;
    if (this.guildId && interaction.guildId !== this.guildId) return null;

    return interaction.id;
  }

  /**
   * Empties this interaction collector.
   */
  public empty(): void {
    this.total = 0;
    this.collected.clear();
    this.users.clear();
    this.checkEnd();
  }

  /**
   * The reason this collector has ended with, or null if it hasn't ended yet
   */
  public override get endReason(): string | null {
    if (this.options.max && this.total >= this.options.max) return 'limit';
    if (this.options.maxComponents && this.collected.size >= this.options.maxComponents) return 'componentLimit';
    if (this.options.maxUsers && this.users.size >= this.options.maxUsers) return 'userLimit';
    return null;
  }

  /**
   * Handles checking if the message has been deleted.
   * @private
   */
  private _handleMessageDeletionMethod(message: Message): void {
    if (message.id === this.messageId) {
      this.stop('messageDelete');
    }
  }

  /**
   * Handles checking if the channel has been deleted.
   * @private
   */
  private _handleChannelDeletionMethod(channel: GuildChannel): void {
    const threadCache = (channel as unknown as { threads?: { cache: Collection<Snowflake, unknown> } }).threads?.cache;
    if (channel.id === this.channelId || (this.channelId && threadCache?.has(this.channelId))) {
      this.stop('channelDelete');
    }
  }

  /**
   * Handles checking if the thread has been deleted.
   * @private
   */
  private _handleThreadDeletionMethod(thread: ThreadChannel): void {
    if (thread.id === this.channelId) {
      this.stop('threadDelete');
    }
  }

  /**
   * Handles checking if the guild has been deleted.
   * @private
   */
  private _handleGuildDeletionMethod(guild: Guild): void {
    if (guild.id === this.guildId) {
      this.stop('guildDelete');
    }
  }
}

export default InteractionCollector;
