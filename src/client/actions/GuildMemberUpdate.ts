import type { Snowflake } from 'discord-api-types/v10';
import GenericAction from './Action.js';
import { Status, Events } from '../../util/Constants.js';
import type { APIGuildMemberData } from '../../structures/GuildMember.js';
import type { WebSocketShard } from '../websocket/WebSocketShard.js';

export class GuildMemberUpdateAction extends GenericAction {
  public override handle(
    data: APIGuildMemberData & { guild_id: Snowflake; user: { id: Snowflake; username?: string } },
    shard: WebSocketShard,
  ): void {
    const { client } = this;
    if (data.user.username) {
      const user = client.users.cache.get(data.user.id);
      if (!user) {
        client.users._add(data.user);
      } else if (!user._equals(data.user)) {
        (client.actions as unknown as Record<string, { handle: (...args: unknown[]) => unknown }>).UserUpdate.handle(data.user);
      }
    }

    const guild = client.guilds.cache.get(data.guild_id);
    if (guild) {
      const member = this.getMember({ user: data.user }, guild);
      if (member) {
        const old = member._update(data);
        if (shard.status === Status.READY && !member.equals(old)) {
          client.emit(Events.GUILD_MEMBER_UPDATE, old, member);
        }
      } else {
        const newMember = guild.members._add(data);
        this.client.emit(Events.GUILD_MEMBER_AVAILABLE, newMember);
      }
    }
  }
}

export default GuildMemberUpdateAction;
