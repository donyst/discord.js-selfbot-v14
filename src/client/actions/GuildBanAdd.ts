import type { Snowflake } from 'discord-api-types/v10';
import GenericAction from './Action.js';
import { Events } from '../../util/Constants.js';
import type { RawGuildBanData } from '../../structures/GuildBan.js';

export class GuildBanAdd extends GenericAction {
  public override handle(data: RawGuildBanData & { guild_id: Snowflake }): void {
    const client = this.client;
    const guild = client.guilds.cache.get(data.guild_id);

    if (guild) {
      client.emit(Events.GUILD_BAN_ADD, guild.bans._add(data));
    }
  }
}

export default GuildBanAdd;
