import Action from './Action.js';
import { Typing, type RawTypingData } from '../../structures/Typing.js';
import { Events } from '../../util/Constants.js';
import type { Snowflake, TextBasedChannels } from '../../types/index.js';

export interface RawTypingStartData extends RawTypingData {
  channel_id: Snowflake;
  guild_id?: Snowflake;
  user_id?: Snowflake;
  member?: Record<string, unknown>;
  [key: string]: unknown;
}

export class TypingStart extends Action {
  public handle(data: RawTypingStartData): void {
    const channel = this.getChannel({ id: data.channel_id, ...(data.guild_id ? { guild_id: data.guild_id } : {}) }) as unknown as (TextBasedChannels & { isText?(): boolean; type?: string; id?: string }) | null;
    if (!channel) return;

    if (typeof channel.isText === 'function' && !channel.isText()) {
      this.client.emit(Events.WARN, `Discord sent a typing packet to a ${channel.type} channel ${channel.id}`);
      return;
    }

    const user = this.getUserFromMember(data);
    if (user) {
      this.client.emit(Events.TYPING_START, new Typing(channel, user, data));
    }
  }
}

export default TypingStart;
