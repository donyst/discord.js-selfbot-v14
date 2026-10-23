import type { Client } from '../../Client.js';
import type { GatewayPacket } from '../WebSocketManager.js';
import type { WebSocketShard } from '../WebSocketShard.js';
import USER_REQUIRED_ACTION from './USER_REQUIRED_ACTION_UPDATE.js';
import { Opcodes } from '../../../util/Constants.js';
import ClientUser from '../../../structures/ClientUser.js';

export default (client: Client, { d: data }: GatewayPacket, shard: WebSocketShard): void => {
  const d = data as {
    user: { id: string; [key: string]: unknown };
    private_channels: Array<{ id: string; [key: string]: unknown }>;
    guilds: Array<{ id: string; shardId?: number; [key: string]: unknown }>;
    notes: unknown;
    relationships: unknown;
    user_settings: unknown;
    user_guild_settings?: Array<{ guild_id: string; [key: string]: unknown }>;
    auth_session_id_hash?: string;
  };

  USER_REQUIRED_ACTION(client, { d: data, op: 0 });

  (client.presence as unknown as { userId: string }).userId = d.user.id;

  if (client.user) {
    (client.user as unknown as { _patch(u: unknown): void })._patch(d.user);
  } else {
    client.user = new ClientUser(client, d.user);
    client.users.cache.set(client.user.id, client.user);
  }

  for (const private_channel of d.private_channels) {
    (client.channels as unknown as { _add(c: unknown): unknown })._add(private_channel);
  }

  for (const guild of d.guilds) {
    guild.shardId = shard.id;
    (client.guilds as unknown as { _add(g: unknown): unknown })._add(guild);
  }

  (client.notes as unknown as { _reload(n: unknown): void })._reload(d.notes);
  (client.relationships as unknown as { _setup(r: unknown): void })._setup(d.relationships);
  (client.settings as unknown as { _patch(s: unknown): void })._patch(d.user_settings);

  for (const gSetting of Array.isArray(d.user_guild_settings) ? d.user_guild_settings : []) {
    const guild = client.guilds.cache.get(gSetting.guild_id);
    if (guild) (guild.settings as unknown as { _patch(s: unknown): void })._patch(gSetting);
  }

  (client.sessions as unknown as { currentSessionIdHash?: string }).currentSessionIdHash = d.auth_session_id_hash;

  if (d.guilds.length) {
    if (d.guilds.length > 80) {
      const data1 = d.guilds.slice(0, Math.floor(d.guilds.length / 2));
      const data2 = d.guilds.slice(Math.floor(d.guilds.length / 2));
      const makeSubs = (list: typeof d.guilds) => list.reduce((acc, guild) => {
        acc[guild.id] = {
          typing: true,
          threads: true,
          activities: true,
          member_updates: true,
          thread_member_lists: [],
          members: [],
          channels: {},
        };
        return acc;
      }, {} as Record<string, unknown>);

      (client.ws as unknown as { broadcast(p: unknown): void }).broadcast({
        op: Opcodes.GUILD_SUBSCRIPTIONS_BULK,
        d: { subscriptions: makeSubs(data1) },
      });
      (client.ws as unknown as { broadcast(p: unknown): void }).broadcast({
        op: Opcodes.GUILD_SUBSCRIPTIONS_BULK,
        d: { subscriptions: makeSubs(data2) },
      });
    } else {
      const subscriptions = d.guilds.reduce((acc, guild) => {
        acc[guild.id] = {
          typing: true,
          threads: true,
          activities: true,
          member_updates: true,
          thread_member_lists: [],
          members: [],
          channels: {},
        };
        return acc;
      }, {} as Record<string, unknown>);

      (client.ws as unknown as { broadcast(p: unknown): void }).broadcast({
        op: Opcodes.GUILD_SUBSCRIPTIONS_BULK,
        d: { subscriptions },
      });
    }
  }

  Promise.all(
    d.private_channels.map(async (c, index) => {
      if (client.options.DMChannelVoiceStatusSync < 1) return;
      (client.ws as unknown as { broadcast(p: unknown): void }).broadcast({
        op: Opcodes.DM_UPDATE,
        d: {
          channel_id: c.id,
        },
      });
      await client.sleep(client.options.DMChannelVoiceStatusSync * index);
    }),
  ).then(() => shard.checkReady());
};
