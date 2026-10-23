import type { Client } from '../../Client.js';
import type { GatewayPacket } from '../WebSocketManager.js';

export default (client: Client, { d: data }: GatewayPacket): void => {
  (client.settings as unknown as { _patch(d: unknown): void })._patch(data);
};
