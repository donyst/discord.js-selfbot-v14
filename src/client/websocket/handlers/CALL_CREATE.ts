import type { Client } from '../../Client.js';
import type { GatewayPacket } from '../WebSocketManager.js';
import CallState, { type RawCallStateData } from '../../../structures/CallState.js';
import { Events } from '../../../util/Constants.js';

export default (client: Client, packet: GatewayPacket): void => {
  const d = packet.d as { voice_states?: unknown[] };
  if (Array.isArray(d?.voice_states)) {
    for (const voice of d.voice_states) {
      (client.actions.VoiceStateUpdate as unknown as { handle(v: unknown): void }).handle(voice);
    }
  }
  client.emit(Events.CALL_CREATE, new CallState(client, packet.d as RawCallStateData));
};
