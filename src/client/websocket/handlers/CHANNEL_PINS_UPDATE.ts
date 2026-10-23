import type { Client } from '../../Client.js';
import type { GatewayPacket } from '../WebSocketManager.js';
import { Events } from '../../../util/Constants.js';

export default (client: Client, { d: data }: GatewayPacket): void => {
  const d = data as { channel_id: string; last_pin_timestamp?: string | null };
  const channel = client.channels.cache.get(d.channel_id);
  const time = d.last_pin_timestamp ? new Date(d.last_pin_timestamp).getTime() : null;

  if (channel) {
    (channel as unknown as { lastPinTimestamp: number | null }).lastPinTimestamp = time;
    client.emit(Events.CHANNEL_PINS_UPDATE, channel, time ? new Date(time) : null);
  }
};
