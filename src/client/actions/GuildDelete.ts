import { setTimeout } from 'node:timers';
import type { Snowflake } from 'discord-api-types/v10';
import GenericAction from './Action.js';
import { deletedGuilds, type Guild } from '../../structures/Guild.js';
import { Events } from '../../util/Constants.js';
import type { Client } from '../Client.js';

export class GuildDeleteAction extends GenericAction {
  public deleted: Map<Snowflake, Guild>;

  public constructor(client: Client) {
    super(client);
    this.deleted = new Map();
  }

  public override handle(data: { id: Snowflake; unavailable?: boolean }): { guild: Guild | null } {
    const client = this.client;
    let guild = client.guilds.cache.get(data.id);

    if (guild) {
      if (data.unavailable) {
        guild.available = false;
        client.emit(Events.GUILD_UNAVAILABLE, guild);
        return { guild: null };
      }

      for (const channel of guild.channels.cache.values()) {
        (this.client.channels as any)._remove(channel.id);
      }
      (client.voice as any).adapters.get(data.id)?.destroy();

      client.guilds.cache.delete(guild.id);
      deletedGuilds.add(guild);

      client.emit(Events.GUILD_DELETE, guild);

      this.deleted.set(guild.id, guild);
      this.scheduleForDeletion(guild.id);
    } else {
      guild = this.deleted.get(data.id) ?? undefined;
    }

    return { guild: guild ?? null };
  }

  public scheduleForDeletion(id: Snowflake): void {
    setTimeout(() => this.deleted.delete(id), (this.client.options as any).restWsBridgeTimeout).unref();
  }
}

export default GuildDeleteAction;
