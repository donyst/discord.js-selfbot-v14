import type { Snowflake } from 'discord-api-types/v10';
import GenericAction from './Action.js';
import { Events } from '../../util/Constants.js';
import type { Guild, GuildRawData } from '../../structures/Guild.js';

export class GuildUpdateAction extends GenericAction {
  public override handle(data: GuildRawData & { id: Snowflake }): {
    old: unknown | null;
    updated: Guild | null;
  } {
    const client = this.client;
    const guild = client.guilds.cache.get(data.id);
    if (guild) {
      const old = (guild as any)._update(data);
      client.emit(Events.GUILD_UPDATE, old, guild);
      return {
        old,
        updated: guild,
      };
    }

    return {
      old: null,
      updated: null,
    };
  }
}

export default GuildUpdateAction;
