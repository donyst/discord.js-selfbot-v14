import type { Snowflake } from 'discord-api-types/v10';
import GenericAction from './Action.js';
import { Events } from '../../util/Constants.js';
import type { MessageReaction } from '../../structures/MessageReaction.js';

export class MessageReactionRemoveEmoji extends GenericAction {
  public override handle(data: {
    channel_id: Snowflake;
    message_id: Snowflake;
    guild_id?: Snowflake;
    emoji: { name: string; id: Snowflake | null };
    [key: string]: unknown;
  }): { reaction?: MessageReaction } | false {
    const channel = this.getChannel({ id: data.channel_id, ...('guild_id' in data && { guild_id: data.guild_id }) });
    if (!channel || !(channel as any).isText()) return false;

    const message = this.getMessage(data, channel as any);
    if (!message) return false;

    const reaction = this.getReaction(data, message as any);
    if (!reaction) return false;
    if (!(message as any).partial) (message as any).reactions.cache.delete(reaction.emoji.id ?? reaction.emoji.name);

    this.client.emit(Events.MESSAGE_REACTION_REMOVE_EMOJI, reaction);
    return { reaction };
  }
}

export default MessageReactionRemoveEmoji;
