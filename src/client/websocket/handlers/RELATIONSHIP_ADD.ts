import type { Client } from '../../Client.js';
import type { GatewayPacket } from '../WebSocketManager.js';
import { Events } from '../../../util/Constants.js';

export default (client: Client, { d: data }: GatewayPacket): void => {
  const d = data as { id: string; user?: unknown; type: number; nickname?: string | null; since?: string; should_notify?: boolean };
  if (d.user) {
    (client.users as unknown as { _add(u: unknown): unknown })._add(d.user);
  }
  client.relationships.cache.set(d.id, d.type);
  if (d.nickname !== undefined) client.relationships.friendNicknames.set(d.id, d.nickname ?? '');
  client.relationships.sinceCache.set(d.id, new Date(d.since || 0));

  client.emit(Events.RELATIONSHIP_ADD, d.id, Boolean(d.should_notify));
};
