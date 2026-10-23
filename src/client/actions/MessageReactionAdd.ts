import type { Snowflake } from 'discord-api-types/v10';
import GenericAction from './Action.js';
import { Events, PartialTypes } from '../../util/Constants.js';
import type { Message } from '../../structures/Message.js';
import type { MessageReaction } from '../../structures/MessageReaction.js';
import type { User } from '../../structures/User.js';

export interface MessageReactionEventDetails {
  type?: number;
  burst?: boolean;
}

export class MessageReactionAdd extends GenericAction {
  public override handle(
    data: {
      user_id: Snowflake;
      message_id: Snowflake;
      channel_id: Snowflake;
      guild_id?: Snowflake;
      emoji?: { name: string; id: Snowflake | null };
      burst?: boolean;
      type?: number;
      member?: { user: { id: Snowflake } };
      [key: string]: unknown;
    },
    fromStructure = false,
  ): { message: Message; reaction: MessageReaction; user: User } | false {
    if (!data.emoji) return false;

    const user = this.getUserFromMember(data);
    if (!user) return false;

    const channel = this.getChannel({
      id: data.channel_id,
      user_id: data.user_id,
      ...('guild_id' in data && { guild_id: data.guild_id }),
    });
    if (!channel || !(channel as any).isText()) return false;

    const message = this.getMessage(data, channel as any);
    if (!message) return false;

    const includePartial = (this.client.options.partials as readonly string[]).includes(PartialTypes.REACTION);
    if ((message as any).partial && !includePartial) return false;
    const reaction = (message as any).reactions._add({
      emoji: data.emoji,
      count: (message as any).partial ? null : 0,
      me: user.id === (this.client.user as any)?.id,
      ...data,
    });
    if (!reaction) return false;
    reaction._add(user, data.burst);
    if (fromStructure) return { message, reaction, user };

    this.client.emit(Events.MESSAGE_REACTION_ADD, reaction, user, { type: data.type, burst: data.burst });

    return { message, reaction, user };
  }
}

export default MessageReactionAdd;
