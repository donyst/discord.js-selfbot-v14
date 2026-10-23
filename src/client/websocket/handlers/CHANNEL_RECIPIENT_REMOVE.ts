import type { Client } from '../../Client.js';
import type { GatewayPacket } from '../WebSocketManager.js';
import { Events } from '../../../util/Constants.js';

export default (client: Client, packet: GatewayPacket): void => {
  const d = packet.d as { channel_id: string; user: { id: string; [key: string]: unknown } };
  const channel = client.channels.cache.get(d.channel_id) as { _recipients?: Array<{ id: string }> } | undefined;
  if (channel) {
    if (!channel._recipients) channel._recipients = [];
    channel._recipients = channel._recipients.filter(u => u.id !== d.user.id);
    const user = (client.users as unknown as { _add(u: unknown): unknown })._add(d.user);
    client.emit(Events.CHANNEL_RECIPIENT_REMOVE, channel, user);
  }
};
