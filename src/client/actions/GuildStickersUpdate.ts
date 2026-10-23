import type { Snowflake } from 'discord-api-types/v10';
import GenericAction from './Action.js';
import type { APIStickerData } from '../../structures/Sticker.js';

export class GuildStickersUpdateAction extends GenericAction {
  public override handle(data: { guild_id: Snowflake; stickers: APIStickerData[] }): void {
    const guild = this.client.guilds.cache.get(data.guild_id);
    if (!guild?.stickers) return;

    const deletions = new Map(guild.stickers.cache);

    for (const sticker of data.stickers) {
      const cachedSticker = guild.stickers.cache.get(sticker.id);
      if (cachedSticker) {
        deletions.delete(sticker.id);
        if (!cachedSticker.equals(sticker as any)) {
          (this.client.actions as any).GuildStickerUpdate.handle(cachedSticker, sticker);
        }
      } else {
        (this.client.actions as any).GuildStickerCreate.handle(guild, sticker);
      }
    }

    for (const sticker of deletions.values()) {
      (this.client.actions as any).GuildStickerDelete.handle(sticker);
    }
  }
}

export default GuildStickersUpdateAction;
