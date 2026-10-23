import type { Snowflake } from 'discord-api-types/v10';
import GenericAction from './Action.js';
import { deletedRoles, type Role } from '../../structures/Role.js';
import { Events } from '../../util/Constants.js';

export class GuildRoleDeleteAction extends GenericAction {
  public override handle(data: { guild_id: Snowflake; role_id: Snowflake }): { role?: Role } {
    const client = this.client;
    const guild = client.guilds.cache.get(data.guild_id);
    let role: Role | undefined;

    if (guild) {
      role = guild.roles.cache.get(data.role_id);
      if (role) {
        guild.roles.cache.delete(data.role_id);
        deletedRoles.add(role);
        client.emit(Events.GUILD_ROLE_DELETE, role);
      }
    }

    return { role };
  }
}

export default GuildRoleDeleteAction;
