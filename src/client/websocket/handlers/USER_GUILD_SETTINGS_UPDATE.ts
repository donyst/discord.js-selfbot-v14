import type { Client } from '../../Client.js';
import type { GatewayPacket } from '../WebSocketManager.js';

export default (client: Client, { d: data }: GatewayPacket): void => {
  const d = data as { guild_id: string; [key: string]: unknown };
  const guild = client.guilds.cache.get(d.guild_id);
  if (guild) {
    (guild.settings as unknown as { _patch(d: unknown): void })._patch(d);
  }
};
