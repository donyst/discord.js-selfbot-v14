import type { Snowflake } from 'discord-api-types/v10';
import GenericAction from './Action.js';
import { deletedMessages, type Message } from '../../structures/Message.js';
import { Events } from '../../util/Constants.js';

export class MessageDeleteAction extends GenericAction {
  public override handle(data: { id: Snowflake; channel_id: Snowflake; guild_id?: Snowflake }): { message?: Message } {
    const client = this.client;
    const channel = this.getChannel({ id: data.channel_id, ...('guild_id' in data && { guild_id: data.guild_id }) });
    let message: Message | undefined;

    if (channel) {
      if (!(channel as any).isText()) return {};

      message = this.getMessage(data, channel as any);
      if (message) {
        (channel as any).messages.cache.delete(message.id);
        deletedMessages.add(message);
        client.emit(Events.MESSAGE_DELETE, message);
      }
    }

    return { message };
  }
}

export default MessageDeleteAction;
