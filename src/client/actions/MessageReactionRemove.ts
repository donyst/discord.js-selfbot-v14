import type { Snowflake } from 'discord-api-types/v10';
import GenericAction from './Action.js';
import { Events } from '../../util/Constants.js';
import type { Message } from '../../structures/Message.js';
import type { MessageReaction } from '../../structures/MessageReaction.js';
import type { User } from '../../structures/User.js';

export class MessageReactionRemove extends GenericAction {
  public override handle(data: {
    user_id: Snowflake;
    message_id: Snowflake;
    channel_id: Snowflake;
    guild_id?: Snowflake;
    emoji?: { name: string; id: Snowflake | null };
    burst?: boolean;
    type?: number;
    [key: string]: unknown;
  }): { message: Message; reaction: MessageReaction; user: User } | false {
    if (!data.emoji) return false;

    const user = this.getUser(data);
    if (!user) return false;

    const channel = this.getChannel({
      id: data.channel_id,
      user_id: data.user_id,
      ...('guild_id' in data && { guild_id: data.guild_id }),
    });
    if (!channel || !(channel as any).isText()) return false;

    const message = this.getMessage(data, channel as any);
    if (!message) return false;

    const reaction = this.getReaction(data as any, message as any, user);
    if (!reaction) return false;
    reaction._remove(user, data.burst);

    this.client.emit(Events.MESSAGE_REACTION_REMOVE, reaction, user, { type: data.type, burst: data.burst });

    return { message, reaction, user };
  }
}

export default MessageReactionRemove;
