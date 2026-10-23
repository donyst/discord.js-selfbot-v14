import type { Snowflake } from 'discord-api-types/v10';
import GenericAction from './Action.js';
import { Events } from '../../util/Constants.js';
import type { GuildScheduledEvent, RawGuildScheduledEventData } from '../../structures/GuildScheduledEvent.js';

export class GuildScheduledEventUpdateAction extends GenericAction {
  public override handle(data: RawGuildScheduledEventData & { id: Snowflake; guild_id: Snowflake }): {
    oldGuildScheduledEvent?: GuildScheduledEvent | null;
    newGuildScheduledEvent?: GuildScheduledEvent;
  } {
    const client = this.client;
    const guild = client.guilds.cache.get(data.guild_id);

    if (guild) {
      const oldGuildScheduledEvent = guild.scheduledEvents.cache.get(data.id)?._clone() ?? null;
      const newGuildScheduledEvent = guild.scheduledEvents._add(data);

      client.emit(Events.GUILD_SCHEDULED_EVENT_UPDATE, oldGuildScheduledEvent, newGuildScheduledEvent);

      return { oldGuildScheduledEvent, newGuildScheduledEvent };
    }

    return {};
  }
}

export default GuildScheduledEventUpdateAction;
