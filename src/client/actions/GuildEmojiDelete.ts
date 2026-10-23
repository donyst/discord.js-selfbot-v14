import GenericAction from './Action.js';
import { deletedEmojis } from '../../structures/Emoji.js';
import { Events } from '../../util/Constants.js';
import type { GuildEmoji } from '../../structures/GuildEmoji.js';

export class GuildEmojiDeleteAction extends GenericAction {
  public override handle(emoji: GuildEmoji): { emoji: GuildEmoji } {
    if (emoji.id) emoji.guild.emojis.cache.delete(emoji.id);
    deletedEmojis.add(emoji);
    this.client.emit(Events.GUILD_EMOJI_DELETE, emoji);
    return { emoji };
  }
}

export default GuildEmojiDeleteAction;
