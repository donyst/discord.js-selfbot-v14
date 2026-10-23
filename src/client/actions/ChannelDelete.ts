import type { Snowflake } from 'discord-api-types/v10';
import GenericAction from './Action.js';
import { deletedChannels, type Channel } from '../../structures/Channel.js';
import DMChannel from '../../structures/DMChannel.js';
import { deletedMessages, type Message } from '../../structures/Message.js';
import { Events } from '../../util/Constants.js';
import type { Client } from '../Client.js';

export class ChannelDeleteAction extends GenericAction {
  public deleted: Map<unknown, unknown>;

  public constructor(client: Client) {
    super(client);
    this.deleted = new Map();
  }

  public override handle(data: { id: Snowflake }): { channel?: Channel } {
    const client = this.client;
    const channel = client.channels.cache.get(data.id);

    if (channel) {
      client.channels._remove(channel.id);
      deletedChannels.add(channel);
      if ((channel as any).messages && !(channel instanceof DMChannel)) {
        for (const message of (channel as any).messages.cache.values()) {
          deletedMessages.add(message as Message);
        }
      }
      client.emit(Events.CHANNEL_DELETE, channel);
    }

    return { channel };
  }
}

export default ChannelDeleteAction;
