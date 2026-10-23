import ThreadOnlyChannel, { type ThreadOnlyChannelData } from './ThreadOnlyChannel.js';
import { ForumLayoutTypes } from '../util/Constants.js';

export interface ForumChannelData extends ThreadOnlyChannelData {
  default_forum_layout?: number;
}

export type ForumLayoutTypeString = 'NOT_SET' | 'LIST_VIEW' | 'GALLERY_VIEW';

/**
 * Represents a forum channel.
 */
export class ForumChannel extends ThreadOnlyChannel {
  public defaultForumLayout: ForumLayoutTypeString | null = null;

  public override _patch(data: ForumChannelData): this {
    super._patch(data);

    if ('default_forum_layout' in data && data.default_forum_layout != null) {
      this.defaultForumLayout = (ForumLayoutTypes as Record<number, ForumLayoutTypeString>)[data.default_forum_layout] ?? null;
    }

    return this;
  }

  public setDefaultForumLayout(defaultForumLayout: ForumLayoutTypeString | number, reason?: string): Promise<this> {
    return this.edit({ defaultForumLayout }, reason) as Promise<this>;
  }
}

export default ForumChannel;
