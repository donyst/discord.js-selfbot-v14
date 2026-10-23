import process from 'node:process';
import { Collection } from '@discordjs/collection';
import CachedManager from './CachedManager.js';
import { DiscordjsTypeError as DjsTypeError } from '../errors/index.js';
import { ThreadMember, type APIThreadMemberData } from '../structures/ThreadMember.js';
import type { Snowflake, BaseFetchOptions } from '../types/index.js';
import type { ThreadChannel } from '../structures/ThreadChannel.js';
import type { UserResolvable } from './GuildMemberManager.js';

let deprecationEmittedForPassingBoolean = false;

export type ThreadMemberResolvable = ThreadMember | UserResolvable;

export interface FetchThreadMemberOptions extends BaseFetchOptions {
  withMember?: boolean;
}

export interface FetchThreadMembersWithGuildMemberDataOptions {
  withMember: true;
  after?: Snowflake;
  limit?: number;
  cache?: boolean;
}

export interface FetchThreadMembersWithoutGuildMemberDataOptions {
  withMember?: false;
  cache?: boolean;
  limit?: number;
  after?: Snowflake;
}

export type FetchThreadMembersOptions =
  | FetchThreadMembersWithGuildMemberDataOptions
  | FetchThreadMembersWithoutGuildMemberDataOptions;

/**
 * Manages API methods for ThreadMembers and stores their cache.
 */
export class ThreadMemberManager extends CachedManager<Snowflake, ThreadMember, ThreadMemberResolvable> {
  public readonly thread: ThreadChannel;

  public constructor(thread: ThreadChannel, iterable?: Iterable<unknown>) {
    super(thread.client, ThreadMember, iterable as unknown as Iterable<ThreadMember>);
    this.thread = thread;
  }

  public override _add(data: unknown, cache = true): ThreadMember {
    const raw = data as APIThreadMemberData;
    const existing = this.cache.get(raw.user_id);
    if (cache) existing?._patch(raw, { cache });
    if (existing) return existing;

    const member = new ThreadMember(this.thread, raw, { cache });
    if (cache) this.cache.set(raw.user_id, member);
    return member;
  }

  public fetchMe(options?: BaseFetchOptions): Promise<ThreadMember> {
    return this.fetch(this.client.user!.id, options as FetchThreadMemberOptions);
  }

  public get me(): ThreadMember | null {
    const clientUserId = this.client.user?.id;
    return clientUserId ? this.cache.get(clientUserId) ?? null : null;
  }

  public override resolve(member: ThreadMember): ThreadMember;
  public override resolve(member: ThreadMemberResolvable): ThreadMember | null;
  public override resolve(member: unknown): ThreadMember | null {
    const memberResolvable = super.resolve(member as ThreadMemberResolvable);
    if (memberResolvable) return memberResolvable;
    const userId = (this.client.users as unknown as { resolveId(u: unknown): Snowflake | null }).resolveId(member);
    if (userId) return this.cache.get(userId) ?? null;
    return null;
  }

  public override resolveId(member: Snowflake | ThreadMember): Snowflake;
  public override resolveId(member: ThreadMemberResolvable): Snowflake | null;
  public override resolveId(member: unknown): Snowflake | null {
    const memberResolvable = super.resolveId(member as ThreadMemberResolvable);
    if (memberResolvable) return memberResolvable;
    const userId = (this.client.users as unknown as { resolveId(u: unknown): Snowflake | null }).resolveId(member);
    return userId && this.cache.has(userId) ? userId : null;
  }

  public async add(member: UserResolvable | '@me', reason?: string): Promise<Snowflake> {
    const id = member === '@me' ? member : (this.client.users as unknown as { resolveId(u: unknown): Snowflake | null }).resolveId(member);
    if (!id) throw new DjsTypeError('INVALID_TYPE', 'member', 'UserResolvable');

    await (this.client as unknown as {
      api: {
        channels(chId: Snowflake, sub: string, mId: string): {
          put(opts: { reason?: string }): Promise<void>;
        };
      };
    }).api
      .channels(this.thread.id, 'thread-members', id)
      .put({ reason });

    return id;
  }

  public async remove(id: Snowflake | '@me', reason?: string): Promise<Snowflake> {
    await (this.client as unknown as {
      api: {
        channels(chId: Snowflake, sub: string, mId: string): {
          delete(opts: { reason?: string }): Promise<void>;
        };
      };
    }).api
      .channels(this.thread.id, 'thread-members', id)
      .delete({ reason });

    return id;
  }

  public async _fetchOne(
    memberId: Snowflake,
    { cache = true, force = false, withMember }: FetchThreadMemberOptions = {},
  ): Promise<ThreadMember> {
    if (!force) {
      const existing = this.cache.get(memberId);
      if (existing) return existing;
    }

    const data = await (this.client as unknown as {
      api: {
        channels(chId: Snowflake, sub: string, mId: string): {
          get(opts: { query: { with_member?: boolean } }): Promise<APIThreadMemberData>;
        };
      };
    }).api
      .channels(this.thread.id, 'thread-members', memberId)
      .get({
        query: { with_member: withMember },
      });

    return this._add(data, cache);
  }

  public async _fetchMany({
    cache = true,
    limit,
    after,
    withMember,
  }: FetchThreadMembersOptions = {}): Promise<Collection<Snowflake, ThreadMember>> {
    const raw = await (this.client as unknown as {
      api: {
        channels(chId: Snowflake, sub: string): {
          get(opts: { query: { with_member?: boolean; limit?: number; after?: Snowflake } }): Promise<APIThreadMemberData[]>;
        };
      };
    }).api
      .channels(this.thread.id, 'thread-members')
      .get({
        query: { with_member: withMember, limit, after },
      });

    return raw.reduce(
      (col, member) => col.set(member.user_id, this._add(member, cache)),
      new Collection<Snowflake, ThreadMember>(),
    );
  }

  public fetch(member: Snowflake | UserResolvable, options?: FetchThreadMemberOptions): Promise<ThreadMember>;
  public fetch(
    options?: FetchThreadMembersOptions | boolean,
  ): Promise<Collection<Snowflake, ThreadMember>>;
  public fetch(
    member?: Snowflake | UserResolvable | FetchThreadMembersOptions | boolean,
    options: FetchThreadMemberOptions = { cache: true, force: false },
  ): Promise<ThreadMember | Collection<Snowflake, ThreadMember>> {
    if (typeof member === 'boolean' && !deprecationEmittedForPassingBoolean) {
      process.emitWarning(
        'Passing boolean to member option is deprecated, use cache property instead.',
        'DeprecationWarning',
      );
      deprecationEmittedForPassingBoolean = true;
    }
    const id = this.resolveId(member as ThreadMemberResolvable);
    return id
      ? this._fetchOne(id, options)
      : this._fetchMany(typeof member === 'boolean' ? { ...options, cache: member } : (member as FetchThreadMembersOptions));
  }
}

export default ThreadMemberManager;
