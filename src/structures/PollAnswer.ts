import type { Snowflake } from 'discord-api-types/v10';
import type { Collection } from '@discordjs/collection';
import Base from './Base.js';
import { Emoji, type APIEmojiData } from './Emoji.js';
import type { Client } from '../client/Client.js';
import type { Poll } from './Poll.js';
import type User from './User.js';
import type { GuildEmoji } from './GuildEmoji.js';

export interface RawPollAnswerData {
  answer_id: number;
  poll_media: {
    text?: string | null;
    emoji?: APIEmojiData | null;
  };
  count?: number;
}

export interface FetchPollVotersOptions {
  limit?: number;
  after?: Snowflake;
}

/**
 * Represents an answer to a {@link Poll}
 * @extends {Base}
 */
export class PollAnswer extends Base<number> {
  public declare id: number;

  /**
   * The Poll this answer is part of
   */
  public readonly poll!: Poll;

  /**
   * The text of this answer
   */
  public text: string | null;

  /**
   * The raw emoji of this answer
   */
  public readonly _emoji: APIEmojiData | null;

  /**
   * The amount of votes this answer has
   */
  public voteCount!: number;

  public constructor(client: Client, data: RawPollAnswerData, poll: Poll) {
    super(client);
    Object.defineProperty(this, 'poll', { value: poll });
    this.id = data.answer_id;
    this.text = data.poll_media.text ?? null;
    this._emoji = data.poll_media.emoji ?? null;
    Object.defineProperty(this, '_emoji', { value: data.poll_media.emoji ?? null });
    this._patch(data);
  }

  public _patch(data: Partial<RawPollAnswerData>): void {
    if ('count' in data && data.count !== undefined) {
      this.voteCount = data.count;
    } else {
      this.voteCount ??= 0;
    }
  }

  /**
   * The emoji of this answer
   */
  public get emoji(): GuildEmoji | Emoji | null {
    if (!this._emoji || (!this._emoji.id && !this._emoji.name)) return null;
    const clientEmojis = (this.client as unknown as { emojis: { cache: { get: (id: Snowflake) => GuildEmoji | undefined } } }).emojis;
    return (this._emoji.id ? clientEmojis.cache.get(this._emoji.id) : undefined) ?? new Emoji(this.client, this._emoji);
  }

  /**
   * Fetches the users that voted for this answer
   */
  public fetchVoters({ after, limit }: FetchPollVotersOptions = {}): Promise<Collection<Snowflake, User>> {
    const channelMessages = (this.poll.message as unknown as { channel: { messages: { fetchPollAnswerVoters: (opts: { messageId: Snowflake; answerId: number; after?: Snowflake; limit?: number }) => Promise<Collection<Snowflake, User>> } } }).channel.messages;
    return channelMessages.fetchPollAnswerVoters({
      messageId: this.poll.message.id,
      answerId: this.id,
      after,
      limit,
    });
  }
}

export default PollAnswer;
