import type { Snowflake } from 'discord-api-types/v10';
import GenericAction from './Action.js';
import { Events } from '../../util/Constants.js';
import type { GuildScheduledEvent } from '../../structures/GuildScheduledEvent.js';

export class GuildScheduledEventDeleteAction extends GenericAction {
  public override handle(data: { id: Snowflake; guild_id: Snowflake }): {
    guildScheduledEvent?: GuildScheduledEvent;
  } {
    const client = this.client;
    const guild = client.guilds.cache.get(data.guild_id);

    if (guild) {
      const guildScheduledEvent = this.getScheduledEvent(data, guild);
      if (guildScheduledEvent) {
        guild.scheduledEvents.cache.delete(guildScheduledEvent.id);
        client.emit(Events.GUILD_SCHEDULED_EVENT_DELETE, guildScheduledEvent);
        return { guildScheduledEvent };
      }
    }

    return {};
  }
}

export default GuildScheduledEventDeleteAction;
