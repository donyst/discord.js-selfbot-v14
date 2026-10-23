import type { Snowflake } from 'discord-api-types/v10';
import GenericAction from './Action.js';
import { Events } from '../../util/Constants.js';
import type { Channel } from '../../structures/Channel.js';

export class ChannelCreateAction extends GenericAction {
  public override handle(data: { id: Snowflake; [key: string]: unknown }): { channel?: Channel } {
    const client = this.client;
    const existing = client.channels.cache.has(data.id);
    const channel = client.channels._add(data);
    if (!existing && channel) {
      client.emit(Events.CHANNEL_CREATE, channel);
    }
    return { channel: channel ?? undefined };
  }
}

export default ChannelCreateAction;
