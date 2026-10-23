import { Collection } from '@discordjs/collection';
import CachedManager from './CachedManager.js';
import type { Snowflake, BaseFetchOptions } from '../types/index.js';
import { ThreadChannel } from '../structures/ThreadChannel.js';
import type { Guild } from '../structures/Guild.js';
import type { Client } from '../client/Client.js';

export type ThreadChannelResolvable = ThreadChannel | Snowflake;

export interface DateResolvable {
  [key: string]: unknown;
}

export interface FetchArchivedThreadOptions {
  type?: 'public' | 'private';
  fetchAll?: boolean;
  before?: Date | number | string | ThreadChannelResolvable;
  limit?: number;
}

export interface FetchedThreads {
  threads: Collection<Snowflake, ThreadChannel>;
  hasMore: boolean;
}

export interface FetchChannelThreadsOptions {
  archived?: boolean;
  sortBy?: string;
  sortOrder?: string;
  limit?: number;
  offset?: number;
}

export interface FetchThreadsOptions {
  archived?: FetchArchivedThreadOptions;
}

export interface RawThreadsPayload {
  threads: unknown[];
  members: { id: Snowflake; [key: string]: unknown }[];
  first_messages?: { id: Snowflake; [key: string]: unknown }[];
  has_more?: boolean;
}

export interface MapThreadsOptions {
  parent?: { id: Snowflake; guild?: Guild };
  guild?: Guild;
  cache?: boolean;
}

/**
 * Manages API methods for ThreadChannel objects and stores their cache.
 */
export class ThreadManager extends CachedManager<Snowflake, ThreadChannel, ThreadChannelResolvable> {
  public channel: { id: Snowflake; client: unknown; guild?: Guild; defaultAutoArchiveDuration?: number };

  public constructor(channel: { id: Snowflake; client: unknown; guild?: Guild; defaultAutoArchiveDuration?: number }, iterable?: Iterable<unknown>) {
    super(channel.client as Client, ThreadChannel, iterable as unknown as Iterable<ThreadChannel>);
    this.channel = channel;
  }

  public override _add(thread: ThreadChannel): ThreadChannel {
    const existing = this.cache.get(thread.id);
    if (existing) return existing;
    this.cache.set(thread.id, thread);
    return thread;
  }

  public fetch(options?: ThreadChannelResolvable, cacheOptions?: BaseFetchOptions): Promise<ThreadChannel | null>;
  public fetch(options: FetchChannelThreadsOptions | FetchThreadsOptions): Promise<FetchedThreads>;
  public fetch(
    options?: ThreadChannelResolvable | FetchChannelThreadsOptions | FetchThreadsOptions,
    { cache, force }: BaseFetchOptions = {},
  ): Promise<ThreadChannel | FetchedThreads | null> {
    if (!options) return this.fetchActive(cache);
    const channelId = (this.client.channels as unknown as { resolveId(ch: unknown): Snowflake | null }).resolveId(options);
    if (channelId) {
      return (this.client.channels as unknown as { fetch(id: Snowflake, opts?: BaseFetchOptions): Promise<ThreadChannel | null> }).fetch(
        channelId,
        { cache, force },
      );
    }
    const opts = options as FetchThreadsOptions;
    if (opts.archived) {
      return this.fetchArchived(opts.archived, cache);
    }
    return this.fetchActive(cache, options as FetchChannelThreadsOptions);
  }

  public fetchArchived(options: FetchArchivedThreadOptions = {}, cache = true): Promise<FetchedThreads> {
    return this.fetchActive(cache, { archived: true, ...options });
  }

  public async fetchActive(cache = true, options: FetchChannelThreadsOptions = {}): Promise<FetchedThreads> {
    const raw = await (this.client as unknown as {
      api: {
        channels(chId: Snowflake): {
          threads: {
            search: {
              get(opts: { query: Record<string, unknown> }): Promise<RawThreadsPayload>;
            };
          };
        };
      };
    }).api
      .channels(this.channel.id)
      .threads.search.get({
        query: {
          archived: options.archived ?? false,
          limit: options.limit ?? 25,
          offset: options.offset ?? 0,
          sort_by: options.sortBy ?? 'last_message_time',
          sort_order: options.sortOrder ?? 'desc',
        },
      });

    return (this.constructor as typeof ThreadManager)._mapThreads(raw, this.client, { parent: this.channel, cache });
  }

  public static _mapThreads(
    rawThreads: RawThreadsPayload,
    client: unknown,
    { parent, guild, cache }: MapThreadsOptions,
  ): FetchedThreads {
    const clientChannels = (client as unknown as {
      channels: {
        _add(d: unknown, g?: Guild, opts?: { cache?: boolean }): ThreadChannel;
        cache: { get(id: Snowflake): { members: { _add(m: unknown): void }; messages: { _add(m: unknown): void } } | undefined };
      };
    }).channels;

    const threads = rawThreads.threads.reduce((coll: Collection<Snowflake, ThreadChannel>, raw) => {
      const thread = clientChannels._add(raw, guild ?? parent?.guild, { cache });
      if (parent && thread.parentId !== parent.id) return coll;
      return coll.set(thread.id, thread as ThreadChannel);
    }, new Collection<Snowflake, ThreadChannel>());

    for (const rawMember of rawThreads.members) {
      clientChannels.cache.get(rawMember.id)?.members._add(rawMember);
    }

    for (const rawMessage of rawThreads.first_messages || []) {
      clientChannels.cache.get(rawMessage.id)?.messages._add(rawMessage);
    }

    return {
      threads,
      hasMore: rawThreads.has_more ?? false,
    };
  }
}

export default ThreadManager;
