import type { Snowflake } from 'discord-api-types/v10';
import GenericAction from './Action.js';
import type { Guild } from '../../structures/Guild.js';

export class GuildRolesPositionUpdate extends GenericAction {
  public override handle(data: {
    guild_id: Snowflake;
    roles: Array<{ id: Snowflake; position: number }>;
  }): { guild?: Guild } {
    const client = this.client;
    const guild = client.guilds.cache.get(data.guild_id);
    if (guild) {
      for (const partialRole of data.roles) {
        const role = guild.roles.cache.get(partialRole.id);
        if (role) role.rawPosition = partialRole.position;
      }
    }

    return { guild };
  }
}

export default GuildRolesPositionUpdate;
