import ThreadManager from './ThreadManager.js';
import { DiscordjsTypeError as DjsTypeError } from '../errors/index.js';
import { ChannelTypes } from '../util/Constants.js';
import Util from '../util/Util.js';
import type { Snowflake } from '../types/index.js';
import type { ThreadChannel } from '../structures/ThreadChannel.js';
import type { MessageResolvable } from './MessageManager.js';
import type { Guild } from '../structures/Guild.js';

export type ThreadChannelTypes = 'GUILD_NEWS_THREAD' | 'GUILD_PUBLIC_THREAD' | 'GUILD_PRIVATE_THREAD';

export interface GuildTextThreadCreateOptions {
  name: string;
  autoArchiveDuration?: number | 'MAX';
  startMessage?: MessageResolvable;
  type?: ThreadChannelTypes | number;
  invitable?: boolean;
  reason?: string;
  rateLimitPerUser?: number;
}

export interface ThreadChannelOwner {
  id: Snowflake;
  client: unknown;
  type: string;
  guild: Guild;
  defaultAutoArchiveDuration?: number;
  messages: { resolveId(m: unknown): Snowflake | null };
}

/**
 * Manages API methods for ThreadChannel objects and stores their cache in text channels.
 */
export class GuildTextThreadManager extends ThreadManager {
  public override channel: ThreadChannelOwner;

  public constructor(channel: ThreadChannelOwner, iterable?: Iterable<unknown>) {
    super(channel, iterable);
    this.channel = channel;
  }

  public async create({
    name,
    autoArchiveDuration = this.channel.defaultAutoArchiveDuration,
    startMessage,
    type,
    invitable,
    reason,
    rateLimitPerUser,
  }: GuildTextThreadCreateOptions): Promise<ThreadChannel> {
    interface PostEndpoint {
      threads: {
        post(opts: { data: Record<string, unknown>; reason?: string }): Promise<unknown>;
      };
      messages(mId: Snowflake): {
        threads: {
          post(opts: { data: Record<string, unknown>; reason?: string }): Promise<unknown>;
        };
      };
    }

    let path = (this.client as unknown as {
      api: {
        channels(chId: Snowflake): PostEndpoint;
      };
    }).api.channels(this.channel.id);

    if (type && typeof type !== 'string' && typeof type !== 'number') {
      throw new DjsTypeError('INVALID_TYPE', 'type', 'ThreadChannelType or Number');
    }

    let resolvedType =
      this.channel.type === 'GUILD_NEWS' ? ChannelTypes.GUILD_NEWS_THREAD : ChannelTypes.GUILD_PUBLIC_THREAD;

    if (startMessage) {
      const startMessageId = this.channel.messages.resolveId(startMessage);
      if (!startMessageId) throw new DjsTypeError('INVALID_TYPE', 'startMessage', 'MessageResolvable');
      path = path.messages(startMessageId) as unknown as PostEndpoint;
    } else if (this.channel.type !== 'GUILD_NEWS') {
      resolvedType = typeof type === 'string' ? (ChannelTypes as Record<string, number>)[type]! : type ?? resolvedType;
    }

    let duration = autoArchiveDuration;
    if (duration === 'MAX') duration = Util.resolveAutoArchiveMaxLimit();

    const data = await path.threads.post({
      data: {
        name,
        auto_archive_duration: duration,
        type: resolvedType,
        invitable: resolvedType === ChannelTypes.GUILD_PRIVATE_THREAD ? invitable : undefined,
        rate_limit_per_user: rateLimitPerUser,
      },
      reason,
    });

    return (this.client as unknown as {
      actions: {
        ThreadCreate: {
          handle(d: unknown): { thread: ThreadChannel };
        };
      };
    }).actions.ThreadCreate.handle(data).thread;
  }
}

export default GuildTextThreadManager;
