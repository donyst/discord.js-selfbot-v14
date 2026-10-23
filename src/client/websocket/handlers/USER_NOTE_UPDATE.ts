import type { Client } from '../../Client.js';
import type { GatewayPacket } from '../WebSocketManager.js';

export default (client: Client, { d: data }: GatewayPacket): void => {
  const d = data as { id: string; note: string };
  client.notes.cache.set(d.id, d.note);
};
