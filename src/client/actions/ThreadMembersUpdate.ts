import Action from './Action.js';
import { Events } from '../../util/Constants.js';
import type { Snowflake } from '../../types/index.js';
import type { ThreadChannel } from '../../structures/ThreadChannel.js';

export interface RawThreadMembersUpdateData {
  id: Snowflake; // thread id
  member_count?: number;
  added_members?: Record<string, unknown>[];
  removed_member_ids?: Snowflake[];
  [key: string]: unknown;
}

export class ThreadMembersUpdateAction extends Action {
  public handle(data: RawThreadMembersUpdateData): Record<string, unknown> {
    const client = this.client;
    const thread = client.channels.cache.get(data.id) as ThreadChannel | undefined;
    if (thread?.members) {
      const old = thread.members.cache.clone();
      if (typeof data.member_count === 'number') {
        (thread as unknown as { memberCount: number }).memberCount = data.member_count;
      }

      data.added_members?.forEach(rawMember => {
        (thread.members as unknown as { _add(d: unknown): unknown })._add(rawMember);
      });

      data.removed_member_ids?.forEach(memberId => {
        thread.members.cache.delete(memberId);
      });

      client.emit(Events.THREAD_MEMBERS_UPDATE, old, thread.members.cache);
    }
    return {};
  }
}

export default ThreadMembersUpdateAction;
