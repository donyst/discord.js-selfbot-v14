import type { Snowflake } from 'discord-api-types/v10';
import GenericAction from './Action.js';
import { Events } from '../../util/Constants.js';
import type { GuildScheduledEvent } from '../../structures/GuildScheduledEvent.js';
import type { User } from '../../structures/User.js';

export class GuildScheduledEventUserAddAction extends GenericAction {
  public override handle(data: {
    guild_id: Snowflake;
    guild_scheduled_event_id: Snowflake;
    user_id: Snowflake;
  }): {
    guildScheduledEvent?: GuildScheduledEvent;
    user?: User;
  } {
    const client = this.client;
    const guild = client.guilds.cache.get(data.guild_id);

    if (guild) {
      const guildScheduledEvent = this.getScheduledEvent(data, guild);
      const user = this.getUser(data);

      if (guildScheduledEvent && user) {
        client.emit(Events.GUILD_SCHEDULED_EVENT_USER_ADD, guildScheduledEvent, user);
        return { guildScheduledEvent, user };
      }
    }

    return {};
  }
}

export default GuildScheduledEventUserAddAction;
