import { Collector, type CollectorOptions } from './interfaces/Collector.js';
import { Events } from '../util/Constants.js';
import type { Snowflake, TextBasedChannels } from '../types/index.js';
import type { Message } from './Message.js';
import type { Guild } from './Guild.js';
import type { GuildChannel } from './GuildChannel.js';
import type { ThreadChannel } from './ThreadChannel.js';
import type { Client } from '../client/Client.js';
import type { Collection } from '@discordjs/collection';

export interface MessageCollectorOptions extends CollectorOptions<[Message]> {
  max?: number;
  maxProcessed?: number;
}

/**
 * Collects messages on a channel.
 * @extends {Collector}
 */
export class MessageCollector extends Collector<Snowflake, Message, []> {
  public declare readonly client: Client;
  public declare readonly options: MessageCollectorOptions;

  /**
   * The channel
   */
  public channel: TextBasedChannels;

  /**
   * Total number of messages that were received in the channel during message collection
   */
  public received: number = 0;

  public constructor(channel: TextBasedChannels, options: MessageCollectorOptions = {}) {
    super((channel as unknown as { client: import('../client/Client.js').Client }).client, options);

    this.channel = channel;

    const bulkDeleteListener = (messages: Collection<Snowflake, Message>): void => {
      for (const message of messages.values()) {
        this.handleDispose(message);
      }
    };

    this._handleChannelDeletion = this._handleChannelDeletion.bind(this);
    this._handleThreadDeletion = this._handleThreadDeletion.bind(this);
    this._handleGuildDeletion = this._handleGuildDeletion.bind(this);

    const client = this.client as unknown as {
      incrementMaxListeners(): void;
      decrementMaxListeners(): void;
      on(event: string, listener: (...args: unknown[]) => void): void;
      removeListener(event: string, listener: (...args: unknown[]) => void): void;
    };

    client.incrementMaxListeners();
    client.on(Events.MESSAGE_CREATE, this.handleCollect as (...args: unknown[]) => void);
    client.on(Events.MESSAGE_DELETE, this.handleDispose as (...args: unknown[]) => void);
    client.on(Events.MESSAGE_BULK_DELETE, bulkDeleteListener as unknown as (...args: unknown[]) => void);
    client.on(Events.CHANNEL_DELETE, this._handleChannelDeletion as unknown as (...args: unknown[]) => void);
    client.on(Events.THREAD_DELETE, this._handleThreadDeletion as unknown as (...args: unknown[]) => void);
    client.on(Events.GUILD_DELETE, this._handleGuildDeletion as unknown as (...args: unknown[]) => void);

    this.once('end', () => {
      client.removeListener(Events.MESSAGE_CREATE, this.handleCollect as (...args: unknown[]) => void);
      client.removeListener(Events.MESSAGE_DELETE, this.handleDispose as (...args: unknown[]) => void);
      client.removeListener(Events.MESSAGE_BULK_DELETE, bulkDeleteListener as unknown as (...args: unknown[]) => void);
      client.removeListener(Events.CHANNEL_DELETE, this._handleChannelDeletion as unknown as (...args: unknown[]) => void);
      client.removeListener(Events.THREAD_DELETE, this._handleThreadDeletion as unknown as (...args: unknown[]) => void);
      client.removeListener(Events.GUILD_DELETE, this._handleGuildDeletion as unknown as (...args: unknown[]) => void);
      client.decrementMaxListeners();
    });
  }

  /**
   * Handles a message for possible collection.
   */
  public override collect(message: Message): Snowflake | null {
    if (message.channelId !== (this.channel as { id: Snowflake }).id) return null;
    this.received++;
    return message.id;
  }

  /**
   * Handles a message for possible disposal.
   */
  public override dispose(message: Message): Snowflake | null {
    return message.channelId === (this.channel as { id: Snowflake }).id ? message.id : null;
  }

  /**
   * The reason this collector has ended with, or null if it hasn't ended yet
   */
  public override get endReason(): string | null {
    if (this.options.max && this.collected.size >= this.options.max) return 'limit';
    if (this.options.maxProcessed && this.received === this.options.maxProcessed) return 'processedLimit';
    return null;
  }

  /**
   * Handles checking if the channel has been deleted.
   * @private
   */
  public _handleChannelDeletion(channel: GuildChannel): void {
    const ch = this.channel as { id: Snowflake; parentId?: Snowflake | null };
    if (channel.id === ch.id || channel.id === ch.parentId) {
      this.stop('channelDelete');
    }
  }

  /**
   * Handles checking if the thread has been deleted.
   * @private
   */
  public _handleThreadDeletion(thread: ThreadChannel): void {
    if (thread.id === (this.channel as { id: Snowflake }).id) {
      this.stop('threadDelete');
    }
  }

  /**
   * Handles checking if the guild has been deleted.
   * @private
   */
  public _handleGuildDeletion(guild: Guild): void {
    const chGuildId = (this.channel as { guild?: { id?: Snowflake } }).guild?.id;
    if (guild.id === chGuildId) {
      this.stop('guildDelete');
    }
  }
}

export default MessageCollector;
