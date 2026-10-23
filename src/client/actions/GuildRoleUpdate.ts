import type { Snowflake } from 'discord-api-types/v10';
import GenericAction from './Action.js';
import { Events } from '../../util/Constants.js';
import type { Role, APIRoleData } from '../../structures/Role.js';

export class GuildRoleUpdateAction extends GenericAction {
  public override handle(data: { guild_id: Snowflake; role: APIRoleData & { id: Snowflake } }): {
    old: Role | null;
    updated: Role | null;
  } {
    const client = this.client;
    const guild = client.guilds.cache.get(data.guild_id);

    if (guild) {
      let old: Role | null = null;
      const role = guild.roles.cache.get(data.role.id);
      if (role) {
        old = role._update(data.role);
        client.emit(Events.GUILD_ROLE_UPDATE, old, role);
      }
      return {
        old,
        updated: role ?? null,
      };
    }

    return {
      old: null,
      updated: null,
    };
  }
}

export default GuildRoleUpdateAction;
