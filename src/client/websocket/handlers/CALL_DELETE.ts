import type { Client } from '../../Client.js';
import type { GatewayPacket } from '../WebSocketManager.js';
import CallState, { type RawCallStateData } from '../../../structures/CallState.js';
import { Events } from '../../../util/Constants.js';

export default (client: Client, packet: GatewayPacket): void => {
  client.emit(Events.CALL_DELETE, new CallState(client, packet.d as RawCallStateData));
};
