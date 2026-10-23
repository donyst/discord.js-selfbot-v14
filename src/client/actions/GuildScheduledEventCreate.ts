import type { Snowflake } from 'discord-api-types/v10';
import GenericAction from './Action.js';
import { Events } from '../../util/Constants.js';
import type { GuildScheduledEvent, RawGuildScheduledEventData } from '../../structures/GuildScheduledEvent.js';

export class GuildScheduledEventCreateAction extends GenericAction {
  public override handle(data: RawGuildScheduledEventData & { guild_id: Snowflake }): {
    guildScheduledEvent?: GuildScheduledEvent;
  } {
    const client = this.client;
    const guild = client.guilds.cache.get(data.guild_id);
    if (guild) {
      const guildScheduledEvent = guild.scheduledEvents._add(data);
      client.emit(Events.GUILD_SCHEDULED_EVENT_CREATE, guildScheduledEvent);
      return { guildScheduledEvent };
    }
    return {};
  }
}

export default GuildScheduledEventCreateAction;
