import type { Client } from '../../Client.js';
import type { GatewayPacket } from '../WebSocketManager.js';
import Modal, { type APIModalData } from '../../../structures/Modal.js';
import { Events } from '../../../util/Constants.js';

export default (client: Client, { d: data }: GatewayPacket): void => {
  client.emit(Events.INTERACTION_MODAL_CREATE, new Modal(data as APIModalData, client));
};
