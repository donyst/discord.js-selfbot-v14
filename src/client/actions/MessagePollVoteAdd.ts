import type { Snowflake } from 'discord-api-types/v10';
import GenericAction from './Action.js';
import { Events } from '../../util/Constants.js';
import type { Poll } from '../../structures/Poll.js';

export class MessagePollVoteAddAction extends GenericAction {
  public override handle(data: {
    channel_id: Snowflake;
    message_id: Snowflake;
    answer_id: number;
    user_id: Snowflake;
    [key: string]: unknown;
  }): { poll?: Poll } | false {
    const channel = this.getChannel(data);
    if (!(channel as any)?.isText()) return false;

    const message = this.getMessage(data, channel as any);
    if (!message) return false;

    const poll = (message as any).poll;
    const answer = poll?.answers.get(data.answer_id);
    if (!answer) return false;

    answer.voteCount++;
    this.client.emit(Events.MESSAGE_POLL_VOTE_ADD, answer, data.user_id);

    return { poll };
  }
}

export default MessagePollVoteAddAction;
