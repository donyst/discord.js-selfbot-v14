import Action from './Action.js';
import { Events } from '../../util/Constants.js';
import type { ThreadChannel } from '../../structures/ThreadChannel.js';

export interface RawThreadCreateData {
  id: string;
  newly_created?: boolean;
  [key: string]: unknown;
}

export interface ThreadCreateResult {
  thread?: ThreadChannel;
}

export class ThreadCreateAction extends Action {
  public handle(data: RawThreadCreateData): ThreadCreateResult {
    const client = this.client;
    const existing = client.channels.cache.has(data.id);
    const thread = (client.channels as unknown as { _add(d: unknown): ThreadChannel | undefined })._add(data);
    if (!existing && thread) {
      client.emit(Events.THREAD_CREATE, thread, data.newly_created ?? false);
    }
    return { thread };
  }
}

export default ThreadCreateAction;
