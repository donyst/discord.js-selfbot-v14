import type { Client } from '../../Client.js';
import type { GatewayPacket } from '../WebSocketManager.js';

export default (client: Client, packet: GatewayPacket): void => {
  (client.actions.InviteDelete as unknown as { handle(data: unknown): void }).handle(packet.d);
};
