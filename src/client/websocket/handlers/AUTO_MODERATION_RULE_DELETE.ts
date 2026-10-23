import type { Client } from '../../Client.js';
import type { GatewayPacket } from '../WebSocketManager.js';

export default (client: Client, packet: GatewayPacket): void => {
  (client.actions.AutoModerationRuleDelete as unknown as { handle(data: unknown): void }).handle(packet.d);
};
