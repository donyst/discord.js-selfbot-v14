import CachedManager from './CachedManager.js';
import MessageReaction, { type RawMessageReactionData } from '../structures/MessageReaction.js';
import type Message from '../structures/Message.js';
import type { Snowflake } from '../types/index.js';

export type MessageReactionResolvable = MessageReaction | Snowflake | string;

/**
 * Manages API methods for reactions and holds their cache.
 * @extends {CachedManager}
 */
export class ReactionManager extends CachedManager<string | Snowflake, MessageReaction, RawMessageReactionData> {
  /**
   * The message that this manager belongs to
   */
  public message: Message;

  public constructor(message: Message, iterable?: Iterable<MessageReaction>) {
    super(message.client, MessageReaction, iterable);
    this.message = message;
  }

  public override _add(data: RawMessageReactionData, cache?: boolean): MessageReaction {
    return super._add(data, cache, { id: data.emoji.id ?? data.emoji.name ?? '', extras: [this.message] });
  }

  /**
   * Removes all reactions from a message.
   */
  public async removeAll(): Promise<Message> {
    const api = (this.client as unknown as { api: { channels: (cid: Snowflake) => { messages: (mid: Snowflake) => { reactions: { delete: () => Promise<unknown> } } } } }).api;
    await api.channels(this.message.channelId).messages(this.message.id).reactions.delete();
    return this.message;
  }
}

export default ReactionManager;
