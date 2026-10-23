import { Emoji, type APIEmojiData } from './Emoji.js';
import Util from '../util/Util.js';
import type { Snowflake } from '../types/index.js';
import type { MessageReaction } from './MessageReaction.js';

/**
 * Represents a limited emoji set used for both custom and unicode emojis. Custom emojis
 * will use this class opposed to the Emoji class when the client doesn't know enough
 * information about them.
 */
export class ReactionEmoji extends Emoji {
  public reaction: MessageReaction;

  public constructor(reaction: MessageReaction, emoji: APIEmojiData) {
    super(reaction.message.client, emoji);
    this.reaction = reaction;
  }

  public override toJSON(): unknown {
    return Util.flatten(this, { identifier: true });
  }

  public override valueOf(): Snowflake | null {
    return this.id;
  }
}

export default ReactionEmoji;
