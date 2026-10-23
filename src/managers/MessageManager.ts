import { Collection } from '@discordjs/collection';
import { CachedManager } from './CachedManager.js';
import { DiscordjsTypeError as DJSTypeError, DiscordjsRangeError as DJSRangeError, DiscordjsError as DJSError } from '../errors/index.js';
import { Message, type RawMessageData, type MessageEditOptions } from '../structures/Message.js';
import { MessagePayload, type MessageFile } from '../structures/MessagePayload.js';
import Util, { type EmojiIdentifierResolvable } from '../util/Util.js';
import type { Snowflake, TextBasedChannels, BaseFetchOptions, UserResolvable, ChannelResolvable } from '../types/index.js';
import type { User } from '../structures/User.js';
import type { Client } from '../client/Client.js';

export type MessageResolvable = Message | Snowflake;

export interface ChannelLogsQueryOptions {
  limit?: number;
  before?: Snowflake;
  after?: Snowflake;
  around?: Snowflake;
}

export interface MessageSearchOptions {
  authors?: UserResolvable[];
  mentions?: UserResolvable[];
  content?: string;
  maxId?: Snowflake;
  minId?: Snowflake;
  channels?: ChannelResolvable[];
  pinned?: boolean;
  has?: string[];
  nsfw?: boolean;
  offset?: number;
  limit?: number;
  sortBy?: 'timestamp' | 'relevance' | string;
  sortOrder?: 'asc' | 'desc' | string;
}

export interface MessageSearchResult {
  messages: Collection<Snowflake, Message>;
  total: number;
}

export interface FetchPollAnswerVotersOptions {
  messageId: Snowflake;
  answerId: number | string;
  after?: Snowflake;
  limit?: number;
}

/**
 * Manages API methods for Messages and holds their cache.
 * @extends {CachedManager}
 */
export class MessageManager extends CachedManager<Snowflake, Message, RawMessageData> {
  /**
   * The channel that the messages belong to
   */
  public channel: TextBasedChannels;

  public constructor(channel: TextBasedChannels, iterable?: Iterable<Message>) {
    super((channel as unknown as { client: Client }).client, Message, iterable);
    this.channel = channel;
  }

  public override _add(data: RawMessageData, cache?: boolean): Message {
    return super._add(data, cache);
  }

  /**
   * Gets a message, or messages, from this channel.
   */
  public fetch(message: Snowflake, options?: BaseFetchOptions): Promise<Message>;
  public fetch(
    options?: ChannelLogsQueryOptions,
    fetchOptions?: BaseFetchOptions,
  ): Promise<Collection<Snowflake, Message>>;
  public fetch(
    message?: Snowflake | ChannelLogsQueryOptions,
    { cache = true, force = false }: BaseFetchOptions = {},
  ): Promise<Message | Collection<Snowflake, Message>> {
    return typeof message === 'string'
      ? this._fetchId(message, cache, force)
      : this._fetchMany(message, cache);
  }

  /**
   * Fetches the pinned messages of this channel and returns a collection of them.
   */
  public async fetchPinned(cache: boolean = true): Promise<Collection<Snowflake, Message>> {
    const api = this.client.api as unknown as {
      channels: Record<
        string,
        {
          messages: {
            pins: {
              get(opts: { query: { limit: number } }): Promise<{ items?: RawMessageData[] }>;
            };
          };
        }
      >;
    };
    const chId = (this.channel as { id: Snowflake }).id;
    const data = await api.channels[chId].messages.pins.get({
      query: { limit: 50 },
    });
    const messages = new Collection<Snowflake, Message>();
    for (const message of data?.items || []) {
      messages.set(message.id, this._add(message, cache));
    }
    return messages;
  }

  /**
   * Edits a message, even if it's not cached.
   */
  public async edit(
    message: MessageResolvable,
    options: string | MessageEditOptions | MessagePayload,
  ): Promise<Message> {
    const messageId = this.resolveId(message);
    if (!messageId) throw new DJSTypeError('INVALID_TYPE', 'message', 'MessageResolvable');

    const target = message instanceof Message ? message : this;
    const payload =
      options instanceof MessagePayload
        ? options
        : (MessagePayload.create(target as unknown as Parameters<typeof MessagePayload.create>[0], options as unknown as import('../structures/MessagePayload.js').BaseMessageOptions) as MessagePayload);

    const { data, files } = await payload.resolveData().resolveFiles();

    const chId = (this.channel as { id: Snowflake }).id;
    const resolvedFiles = (files ?? []) as unknown as (MessageFile & { [key: string]: unknown })[];

    interface UploadURLResult {
      id: number;
      upload_url: string;
      upload_filename: string;
    }
    const util = Util as unknown as {
      getUploadURL(client: unknown, channelId: string, files: unknown[]): Promise<UploadURLResult[]>;
      uploadFile(file: unknown, url: string): Promise<void>;
    };

    const attachments = await util.getUploadURL(this.client, chId, resolvedFiles);
    const requestPromises = attachments.map(async attachment => {
      const f = resolvedFiles[attachment.id];
      await util.uploadFile(f.file, attachment.upload_url);
      return {
        id: attachment.id,
        filename: f.name,
        uploaded_filename: attachment.upload_filename,
        description: f.description,
        duration_secs: f.duration_secs,
        waveform: f.waveform,
      };
    });
    const attachmentsData = await Promise.all(requestPromises);
    attachmentsData.sort((a, b) => a.id - b.id);
    (data as Record<string, unknown>).attachments = attachmentsData;

    const api = this.client.api as unknown as {
      channels: Record<
        string,
        {
          messages: Record<
            string,
            {
              patch(opts: { data: unknown }): Promise<RawMessageData>;
            }
          >;
        }
      >;
    };

    const d = await api.channels[chId].messages[messageId].patch({ data });

    const existing = this.cache.get(messageId);
    if (existing) {
      const clone = (existing as unknown as { _clone(): Message })._clone();
      clone._patch(d);
      return clone;
    }
    return this._add(d);
  }

  /**
   * Publishes a message in an announcement channel to all channels following it, even if it's not cached.
   */
  public async crosspost(message: MessageResolvable): Promise<Message> {
    const messageId = this.resolveId(message);
    if (!messageId) throw new DJSTypeError('INVALID_TYPE', 'message', 'MessageResolvable');

    const chId = (this.channel as { id: Snowflake }).id;
    const api = this.client.api as unknown as {
      channels(channelId: Snowflake): {
        messages(msgId: Snowflake): {
          crosspost: {
            post(): Promise<RawMessageData>;
          };
        };
      };
    };

    const data = await api.channels(chId).messages(messageId).crosspost.post();
    return this.cache.get(data.id) ?? this._add(data);
  }

  /**
   * Pins a message to the channel's pinned messages, even if it's not cached.
   */
  public async pin(message: MessageResolvable, reason?: string): Promise<void> {
    const messageId = this.resolveId(message);
    if (!messageId) throw new DJSTypeError('INVALID_TYPE', 'message', 'MessageResolvable');

    const chId = (this.channel as { id: Snowflake }).id;
    const api = this.client.api as unknown as {
      channels(channelId: Snowflake): {
        messages: {
          pins(msgId: Snowflake): {
            put(opts: { reason?: string }): Promise<void>;
          };
        };
      };
    };

    await api.channels(chId).messages.pins(messageId).put({ reason });
  }

  /**
   * Unpins a message from the channel's pinned messages, even if it's not cached.
   */
  public async unpin(message: MessageResolvable, reason?: string): Promise<void> {
    const messageId = this.resolveId(message);
    if (!messageId) throw new DJSTypeError('INVALID_TYPE', 'message', 'MessageResolvable');

    const chId = (this.channel as { id: Snowflake }).id;
    const api = this.client.api as unknown as {
      channels(channelId: Snowflake): {
        messages: {
          pins(msgId: Snowflake): {
            delete(opts: { reason?: string }): Promise<void>;
          };
        };
      };
    };

    await api.channels(chId).messages.pins(messageId).delete({ reason });
  }

  /**
   * Adds a reaction to a message, even if it's not cached.
   */
  public async react(message: MessageResolvable, emoji: EmojiIdentifierResolvable, burst: boolean = false): Promise<void> {
    const messageId = this.resolveId(message);
    if (!messageId) throw new DJSTypeError('INVALID_TYPE', 'message', 'MessageResolvable');

    const resolvedEmoji = Util.resolvePartialEmoji(emoji);
    if (!resolvedEmoji) throw new DJSTypeError('EMOJI_TYPE', 'emoji', 'EmojiIdentifierResolvable');

    const emojiId = resolvedEmoji.id
      ? `${resolvedEmoji.animated ? 'a:' : ''}${resolvedEmoji.name}:${resolvedEmoji.id}`
      : encodeURIComponent(resolvedEmoji.name ?? '');

    const chId = (this.channel as { id: Snowflake }).id;
    const api = this.client.api as unknown as {
      channels(channelId: Snowflake): {
        messages(msgId: Snowflake): {
          reactions(emojiIdentifier: string, user: string): {
            put(opts: { query: { type: number } }): Promise<void>;
          };
        };
      };
    };

    await api
      .channels(chId)
      .messages(messageId)
      .reactions(emojiId, '@me')
      .put({
        query: {
          type: burst ? 1 : 0,
        },
      });
  }

  /**
   * Deletes a message, even if it's not cached.
   */
  public async delete(message: MessageResolvable): Promise<void> {
    const messageId = this.resolveId(message);
    if (!messageId) throw new DJSTypeError('INVALID_TYPE', 'message', 'MessageResolvable');

    const chId = (this.channel as { id: Snowflake }).id;
    const api = this.client.api as unknown as {
      channels(channelId: Snowflake): {
        messages(msgId: Snowflake): {
          delete(): Promise<void>;
        };
      };
    };

    await api.channels(chId).messages(messageId).delete();
  }

  public _fetchId(messageId: Snowflake, cache: boolean = true, force: boolean = false): Promise<Message> {
    if (!force) {
      const existing = this.cache.get(messageId);
      if (existing && !existing.partial) return Promise.resolve(existing);
    }

    return new Promise((resolve, reject) => {
      this._fetchMany(
        {
          around: messageId,
          limit: 50,
        },
        cache,
      )
        .then(data_ => {
          if (data_.has(messageId)) {
            resolve(data_.get(messageId)!);
          } else {
            reject(new DJSError('MESSAGE_ID_NOT_FOUND'));
          }
        })
        .catch(reject);
    });
  }

  public async _fetchMany(
    options: ChannelLogsQueryOptions = {},
    cache: boolean = true,
  ): Promise<Collection<Snowflake, Message>> {
    const chId = (this.channel as { id: Snowflake }).id;
    const api = this.client.api as unknown as {
      channels: Record<
        string,
        {
          messages: {
            get(opts: { query?: unknown }): Promise<RawMessageData[]>;
          };
        }
      >;
    };

    const data = await api.channels[chId].messages.get({ query: options });
    const messages = new Collection<Snowflake, Message>();
    for (const message of data) {
      messages.set(message.id, this._add(message, cache));
    }
    return messages;
  }

  /**
   * Search Messages in the channel.
   */
  public async search(options: MessageSearchOptions = {}): Promise<MessageSearchResult> {
    const authorsOpt = options.authors ?? [];
    const mentionsOpt = options.mentions ?? [];
    const channelsOpt = options.channels ?? [];
    const content = options.content ?? '';
    const hasOpt = options.has ?? [];
    const maxId = options.maxId ?? null;
    const minId = options.minId ?? null;
    const pinned = options.pinned;
    const nsfw = options.nsfw ?? false;
    const offset = options.offset ?? 0;
    const limit = options.limit ?? 25;
    const sortBy = options.sortBy ?? 'timestamp';
    const sortOrder = options.sortOrder ?? 'desc';

    let authors: (Snowflake | null)[] = [];
    if (authorsOpt.length > 0) {
      authors = authorsOpt.map(u => this.client.users.resolveId(u));
    }

    let mentions: (Snowflake | null)[] = [];
    if (mentionsOpt.length > 0) {
      mentions = mentionsOpt.map(u => this.client.users.resolveId(u));
    }

    const ch = this.channel as unknown as { id: Snowflake; guildId?: Snowflake | null; guild?: { channels: { cache: Collection<Snowflake, { messages?: unknown; permissionsFor(user: unknown): { has(p: string): boolean } }> } } };
    let channels: (Snowflake | null)[] = [];
    if (channelsOpt.length > 0) {
      const channelMgr = this.client.channels;
      channels = channelsOpt
        .map(c => channelMgr.resolveId(c))
        .filter((id): id is Snowflake => {
          if (!id) return false;
          if (ch.guildId && ch.guild) {
            const c = ch.guild.channels.cache.get(id);
            if (!c || !c.messages) return false;
            const perm = c.permissionsFor(this.client.user);
            if (!perm.has('READ_MESSAGE_HISTORY') || !perm.has('VIEW_CHANNEL')) return false;
            return true;
          }
          return true;
        });
    }

    if (limit && limit > 25) throw new DJSRangeError('MESSAGE_SEARCH_LIMIT');

    let stringQuery: string[] = [];
    const result = new Collection<Snowflake, Message>();

    if (authors.length > 0) stringQuery.push(authors.filter(Boolean).map(id => `author_id=${id}`).join('&'));
    if (content && content.length) stringQuery.push(`content=${encodeURIComponent(content)}`);
    if (mentions.length > 0) stringQuery.push(mentions.filter(Boolean).map(id => `mentions=${id}`).join('&'));
    const has = hasOpt.filter(v =>
      ['link', 'embed', 'file', 'video', 'image', 'sound', 'sticker'].includes(v),
    );
    if (has.length > 0) stringQuery.push(has.map(v => `has=${v}`).join('&'));
    if (maxId) stringQuery.push(`max_id=${maxId}`);
    if (minId) stringQuery.push(`min_id=${minId}`);
    if (nsfw) stringQuery.push('include_nsfw=true');
    if (offset !== 0) stringQuery.push(`offset=${offset}`);
    if (limit !== 25) stringQuery.push(`limit=${limit}`);
    if (['timestamp', 'relevance'].includes(sortBy)) {
      stringQuery.push(`sort_by=${sortBy}`);
    } else {
      stringQuery.push('sort_by=timestamp');
    }
    if (['asc', 'desc'].includes(sortOrder)) {
      stringQuery.push(`sort_order=${sortOrder}`);
    } else {
      stringQuery.push('sort_order=desc');
    }
    if (ch.guildId && channels.length > 0) {
      stringQuery.push(channels.filter(Boolean).map(id => `channel_id=${id}`).join('&'));
    }
    if (typeof pinned === 'boolean') stringQuery.push(`pinned=${pinned}`);

    if (!stringQuery.length) {
      return {
        messages: result,
        total: 0,
      };
    }

    interface SearchResponse {
      messages: [RawMessageData][];
      total_results: number;
    }

    const api = this.client.api as unknown as {
      guilds: Record<string, { messages: Record<string, { get(): Promise<SearchResponse> }> }>;
      channels: Record<string, { messages: Record<string, { get(): Promise<SearchResponse> }> }>;
    };

    let data: SearchResponse;
    if (ch.guildId) {
      data = await api.guilds[ch.guildId].messages[`search?${stringQuery.join('&')}`].get();
    } else {
      stringQuery = stringQuery.filter(v => !v.startsWith('channel_id') && !v.startsWith('include_nsfw'));
      data = await api.channels[ch.id].messages[`search?${stringQuery.join('&')}`].get();
    }

    for (const message of data.messages) {
      result.set(message[0].id, new Message(this.client, message[0]));
    }

    return {
      messages: result,
      total: data.total_results,
    };
  }

  /**
   * Ends a poll.
   */
  public async endPoll(messageId: Snowflake): Promise<Message> {
    const chId = (this.channel as { id: Snowflake }).id;
    const api = this.client.api as unknown as {
      channels(channelId: Snowflake): {
        polls(msgId: Snowflake): {
          expire: {
            post(): Promise<RawMessageData>;
          };
        };
      };
    };

    const message = await api.channels(chId).polls(messageId).expire.post();
    return this._add(message, false);
  }

  /**
   * Fetches the users that voted for a poll answer.
   */
  public async fetchPollAnswerVoters({
    messageId,
    answerId,
    after,
    limit,
  }: FetchPollAnswerVotersOptions): Promise<Collection<Snowflake, User>> {
    const chId = (this.channel as { id: Snowflake }).id;
    const channelsApi = (this.client as unknown as { channels(id: Snowflake): { polls(msgId: Snowflake): { answers(aId: string | number): { get(opts: { query: { limit?: number; after?: Snowflake } }): Promise<{ users: unknown[] }> } } } }).channels;

    const voters = await channelsApi(chId).polls(messageId).answers(answerId).get({
      query: { limit, after },
    });

    const clientUsers = this.client.users as unknown as { _add(u: unknown, cache?: boolean): User };
    return voters.users.reduce(
      (acc: Collection<Snowflake, User>, user: unknown) => {
        const u = clientUsers._add(user, false);
        return acc.set(u.id, u);
      },
      new Collection<Snowflake, User>(),
    );
  }
}

import { registerMessageManager } from '../structures/interfaces/TextBasedChannel.js';
registerMessageManager(MessageManager as unknown as new (channel: unknown) => unknown);

export default MessageManager;
