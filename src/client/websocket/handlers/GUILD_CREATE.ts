import type { Client } from '../../Client.js';
import type { GatewayPacket } from '../WebSocketManager.js';
import type { WebSocketShard } from '../WebSocketShard.js';
import { Events, Opcodes, Status } from '../../../util/Constants.js';
import type { Guild } from '../../../structures/Guild.js';

const run = (client: Client, guild: { id: string }): void => {
  const subs: Record<string, unknown> = {};
  subs[guild.id] = {
    typing: true,
    threads: true,
    activities: true,
    member_updates: true,
    thread_member_lists: [],
    members: [],
    channels: {},
  };
  (client.ws as unknown as { broadcast(p: unknown): void }).broadcast({
    op: Opcodes.GUILD_SUBSCRIPTIONS_BULK,
    d: {
      subscriptions: subs,
    },
  });
};

export default (client: Client, { d: data }: GatewayPacket, shard: WebSocketShard): void => {
  const d = data as { id: string; unavailable?: boolean; shardId?: number };
  let guild = client.guilds.cache.get(d.id);
  run(client, d);
  if (guild) {
    if (!guild.available && !d.unavailable) {
      (guild as unknown as { _patch(d: unknown): void })._patch(d);
      client.emit(Events.GUILD_AVAILABLE, guild);
    }
  } else {
    d.shardId = shard.id;
    guild = (client.guilds as unknown as { _add(data: unknown): Guild })._add(d);
    if ((client.ws as unknown as { status: number }).status === Status.READY) {
      client.emit(Events.GUILD_CREATE, guild);
      run(client, guild);
    }
  }
};
