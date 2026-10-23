import ThreadManager from './ThreadManager.js';
import { DiscordjsTypeError as DjsTypeError } from '../errors/index.js';
import MessagePayload, { type BaseMessageOptions } from '../structures/MessagePayload.js';
import Util from '../util/Util.js';
import type { Snowflake } from '../types/index.js';
import type { ThreadChannel } from '../structures/ThreadChannel.js';
import type { Guild } from '../structures/Guild.js';

export interface GuildForumThreadCreateOptions {
  name: string;
  autoArchiveDuration?: number | 'MAX';
  message: BaseMessageOptions | MessagePayload;
  reason?: string;
  rateLimitPerUser?: number;
  appliedTags?: Snowflake[];
}

export interface ForumChannelOwner {
  id: Snowflake;
  client: unknown;
  guild: Guild;
  defaultAutoArchiveDuration?: number;
}

/**
 * Manages API methods for threads in forum channels and stores their cache.
 */
export class GuildForumThreadManager extends ThreadManager {
  public override channel: ForumChannelOwner;

  public constructor(channel: ForumChannelOwner, iterable?: Iterable<unknown>) {
    super(channel, iterable);
    this.channel = channel;
  }

  public async create({
    name,
    autoArchiveDuration = this.channel.defaultAutoArchiveDuration,
    message,
    reason,
    rateLimitPerUser,
    appliedTags,
  }: GuildForumThreadCreateOptions): Promise<ThreadChannel> {
    if (!message) {
      throw new DjsTypeError('GUILD_FORUM_MESSAGE_REQUIRED');
    }

    let messagePayload: MessagePayload;

    if (message instanceof MessagePayload) {
      messagePayload = message.resolveData();
    } else {
      messagePayload = MessagePayload.create(this as unknown as import('../structures/MessagePayload.js').MessageTarget, message).resolveData();
    }

    const { data: body, files } = await messagePayload.resolveFiles();

    const rawFiles = (files ?? []).map((file, i) => {
      const f = file as {
        file: unknown;
        name?: string;
        description?: string;
        duration_secs?: number;
        waveform?: string;
      };
      return {
        ...f,
        name: f.name ?? `attachment_${i}.dat`,
      };
    });

    const attachments = (await Util.getUploadURL(this.client as unknown as Parameters<typeof Util.getUploadURL>[0], this.channel.id, rawFiles)) as { id: number | string; upload_url: string; upload_filename: string }[];
    const requestPromises = attachments.map(async (attachment: { id: number | string; upload_url: string; upload_filename: string }) => {
      const idx = Number(attachment.id);
      const fileObj = rawFiles[idx];
      if (fileObj) {
        await Util.uploadFile(fileObj.file as BodyInit, attachment.upload_url);
        return {
          id: attachment.id,
          filename: fileObj.name,
          uploaded_filename: attachment.upload_filename,
          description: fileObj.description,
          duration_secs: fileObj.duration_secs,
          waveform: fileObj.waveform,
        };
      }
      return {
        id: attachment.id,
        filename: attachment.upload_filename,
        uploaded_filename: attachment.upload_filename,
      };
    });
    const attachmentsData = await Promise.all(requestPromises);
    attachmentsData.sort((a: { id: string | number }, b: { id: string | number }) => parseInt(String(a.id), 10) - parseInt(String(b.id), 10));

    let duration = autoArchiveDuration;
    if (duration === 'MAX') duration = Util.resolveAutoArchiveMaxLimit();

    const postData = await (this.client as unknown as {
      api: {
        channels(chId: Snowflake): {
          threads: {
            post(opts: { data: Record<string, unknown>; files: unknown[]; reason?: string }): Promise<unknown>;
          };
        };
      };
    }).api
      .channels(this.channel.id)
      .threads.post({
        data: {
          name,
          auto_archive_duration: duration,
          rate_limit_per_user: rateLimitPerUser,
          applied_tags: appliedTags,
          message: body,
          attachments: attachmentsData,
        },
        files: [],
        reason,
      });

    return (this.client as unknown as {
      actions: {
        ThreadCreate: {
          handle(d: unknown): { thread: ThreadChannel };
        };
      };
    }).actions.ThreadCreate.handle(postData).thread;
  }
}

export default GuildForumThreadManager;
