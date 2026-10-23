import type { Snowflake } from 'discord-api-types/v10';
import GenericAction from './Action.js';
import { deletedGuildMembers, type GuildMember } from '../../structures/GuildMember.js';
import { Events, Status } from '../../util/Constants.js';
import type { Guild } from '../../structures/Guild.js';
import type { WebSocketShard } from '../websocket/WebSocketShard.js';

export class GuildMemberRemoveAction extends GenericAction {
  public override handle(
    data: { guild_id: Snowflake; user: { id: Snowflake } },
    shard: WebSocketShard,
  ): { guild?: Guild; member: GuildMember | null } {
    const client = this.client;
    const guild = client.guilds.cache.get(data.guild_id);
    let member: GuildMember | null = null;
    if (guild) {
      member = this.getMember({ user: data.user }, guild) ?? null;
      guild.memberCount--;
      if (member) {
        deletedGuildMembers.add(member);
        guild.members.cache.delete(member.id);
        if (shard.status === Status.READY) client.emit(Events.GUILD_MEMBER_REMOVE, member);
      }
      guild.presences.cache.delete(data.user.id);
      guild.voiceStates.cache.delete(data.user.id);
    }
    return { guild, member };
  }
}

export default GuildMemberRemoveAction;
