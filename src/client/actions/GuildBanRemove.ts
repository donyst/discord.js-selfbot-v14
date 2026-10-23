import type { Snowflake } from 'discord-api-types/v10';
import GenericAction from './Action.js';
import { GuildBan, type RawGuildBanData } from '../../structures/GuildBan.js';
import { Events } from '../../util/Constants.js';

export class GuildBanRemove extends GenericAction {
  public override handle(data: RawGuildBanData & { guild_id: Snowflake; user: { id: Snowflake } }): void {
    const client = this.client;
    const guild = client.guilds.cache.get(data.guild_id);

    if (guild) {
      const ban = guild.bans.cache.get(data.user.id) ?? new GuildBan(client, data, guild);
      guild.bans.cache.delete(ban.user.id);
      client.emit(Events.GUILD_BAN_REMOVE, ban);
    }
  }
}

export default GuildBanRemove;
