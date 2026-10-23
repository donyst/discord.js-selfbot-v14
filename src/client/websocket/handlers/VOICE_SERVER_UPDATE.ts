import type { Client } from '../../Client.js';
import type { GatewayPacket } from '../WebSocketManager.js';

export default (client: Client, packet: GatewayPacket): void => {
  client.emit('debug', `[VOICE] received voice server: ${JSON.stringify(packet)}`);
  (client.voice as unknown as { onVoiceServer(d: unknown): void }).onVoiceServer(packet.d);
};
