import { CachedManager } from './CachedManager.js';
import { GuildEmoji } from '../structures/GuildEmoji.js';
import { ReactionEmoji } from '../structures/ReactionEmoji.js';
import Util from '../util/Util.js';
import type { Snowflake } from '../types/index.js';
import type { Client } from '../client/Client.js';

export type EmojiResolvable = Snowflake | GuildEmoji | ReactionEmoji;

export type EmojiIdentifierResolvable = string | EmojiResolvable;

/**
 * Holds methods to resolve GuildEmojis and stores their cache.
 * @extends {CachedManager}
 */
export class BaseGuildEmojiManager extends CachedManager<Snowflake, GuildEmoji, EmojiResolvable> {
  public constructor(client: Client, iterable?: Iterable<GuildEmoji>) {
    super(client, GuildEmoji, iterable);
  }

  /**
   * Resolves an EmojiResolvable to an Emoji object.
   */
  public override resolve(emoji: GuildEmoji): GuildEmoji;
  public override resolve(emoji: EmojiResolvable): GuildEmoji | null;
  public override resolve(emoji: unknown): GuildEmoji | null {
    if (emoji instanceof ReactionEmoji) return this.cache.get(emoji.id ?? '') ?? null;
    return super.resolve(emoji as EmojiResolvable);
  }

  /**
   * Resolves an EmojiResolvable to an Emoji id string.
   */
  public override resolveId(emoji: Snowflake | GuildEmoji): Snowflake;
  public override resolveId(emoji: EmojiResolvable): Snowflake | null;
  public override resolveId(emoji: unknown): Snowflake | null {
    if (emoji instanceof ReactionEmoji) return emoji.id;
    return super.resolveId(emoji as EmojiResolvable);
  }

  /**
   * Resolves an EmojiResolvable to an emoji identifier.
   */
  public resolveIdentifier(emoji: EmojiIdentifierResolvable): string | null {
    const emojiResolvable = this.resolve(emoji as EmojiResolvable);
    if (emojiResolvable) return (emojiResolvable as unknown as { identifier: string }).identifier;
    if (emoji instanceof ReactionEmoji) return emoji.identifier;
    if (typeof emoji === 'string') {
      const res = Util.parseEmoji(emoji);
      if (res?.name && res.name.length) {
        emoji = `${res.animated ? 'a:' : ''}${res.name}${res.id ? `:${res.id}` : ''}`;
      }
      if (!emoji.includes('%')) return encodeURIComponent(emoji);
      return emoji;
    }
    return null;
  }
}

export default BaseGuildEmojiManager;
