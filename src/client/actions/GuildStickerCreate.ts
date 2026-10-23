import GenericAction from './Action.js';
import { Events } from '../../util/Constants.js';
import type { Guild } from '../../structures/Guild.js';
import type { Sticker, APIStickerData } from '../../structures/Sticker.js';

export class GuildStickerCreateAction extends GenericAction {
  public override handle(guild: Guild, createdSticker: APIStickerData): { sticker: Sticker } {
    const already = guild.stickers.cache.has(createdSticker.id);
    const sticker = guild.stickers._add(createdSticker);
    if (!already) this.client.emit(Events.GUILD_STICKER_CREATE, sticker);
    return { sticker };
  }
}

export default GuildStickerCreateAction;
