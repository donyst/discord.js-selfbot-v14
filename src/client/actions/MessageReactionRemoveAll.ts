import type { Snowflake } from 'discord-api-types/v10';
import GenericAction from './Action.js';
import { Events } from '../../util/Constants.js';
import type { Message } from '../../structures/Message.js';

export class MessageReactionRemoveAll extends GenericAction {
  public override handle(data: { channel_id: Snowflake; guild_id?: Snowflake; [key: string]: unknown }): {
    message?: Message;
  } | false {
    const channel = this.getChannel({ id: data.channel_id, ...('guild_id' in data && { guild_id: data.guild_id }) });
    if (!channel || !(channel as any).isText()) return false;

    const message = this.getMessage(data, channel as any);
    if (!message) return false;

    const removed = (message as any).reactions.cache.clone();
    (message as any).reactions.cache.clear();
    this.client.emit(Events.MESSAGE_REACTION_REMOVE_ALL, message, removed);

    return { message };
  }
}

export default MessageReactionRemoveAll;
