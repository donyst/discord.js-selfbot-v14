import GenericAction from './Action.js';
import { Events } from '../../util/Constants.js';
import type { GuildEmoji, APIGuildEmojiData } from '../../structures/GuildEmoji.js';

export class GuildEmojiUpdateAction extends GenericAction {
  public override handle(current: GuildEmoji, data: APIGuildEmojiData): { emoji: GuildEmoji } {
    const old = current._update(data);
    this.client.emit(Events.GUILD_EMOJI_UPDATE, old, current);
    return { emoji: current };
  }
}

export default GuildEmojiUpdateAction;
