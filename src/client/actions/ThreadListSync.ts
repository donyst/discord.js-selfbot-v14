import { Collection } from '@discordjs/collection';
import Action from './Action.js';
import { Events } from '../../util/Constants.js';
import type { Snowflake } from '../../types/index.js';
import type { ThreadChannel } from '../../structures/ThreadChannel.js';

export interface RawThreadListSyncData {
  guild_id: Snowflake;
  channel_ids?: Snowflake[];
  threads: Record<string, unknown>[];
  members?: Record<string, { id: Snowflake; user_id?: Snowflake; [key: string]: unknown }>;
}

export interface ThreadListSyncResult {
  syncedThreads?: Collection<Snowflake, ThreadChannel>;
}

export class ThreadListSyncAction extends Action {
  public handle(data: RawThreadListSyncData): ThreadListSyncResult {
    const client = this.client;

    const guild = client.guilds.cache.get(data.guild_id);
    if (!guild) return {};

    if (data.channel_ids) {
      for (const id of data.channel_ids) {
        const channel = client.channels.cache.get(id);
        if (channel) this.removeStale(channel as { threads?: { cache: Map<string, ThreadChannel> } });
      }
    } else {
      for (const channel of guild.channels.cache.values()) {
        this.removeStale(channel as unknown as { threads?: { cache: Map<string, ThreadChannel> } });
      }
    }

    const syncedThreads = data.threads.reduce((coll, rawThread) => {
      const thread = (client.channels as unknown as { _add(d: unknown): ThreadChannel })._add(rawThread);
      return coll.set(thread.id, thread);
    }, new Collection<Snowflake, ThreadChannel>());

    for (const rawMember of Object.values(data.members || {})) {
      // Discord sends the thread id as id in this object
      const thread = client.channels.cache.get(rawMember.id) as ThreadChannel | undefined;
      if (thread?.members) {
        (thread.members as unknown as { _add(d: unknown): unknown })._add(rawMember);
      }
    }

    client.emit(Events.THREAD_LIST_SYNC, syncedThreads);

    return {
      syncedThreads,
    };
  }

  public removeStale(channel: { threads?: { cache: Map<string, ThreadChannel> } }): void {
    channel.threads?.cache.forEach(thread => {
      if (!thread.archived) {
        (this.client.channels as unknown as { _remove(id: string): void })._remove(thread.id);
      }
    });
  }
}

export default ThreadListSyncAction;
