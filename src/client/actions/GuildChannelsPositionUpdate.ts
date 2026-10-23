import type { Snowflake } from 'discord-api-types/v10';
import GenericAction from './Action.js';
import type { Guild } from '../../structures/Guild.js';

export class GuildChannelsPositionUpdate extends GenericAction {
  public override handle(data: {
    guild_id: Snowflake;
    channels: Array<{ id: Snowflake; position: number }>;
  }): { guild?: Guild } {
    const client = this.client;
    const guild = client.guilds.cache.get(data.guild_id);
    if (guild) {
      for (const partialChannel of data.channels) {
        const channel = guild.channels.cache.get(partialChannel.id);
        if (channel && 'rawPosition' in channel) {
          (channel as any).rawPosition = partialChannel.position;
        }
      }
    }

    return { guild };
  }
}

export default GuildChannelsPositionUpdate;
