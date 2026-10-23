import type { Client } from '../../Client.js';
import type { GatewayPacket } from '../WebSocketManager.js';
import type { WebSocketShard } from '../WebSocketShard.js';

export default (client: Client, packet: GatewayPacket, shard: WebSocketShard): void => {
  (client.actions.GuildMemberRemove as unknown as { handle(data: unknown, s: WebSocketShard): void }).handle(packet.d, shard);
};
