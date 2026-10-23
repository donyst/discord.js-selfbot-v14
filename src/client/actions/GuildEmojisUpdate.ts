import type { Snowflake } from 'discord-api-types/v10';
import GenericAction from './Action.js';
import type { APIGuildEmojiData } from '../../structures/GuildEmoji.js';

export class GuildEmojisUpdateAction extends GenericAction {
  public override handle(data: { guild_id: Snowflake; emojis: APIGuildEmojiData[] }): void {
    const guild = this.client.guilds.cache.get(data.guild_id);
    if (!guild?.emojis) return;

    const deletions = new Map(guild.emojis.cache);

    const actions = this.client.actions as unknown as Record<string, { handle: (...args: unknown[]) => unknown }>;

    for (const emoji of data.emojis) {
      if (!emoji.id) continue;
      const cachedEmoji = guild.emojis.cache.get(emoji.id);
      if (cachedEmoji) {
        deletions.delete(emoji.id);
        if (!cachedEmoji.equals(emoji)) {
          actions.GuildEmojiUpdate.handle(cachedEmoji, emoji);
        }
      } else {
        actions.GuildEmojiCreate.handle(guild, emoji);
      }
    }

    for (const emoji of deletions.values()) {
      actions.GuildEmojiDelete.handle(emoji);
    }
  }
}

export default GuildEmojisUpdateAction;
