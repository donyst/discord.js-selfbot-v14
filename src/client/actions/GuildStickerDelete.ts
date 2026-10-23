import GenericAction from './Action.js';
import { deletedStickers, type Sticker } from '../../structures/Sticker.js';
import { Events } from '../../util/Constants.js';
import type { Guild } from '../../structures/Guild.js';

export class GuildStickerDeleteAction extends GenericAction {
  public override handle(sticker: Sticker & { guild: Guild }): { sticker: Sticker } {
    sticker.guild.stickers.cache.delete(sticker.id);
    deletedStickers.add(sticker);
    this.client.emit(Events.GUILD_STICKER_DELETE, sticker);
    return { sticker };
  }
}

export default GuildStickerDeleteAction;
