import { Collection } from '@discordjs/collection';
import Base from './Base.js';
import { PollAnswer, type RawPollAnswerData } from './PollAnswer.js';
import { DiscordjsError as Error } from '../errors/index.js';
import { PollLayoutTypes } from '../util/Constants.js';
import type { Client } from '../client/Client.js';
import type Message from './Message.js';

export type PollLayoutType = 'DEFAULT' | string;

export interface PollQuestionMedia {
  text: string;
}

export interface RawPollData {
  question: { text: string };
  answers: RawPollAnswerData[];
  expiry: string;
  allow_multiselect: boolean;
  layout_type: number | string;
  results?: {
    is_finalized: boolean;
    answer_counts: { id: number; count: number }[];
  } | null;
}

/**
 * Represents a Poll
 * @extends {Base}
 */
export class Poll extends Base {
  /**
   * The message that started this poll
   */
  public readonly message!: Message;

  /**
   * The media for this poll's question
   */
  public question: PollQuestionMedia;

  /**
   * The answers of this poll
   */
  public answers: Collection<number, PollAnswer>;

  /**
   * The timestamp when this poll expires
   */
  public expiresTimestamp: number;

  /**
   * Whether this poll allows multiple answers
   */
  public allowMultiselect: boolean;

  /**
   * The layout type of this poll
   */
  public layoutType: PollLayoutType;

  /**
   * Whether this poll's results have been precisely counted
   */
  public resultsFinalized!: boolean;

  public constructor(client: Client, data: RawPollData, message: Message) {
    super(client);
    Object.defineProperty(this, 'message', { value: message });

    this.question = {
      text: data.question.text,
    };

    this.answers = data.answers.reduce(
      (acc, answer) => acc.set(answer.answer_id, new PollAnswer(this.client, answer, this)),
      new Collection<number, PollAnswer>(),
    );

    this.expiresTimestamp = Date.parse(data.expiry);
    this.allowMultiselect = data.allow_multiselect;
    this.layoutType = (PollLayoutTypes as unknown as Record<number | string, PollLayoutType>)[data.layout_type] ?? String(data.layout_type);

    this._patch(data);
  }

  public _patch(data: Partial<RawPollData>): void {
    if (data.results) {
      this.resultsFinalized = data.results.is_finalized;

      for (const answerResult of data.results.answer_counts) {
        const answer = this.answers.get(answerResult.id);
        answer?._patch(answerResult);
      }
    } else {
      this.resultsFinalized ??= false;
    }
  }

  /**
   * The date when this poll expires
   */
  public get expiresAt(): Date {
    return new Date(this.expiresTimestamp);
  }

  /**
   * Ends this poll.
   */
  public async end(): Promise<Message> {
    if (Date.now() > this.expiresTimestamp) {
      throw new Error('POLL_ALREADY_EXPIRED');
    }
    const channelMessages = (this.message as unknown as { channel: { messages: { endPoll: (id: string) => Promise<Message> } } }).channel.messages;
    return channelMessages.endPoll(this.message.id);
  }
}

export default Poll;
