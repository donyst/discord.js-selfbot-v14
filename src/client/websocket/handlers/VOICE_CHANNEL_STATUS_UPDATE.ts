import type { Client } from '../../Client.js';
import type { GatewayPacket } from '../WebSocketManager.js';
import { Events } from '../../../util/Constants.js';
import type { VoiceChannel } from '../../../structures/VoiceChannel.js';

export default (client: Client, { d: data }: GatewayPacket): void => {
  const d = data as { id: string; status: string };
  const channel = client.channels.cache.get(d.id) as VoiceChannel | undefined;
  if (channel) {
    const old = (channel as unknown as { _clone(): VoiceChannel })._clone();
    (channel as unknown as { status: string }).status = d.status;
    client.emit(Events.CHANNEL_UPDATE, old, channel);
  }
};
