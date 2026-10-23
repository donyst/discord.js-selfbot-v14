import process from 'node:process';
import type { Snowflake } from 'discord-api-types/v10';
import GenericAction from './Action.js';
import { Events } from '../../util/Constants.js';
import type { Message, RawMessageData } from '../../structures/Message.js';

let deprecationEmitted = false;

export class MessageCreateAction extends GenericAction {
  public override handle(data: RawMessageData & { channel_id: Snowflake; guild_id?: Snowflake }): { message?: Message } {
    const client = this.client;
    const channel = this.getChannel({
      id: data.channel_id,
      author: data.author,
      ...('guild_id' in data && { guild_id: data.guild_id }),
    });

    if (channel) {
      if (!(channel as any).isText()) return {};

      const existing = (channel as any).messages.cache.get(data.id) as Message | undefined;
      if (existing && existing.author?.id !== (this.client.user as any)?.id) return { message: existing };
      const message = existing ?? (channel as any).messages._add(data);
      (channel as any).lastMessageId = data.id;

      client.emit(Events.MESSAGE_CREATE, message);

      if (client.emit('message', message) && !deprecationEmitted) {
        deprecationEmitted = true;
        process.emitWarning('The message event is deprecated. Use messageCreate instead', 'DeprecationWarning');
      }

      return { message };
    }

    return {};
  }
}

export default MessageCreateAction;
