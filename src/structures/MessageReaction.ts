import GuildEmoji from './GuildEmoji.js';
import ReactionEmoji from './ReactionEmoji.js';
import ReactionUserManager from '../managers/ReactionUserManager.js';
import Util from '../util/Util.js';
import type { Client } from '../client/Client.js';
import type Message from './Message.js';
import type { APIEmojiData } from './Emoji.js';
import type User from './User.js';

export interface ReactionCountDetailsData {
  burst: number;
  normal: number;
}

export interface RawMessageReactionData {
  me?: boolean;
  me_burst?: boolean;
  count?: number;
  burst_colors?: string[] | null;
  count_details?: {
    burst: number;
    normal: number;
  };
  emoji: APIEmojiData;
}

/**
 * Represents a reaction to a message.
 */
export class MessageReaction {
  public readonly client: Client;
  public message: Message;
  public me: boolean;
  public meBurst: boolean;
  public users: ReactionUserManager;
  public _emoji: ReactionEmoji | GuildEmoji;
  public burstColors: string[] | null = null;
  public count: number | null = null;
  public countDetails: ReactionCountDetailsData = { burst: 0, normal: 0 };

  public constructor(client: Client, data: RawMessageReactionData, message: Message) {
    Object.defineProperty(this, 'client', { value: client });
    this.message = message;
    this.me = Boolean(data.me);
    this.meBurst = Boolean(data.me_burst);
    this.users = new ReactionUserManager(this, this.me && (client as unknown as { user?: User }).user ? [(client as unknown as { user: User }).user] : []);
    this._emoji = new ReactionEmoji(this, data.emoji);
    this.burstColors = null;
    this._patch(data);
  }

  public _patch(data: Partial<RawMessageReactionData>): void {
    if (data.burst_colors) {
      this.burstColors = data.burst_colors;
    }

    if ('count' in data && data.count !== undefined) {
      this.count ??= data.count;
    }

    if ('count_details' in data && data.count_details) {
      this.countDetails = {
        burst: data.count_details.burst,
        normal: data.count_details.normal,
      };
    } else {
      this.countDetails ??= { burst: 0, normal: 0 };
    }
  }

  /**
   * Removes all users from this reaction.
   */
  public async remove(): Promise<this> {
    const api = (this.client as unknown as { api: { channels: (cid: string) => { messages: (mid: string) => { reactions: (ident: string) => { delete: () => Promise<unknown> } } } } }).api;
    await api
      .channels(this.message.channelId)
      .messages(this.message.id)
      .reactions(this._emoji.identifier)
      .delete();
    return this;
  }

  /**
   * The emoji of this reaction.
   */
  public get emoji(): GuildEmoji | ReactionEmoji {
    if (this._emoji instanceof GuildEmoji) return this._emoji;
    if (this._emoji.id) {
      const emojis = (this.message.client as unknown as { emojis: { cache: { has: (id: string) => boolean; get: (id: string) => GuildEmoji | undefined } } }).emojis.cache;
      if (emojis.has(this._emoji.id)) {
        const emoji = emojis.get(this._emoji.id)!;
        this._emoji = emoji;
        return emoji;
      }
    }
    return this._emoji;
  }

  /**
   * Whether or not this reaction is a partial
   */
  public get partial(): boolean {
    return this.count === null;
  }

  /**
   * Fetch this reaction.
   */
  public async fetch(): Promise<this> {
    const message = await this.message.fetch();
    const reactionsCache = (message.reactions as unknown as { cache: { get: (k: string) => RawMessageReactionData | undefined } }).cache;
    const existing = reactionsCache.get(this.emoji.id ?? this.emoji.name ?? '');
    this._patch(existing ?? { count: 0, emoji: { name: this.emoji.name, id: this.emoji.id } });
    return this;
  }

  public toJSON(): Record<string, unknown> {
    return Util.flatten(this, { emoji: 'emojiId', message: 'messageId' }) as Record<string, unknown>;
  }

  public _add(user: User, burst?: boolean): void {
    if (this.partial) return;
    this.users.cache.set(user.id, user);
    const clientUser = (this.message.client as unknown as { user?: { id: string } }).user;
    if (!this.me || user.id !== clientUser?.id || this.count === 0) {
      this.count = (this.count ?? 0) + 1;
      if (burst) this.countDetails.burst++;
      else this.countDetails.normal++;
    }
    if (user.id === clientUser?.id) {
      if (burst) this.meBurst = true;
      else this.me = true;
    }
  }

  public _remove(user: User, burst?: boolean): void {
    if (this.partial) return;
    this.users.cache.delete(user.id);
    const clientUser = (this.message.client as unknown as { user?: { id: string } }).user;
    if (!this.me || user.id !== clientUser?.id) {
      this.count = (this.count ?? 1) - 1;
      if (burst) this.countDetails.burst--;
      else this.countDetails.normal--;
    }
    if (user.id === clientUser?.id) {
      if (burst) this.meBurst = false;
      else this.me = false;
    }
    if ((this.count ?? 0) <= 0 && this.users.cache.size === 0) {
      (this.message.reactions as unknown as { cache: { delete: (k: string) => void } }).cache.delete(this.emoji.id ?? this.emoji.name ?? '');
    }
  }
}

export default MessageReaction;
