import type { Client } from '../../Client.js';
import type { GatewayPacket } from '../WebSocketManager.js';
import type { WebSocketShard } from '../WebSocketShard.js';
import { Events, Status } from '../../../util/Constants.js';

export default (client: Client, packet: GatewayPacket, shard: WebSocketShard): void => {
  const d = packet.d as { channel_id: string; user: { id: string; [key: string]: unknown } };
  const channel = client.channels.cache.get(d.channel_id) as { _recipients?: unknown[] } | undefined;
  if (channel) {
    if (!channel._recipients) channel._recipients = [];
    channel._recipients.push(d.user);
    const user = (client.users as unknown as { _add(u: unknown): unknown })._add(d.user);
    if (shard.status === Status.READY) {
      client.emit(Events.CHANNEL_RECIPIENT_ADD, channel, user);
    }
  }
};
