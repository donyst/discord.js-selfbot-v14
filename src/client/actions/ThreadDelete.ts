import Action from './Action.js';
import { deletedChannels, type Channel } from '../../structures/Channel.js';
import { deletedMessages, type Message } from '../../structures/Message.js';
import { Events } from '../../util/Constants.js';
import type { ThreadChannel } from '../../structures/ThreadChannel.js';

export interface RawThreadDeleteData {
  id: string;
  [key: string]: unknown;
}

export interface ThreadDeleteResult {
  thread?: ThreadChannel;
}

export class ThreadDeleteAction extends Action {
  public handle(data: RawThreadDeleteData): ThreadDeleteResult {
    const client = this.client;
    const thread = client.channels.cache.get(data.id) as ThreadChannel | undefined;

    if (thread) {
      (client.channels as unknown as { _remove(id: string): void })._remove(thread.id);
      deletedChannels.add(thread as unknown as Channel);
      if (thread.messages?.cache) {
        for (const message of thread.messages.cache.values()) {
          deletedMessages.add(message as Message);
        }
      }

      client.emit(Events.THREAD_DELETE, thread);
    }

    return { thread };
  }
}

export default ThreadDeleteAction;
