import { Base } from './Base.js';
import { ThreadMemberFlags } from '../util/ThreadMemberFlags.js';
import type { Snowflake } from '../types/index.js';
import type { ThreadChannel } from './ThreadChannel.js';
import type { GuildMember } from './GuildMember.js';
import type { User } from './User.js';

export interface APIThreadMemberData {
  user_id: Snowflake;
  join_timestamp?: string;
  flags?: number;
  member?: unknown;
  [key: string]: unknown;
}

export interface ThreadMemberExtraOptions {
  cache?: boolean;
}

/**
 * Represents a Member for a Thread.
 */
export class ThreadMember extends Base {
  public thread: ThreadChannel;
  public joinedTimestamp: number | null = null;
  public flags: ThreadMemberFlags | null = null;
  public member: GuildMember | null = null;

  public constructor(thread: ThreadChannel, data: APIThreadMemberData, extra: ThreadMemberExtraOptions = {}) {
    super(thread.client);

    this.thread = thread;
    this.id = data.user_id;

    this._patch(data, extra);
  }

  public override _patch(data: APIThreadMemberData, extra: ThreadMemberExtraOptions = {}): this {
    if ('join_timestamp' in data && data.join_timestamp) {
      this.joinedTimestamp = new Date(data.join_timestamp).getTime();
    }

    if ('flags' in data && data.flags != null) {
      this.flags = new ThreadMemberFlags(data.flags).freeze();
    }

    if ('member' in data && data.member) {
      this.member = (this.thread.guild.members as unknown as { _add(d: unknown, c?: boolean): GuildMember })._add(
        data.member,
        extra.cache,
      );
    } else {
      this.member ??= null;
    }

    return this;
  }

  public get guildMember(): GuildMember | null {
    return this.member ?? this.thread.guild.members.cache.get(this.id) ?? null;
  }

  public get joinedAt(): Date | null {
    return this.joinedTimestamp ? new Date(this.joinedTimestamp) : null;
  }

  public get user(): User | null {
    return (this.client.users as unknown as { cache: { get(id: Snowflake): User | undefined } }).cache.get(this.id) ?? null;
  }

  public get manageable(): boolean {
    return !this.thread.archived && this.thread.editable;
  }

  public async remove(reason?: string): Promise<this> {
    await this.thread.members.remove(this.id, reason);
    return this;
  }
}

export default ThreadMember;
