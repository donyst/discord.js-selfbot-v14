import type { Snowflake } from 'discord-api-types/v10';
import GenericAction from './Action.js';
import { Events } from '../../util/Constants.js';

export class GuildIntegrationsUpdate extends GenericAction {
  public override handle(data: { guild_id: Snowflake }): void {
    const client = this.client;
    const guild = client.guilds.cache.get(data.guild_id);
    if (guild) client.emit(Events.GUILD_INTEGRATIONS_UPDATE, guild);
  }
}

export default GuildIntegrationsUpdate;
