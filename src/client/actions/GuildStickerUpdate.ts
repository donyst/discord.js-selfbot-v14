import GenericAction from './Action.js';
import { Events } from '../../util/Constants.js';
import type { Sticker, APIStickerData } from '../../structures/Sticker.js';

export class GuildStickerUpdateAction extends GenericAction {
  public override handle(current: Sticker, data: APIStickerData): { sticker: Sticker } {
    const old = current._update(data);
    this.client.emit(Events.GUILD_STICKER_UPDATE, old, current);
    return { sticker: current };
  }
}

export default GuildStickerUpdateAction;
