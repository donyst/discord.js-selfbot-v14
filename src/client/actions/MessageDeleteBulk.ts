import { Collection } from '@discordjs/collection';
import type { Snowflake } from 'discord-api-types/v10';
import GenericAction from './Action.js';
import { deletedMessages, type Message } from '../../structures/Message.js';
import { Events } from '../../util/Constants.js';

export class MessageDeleteBulkAction extends GenericAction {
  public override handle(data: { channel_id: Snowflake; ids: Snowflake[]; guild_id?: Snowflake }): {
    messages?: Collection<Snowflake, Message>;
  } {
    const client = this.client;
    const channel = client.channels.cache.get(data.channel_id);

    if (channel) {
      if (!(channel as any).isText()) return {};

      const ids = data.ids;
      const messages = new Collection<Snowflake, Message>();
      for (const id of ids) {
        const message = this.getMessage(
          {
            id,
            guild_id: data.guild_id,
          },
          channel as any,
          false,
        );
        if (message) {
          deletedMessages.add(message);
          messages.set(message.id, message);
          (channel as any).messages.cache.delete(id);
        }
      }

      if (messages.size > 0) client.emit(Events.MESSAGE_BULK_DELETE, messages);
      return { messages };
    }
    return {};
  }
}

export default MessageDeleteBulkAction;
