import { Collection } from '@discordjs/collection';
import { Collector, type CollectorOptions } from './interfaces/Collector.js';
import { Events } from '../util/Constants.js';
import type Message from './Message.js';
import type MessageReaction from './MessageReaction.js';
import type User from './User.js';
import type GuildChannel from './GuildChannel.js';
import type ThreadChannel from './ThreadChannel.js';
import type { Guild } from './Guild.js';
import type { Snowflake } from '../types/index.js';

export interface ReactionCollectorOptions extends CollectorOptions<[MessageReaction, User]> {
  max?: number;
  maxEmojis?: number;
  maxUsers?: number;
}

/**
 * Collects reactions on messages.
 * @extends {Collector}
 */
export class ReactionCollector extends Collector<string | Snowflake, MessageReaction, [User]> {
  public declare readonly options: ReactionCollectorOptions;

  /**
   * The message upon which to collect reactions
   */
  public message: Message;

  /**
   * The users that have reacted to this message
   */
  public users: Collection<Snowflake, User>;

  /**
   * The total number of reactions collected
   */
  public total: number;

  public constructor(message: Message, options: ReactionCollectorOptions = {}) {
    super(message.client, options);

    this.message = message;
    this.users = new Collection<Snowflake, User>();
    this.total = 0;

    this.empty = this.empty.bind(this);
    this._handleChannelDeletion = this._handleChannelDeletion.bind(this);
    this._handleThreadDeletion = this._handleThreadDeletion.bind(this);
    this._handleGuildDeletion = this._handleGuildDeletion.bind(this);
    this._handleMessageDeletion = this._handleMessageDeletion.bind(this);

    const bulkDeleteListener = (messages: Collection<Snowflake, Message>) => {
      if (messages.has(this.message.id)) this.stop('messageDelete');
    };

    const client = this.client as unknown as {
      incrementMaxListeners: () => void;
      decrementMaxListeners: () => void;
      on: (evt: string, fn: (...args: unknown[]) => void) => void;
      removeListener: (evt: string, fn: (...args: unknown[]) => void) => void;
    };

    client.incrementMaxListeners();
    client.on(Events.MESSAGE_REACTION_ADD, this.handleCollect as unknown as (...args: unknown[]) => void);
    client.on(Events.MESSAGE_REACTION_REMOVE, this.handleDispose as unknown as (...args: unknown[]) => void);
    client.on(Events.MESSAGE_REACTION_REMOVE_ALL, this.empty as unknown as (...args: unknown[]) => void);
    client.on(Events.MESSAGE_DELETE, this._handleMessageDeletion as unknown as (...args: unknown[]) => void);
    client.on(Events.MESSAGE_BULK_DELETE, bulkDeleteListener as unknown as (...args: unknown[]) => void);
    client.on(Events.CHANNEL_DELETE, this._handleChannelDeletion as unknown as (...args: unknown[]) => void);
    client.on(Events.THREAD_DELETE, this._handleThreadDeletion as unknown as (...args: unknown[]) => void);
    client.on(Events.GUILD_DELETE, this._handleGuildDeletion as unknown as (...args: unknown[]) => void);

    this.once('end', () => {
      client.removeListener(Events.MESSAGE_REACTION_ADD, this.handleCollect as unknown as (...args: unknown[]) => void);
      client.removeListener(Events.MESSAGE_REACTION_REMOVE, this.handleDispose as unknown as (...args: unknown[]) => void);
      client.removeListener(Events.MESSAGE_REACTION_REMOVE_ALL, this.empty as unknown as (...args: unknown[]) => void);
      client.removeListener(Events.MESSAGE_DELETE, this._handleMessageDeletion as unknown as (...args: unknown[]) => void);
      client.removeListener(Events.MESSAGE_BULK_DELETE, bulkDeleteListener as unknown as (...args: unknown[]) => void);
      client.removeListener(Events.CHANNEL_DELETE, this._handleChannelDeletion as unknown as (...args: unknown[]) => void);
      client.removeListener(Events.THREAD_DELETE, this._handleThreadDeletion as unknown as (...args: unknown[]) => void);
      client.removeListener(Events.GUILD_DELETE, this._handleGuildDeletion as unknown as (...args: unknown[]) => void);
      client.decrementMaxListeners();
    });

    this.on('collect', ((reaction: MessageReaction, user: User) => {
      if (reaction.count === 1) {
        this.emit('create', reaction, user);
      }
      this.total++;
      this.users.set(user.id, user);
    }) as unknown as (...args: unknown[]) => void);

    this.on('remove', ((_reaction: MessageReaction, user: User) => {
      this.total--;
      if (!this.collected.some(r => r.users.cache.has(user.id))) this.users.delete(user.id);
    }) as unknown as (...args: unknown[]) => void);
  }

  public collect(reaction: MessageReaction): Snowflake | string | null {
    if (reaction.message.id !== this.message.id) return null;
    return ReactionCollector.key(reaction);
  }

  public dispose(reaction: MessageReaction, user: User): Snowflake | string | null {
    if (reaction.message.id !== this.message.id) return null;

    if (this.collected.has(ReactionCollector.key(reaction)) && this.users.has(user.id)) {
      this.emit('remove', reaction, user);
    }
    return reaction.count ? null : ReactionCollector.key(reaction);
  }

  public empty(): void {
    this.total = 0;
    this.collected.clear();
    this.users.clear();
    this.checkEnd();
  }

  public get endReason(): string | null {
    if (this.options.max && this.total >= this.options.max) return 'limit';
    if (this.options.maxEmojis && this.collected.size >= this.options.maxEmojis) return 'emojiLimit';
    if (this.options.maxUsers && this.users.size >= this.options.maxUsers) return 'userLimit';
    return null;
  }

  private _handleMessageDeletion(message: Message): void {
    if (message.id === this.message.id) {
      this.stop('messageDelete');
    }
  }

  private _handleChannelDeletion(channel: GuildChannel & { threads?: { cache: { has: (id: string) => boolean } } }): void {
    if (channel.id === this.message.channelId || channel.threads?.cache.has(this.message.channelId)) {
      this.stop('channelDelete');
    }
  }

  private _handleThreadDeletion(thread: ThreadChannel): void {
    if (thread.id === this.message.channelId) {
      this.stop('threadDelete');
    }
  }

  private _handleGuildDeletion(guild: Guild): void {
    if (guild.id === this.message.guild?.id) {
      this.stop('guildDelete');
    }
  }

  public static key(reaction: MessageReaction): Snowflake | string {
    return (reaction.emoji.id ?? reaction.emoji.name)!;
  }
}

export default ReactionCollector;
