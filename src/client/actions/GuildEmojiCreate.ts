import GenericAction from './Action.js';
import { Events } from '../../util/Constants.js';
import type { Guild } from '../../structures/Guild.js';
import type { GuildEmoji, APIGuildEmojiData } from '../../structures/GuildEmoji.js';

export class GuildEmojiCreateAction extends GenericAction {
  public override handle(guild: Guild, createdEmoji: APIGuildEmojiData): { emoji: GuildEmoji } {
    const already = Boolean(createdEmoji.id && guild.emojis.cache.has(createdEmoji.id));
    const emoji = guild.emojis._add(createdEmoji);
    if (!already) this.client.emit(Events.GUILD_EMOJI_CREATE, emoji);
    return { emoji };
  }
}

export default GuildEmojiCreateAction;
