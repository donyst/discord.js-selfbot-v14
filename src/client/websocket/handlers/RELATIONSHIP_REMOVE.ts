import type { Client } from '../../Client.js';
import type { GatewayPacket } from '../WebSocketManager.js';
import { Events } from '../../../util/Constants.js';

export default (client: Client, { d: data }: GatewayPacket): void => {
  const d = data as { id: string; type: number; nickname?: string | null };
  client.relationships.cache.delete(d.id);
  client.relationships.friendNicknames.delete(d.id);
  client.relationships.sinceCache.delete(d.id);

  client.emit(Events.RELATIONSHIP_REMOVE, d.id, d.type, d.nickname);
};
