import type { Client } from '../../Client.js';
import type { GatewayPacket } from '../WebSocketManager.js';
import { Events } from '../../../util/Constants.js';

export default (client: Client, { d: data }: GatewayPacket): void => {
  const d = data as { id: string; type?: number; nickname?: string | null; since?: string };
  const oldType = client.relationships.cache.get(d.id);
  const oldSince = client.relationships.sinceCache.get(d.id);
  const oldNickname = client.relationships.friendNicknames.get(d.id);

  if (d.type !== undefined) client.relationships.cache.set(d.id, d.type);
  if (d.nickname !== undefined) client.relationships.friendNicknames.set(d.id, d.nickname ?? '');
  if (d.since) client.relationships.sinceCache.set(d.id, new Date(d.since || 0));

  client.emit(
    Events.RELATIONSHIP_UPDATE,
    d.id,
    {
      type: oldType,
      nickname: oldNickname,
      since: oldSince,
    },
    {
      type: d.type,
      nickname: d.nickname,
      since: new Date(d.since || 0),
    },
  );
};
