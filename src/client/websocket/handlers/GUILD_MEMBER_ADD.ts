import type { Client } from '../../Client.js';
import type { GatewayPacket } from '../WebSocketManager.js';
import type { WebSocketShard } from '../WebSocketShard.js';
import { Events, Status } from '../../../util/Constants.js';
import type { GuildMember } from '../../../structures/GuildMember.js';

export default (client: Client, { d: data }: GatewayPacket, shard: WebSocketShard): void => {
  const d = data as { guild_id: string; [key: string]: unknown };
  const guild = client.guilds.cache.get(d.guild_id);
  if (guild) {
    guild.memberCount++;
    const member = (guild.members as unknown as { _add(d: unknown): GuildMember })._add(d);
    if (shard.status === Status.READY) {
      client.emit(Events.GUILD_MEMBER_ADD, member);
    }
  }
};
