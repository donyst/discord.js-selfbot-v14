import Action from './Action.js';
import { Events } from '../../util/Constants.js';
import type { Snowflake } from '../../types/index.js';
import type { ThreadChannel } from '../../structures/ThreadChannel.js';
import type { ThreadMember } from '../../structures/ThreadMember.js';

export interface RawThreadMemberUpdateData {
  id: Snowflake; // thread id
  user_id: Snowflake;
  [key: string]: unknown;
}

export interface ThreadMemberUpdateResult {
  newMember?: ThreadMember;
}

export class ThreadMemberUpdateAction extends Action {
  public handle(data: RawThreadMemberUpdateData): ThreadMemberUpdateResult {
    const client = this.client;
    const thread = client.channels.cache.get(data.id) as ThreadChannel | undefined;
    if (thread?.members) {
      const member = thread.members.cache.get(data.user_id);
      if (!member) {
        const newMember = (thread.members as unknown as { _add(d: unknown): ThreadMember })._add(data);
        return { newMember };
      }
      const old = (member as unknown as { _update(d: unknown): ThreadMember })._update(data);
      client.emit(Events.THREAD_MEMBER_UPDATE, old, member);
    }
    return {};
  }
}

export default ThreadMemberUpdateAction;
