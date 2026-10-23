import { Collection } from '@discordjs/collection';
import type { Client } from '../../Client.js';
import type { GatewayPacket } from '../WebSocketManager.js';
import { Events } from '../../../util/Constants.js';
import type { GuildMember } from '../../../structures/GuildMember.js';

export default (client: Client, { d: data }: GatewayPacket): void => {
  const d = data as {
    guild_id: string;
    members: Array<{ user: { id: string }; [key: string]: unknown }>;
    presences?: unknown[];
    chunk_count: number;
    chunk_index: number;
    nonce?: string | null;
    not_found?: unknown[];
  };
  const guild = client.guilds.cache.get(d.guild_id);
  if (!guild) return;
  const members = new Collection<string, GuildMember>();

  for (const member of d.members) {
    members.set(member.user.id, (guild.members as unknown as { _add(m: unknown): GuildMember })._add(member));
  }
  if (d.presences) {
    for (const presence of d.presences) {
      (guild.presences as unknown as { _add(p: unknown): unknown })._add(Object.assign(presence as object, { guild }));
    }
  }

  client.emit(Events.GUILD_MEMBERS_CHUNK, members, guild, {
    count: d.chunk_count,
    index: d.chunk_index,
    nonce: d.nonce,
    notFound: d.not_found,
  });
};
