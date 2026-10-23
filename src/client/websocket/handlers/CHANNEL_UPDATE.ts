import type { Client } from '../../Client.js';
import type { GatewayPacket } from '../WebSocketManager.js';
import { Events } from '../../../util/Constants.js';

export default (client: Client, packet: GatewayPacket): void => {
  const { old, updated } = client.actions.ChannelUpdate.handle(packet.d as Parameters<typeof client.actions.ChannelUpdate.handle>[0]);
  if (old && updated) {
    client.emit(Events.CHANNEL_UPDATE, old, updated);
  }
};
