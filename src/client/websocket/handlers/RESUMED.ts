import type { Client } from '../../Client.js';
import type { GatewayPacket } from '../WebSocketManager.js';
import type { WebSocketShard } from '../WebSocketShard.js';
import { Events } from '../../../util/Constants.js';

export default (client: Client, _packet: GatewayPacket, shard: WebSocketShard): void => {
  const replayed = shard.sequence - shard.closeSequence;
  client.emit(Events.SHARD_RESUME, shard.id, replayed);
};
