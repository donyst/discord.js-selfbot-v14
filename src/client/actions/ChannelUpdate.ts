import type { Snowflake } from 'discord-api-types/v10';
import GenericAction from './Action.js';
import { Channel } from '../../structures/Channel.js';
import { ChannelTypes } from '../../util/Constants.js';
import type { Message } from '../../structures/Message.js';

export interface ChannelUpdateResult {
  old?: unknown;
  updated?: Channel;
}

export class ChannelUpdateAction extends GenericAction {
  public override handle(data: { id: Snowflake; type?: number; [key: string]: unknown }): ChannelUpdateResult {
    const client = this.client;
    let channel = client.channels.cache.get(data.id);

    if (channel) {
      const old = (channel as any)._update(data);

      if ((ChannelTypes as Record<string, number>)[channel.type] !== data.type) {
        const newChannel = Channel.create(this.client, data as any, (channel as any).guild);

        if (!newChannel) {
          this.client.channels.cache.delete(channel.id);
          return {};
        }

        if (channel.isText() && newChannel.isText()) {
          for (const [id, message] of (channel as any).messages.cache as Iterable<[Snowflake, Message]>) {
            (newChannel as any).messages.cache.set(id, message);
          }
        }

        channel = newChannel;
        this.client.channels.cache.set(channel.id, channel);
      }

      return {
        old,
        updated: channel,
      };
    }

    client.channels._add(data);
    return {};
  }
}

export default ChannelUpdateAction;
