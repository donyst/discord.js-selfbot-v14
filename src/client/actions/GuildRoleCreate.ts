import type { Snowflake } from 'discord-api-types/v10';
import GenericAction from './Action.js';
import { Events } from '../../util/Constants.js';
import type { Role, APIRoleData } from '../../structures/Role.js';

export class GuildRoleCreate extends GenericAction {
  public override handle(data: { guild_id: Snowflake; role: APIRoleData }): { role?: Role } {
    const client = this.client;
    const guild = client.guilds.cache.get(data.guild_id);
    let role: Role | undefined;
    if (guild) {
      const already = guild.roles.cache.has(data.role.id);
      role = guild.roles._add(data.role);
      if (!already) client.emit(Events.GUILD_ROLE_CREATE, role);
    }
    return { role };
  }
}

export default GuildRoleCreate;
