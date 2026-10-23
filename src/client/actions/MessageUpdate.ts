import type { Snowflake } from 'discord-api-types/v10';
import GenericAction from './Action.js';
import type { Message, RawMessageData } from '../../structures/Message.js';

export interface MessageUpdateResult {
  old?: unknown;
  updated?: Message;
}

export class MessageUpdateAction extends GenericAction {
  public override handle(data: RawMessageData & { id: Snowflake; channel_id: Snowflake; guild_id?: Snowflake }): MessageUpdateResult {
    const channel = this.getChannel({ id: data.channel_id, ...('guild_id' in data && { guild_id: data.guild_id }) });
    if (channel) {
      if (!(channel as any).isText()) return {};

      const { id, channel_id, guild_id, author, timestamp, type } = data;
      const message = this.getMessage({ id, channel_id, guild_id, author, timestamp, type }, channel as any);
      if (message) {
        const old = (message as any)._update(data);
        return {
          old,
          updated: message,
        };
      }
    }

    return {};
  }
}

export default MessageUpdateAction;
