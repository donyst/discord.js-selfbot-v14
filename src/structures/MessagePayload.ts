import { Buffer } from 'node:buffer';
import BaseMessageComponent, { type AnyComponent } from './BaseMessageComponent.js';
import MessageEmbed, { type MessageEmbedOptions, type APIEmbed } from './MessageEmbed.js';
import { RangeError as DjsRangeError, Error as DjsError } from '../errors/index.js';
import ActivityFlags from '../util/ActivityFlags.js';
import { PollLayoutTypes, MessageReferenceTypes } from '../util/Constants.js';
import DataResolver from '../util/DataResolver.js';
import MessageFlags from '../util/MessageFlags.js';
import SnowflakeUtil from '../util/SnowflakeUtil.js';
import Util, { type EmojiIdentifierResolvable } from '../util/Util.js';
import type { Snowflake } from '../types/index.js';
import type { Client } from '../client/Client.js';

export interface MessageFile {
  attachment: unknown;
  name: string;
  file: Buffer | import('node:stream').Readable;
  description?: string;
  duration_secs?: number;
  waveform?: string;
}

export interface MessageTarget {
  client: Client;
  name?: string;
  messages?: { resolveId(m: unknown): Snowflake | null };
  author?: { id: Snowflake };
  [key: string]: unknown;
}

export interface MessageReplyOptions {
  messageReference: Snowflake | { id?: Snowflake };
  failIfNotExists?: boolean;
}

export interface MessageForwardOptions {
  message: Snowflake | { id?: Snowflake; channelId?: Snowflake; guildId?: Snowflake };
  channel?: Snowflake | { id?: Snowflake };
  guild?: Snowflake | { id?: Snowflake };
}

export interface PollAnswerData {
  text: string;
  emoji?: EmojiIdentifierResolvable;
}

export interface PollData {
  question: { text: string };
  answers: PollAnswerData[];
  duration: number;
  allowMultiselect?: boolean;
  layoutType?: number | keyof typeof PollLayoutTypes;
}

export interface BaseMessageOptions {
  content?: string | null;
  tts?: boolean;
  nonce?: string | number;
  embeds?: (MessageEmbed | MessageEmbedOptions | APIEmbed)[];
  components?: (Record<string, unknown> | BaseMessageComponent)[];
  username?: string;
  avatarURL?: string;
  threadName?: string;
  appliedTags?: Snowflake[];
  flags?: number | bigint | MessageFlags;
  ephemeral?: boolean;
  allowedMentions?: Record<string, unknown>;
  reply?: MessageReplyOptions;
  forward?: MessageForwardOptions;
  files?: (
    | string
    | Buffer
    | {
        attachment: unknown;
        name?: string;
        path?: string;
        description?: string;
        duration?: number;
        waveform?: string;
      }
  )[];
  attachments?: Record<string, unknown>[];
  activity?: { partyId?: string; type?: unknown };
  poll?: PollData;
  stickers?: (Snowflake | { id?: Snowflake })[];
  [key: string]: unknown;
}

export type MessagePayloadOptions = BaseMessageOptions;

export class MessagePayload {
  public target: MessageTarget;
  public options: BaseMessageOptions;
  public data: Record<string, unknown> | null = null;
  public files: MessageFile[] | null = null;

  public constructor(target: MessageTarget, options: BaseMessageOptions) {
    this.target = target;
    this.options = options;
  }

  public get isWebhook(): boolean {
    const name = this.target?.constructor?.name;
    return name === 'Webhook' || name === 'WebhookClient';
  }

  public get isUser(): boolean {
    const name = this.target?.constructor?.name;
    return name === 'User' || name === 'GuildMember';
  }

  public get isMessage(): boolean {
    return this.target?.constructor?.name === 'Message';
  }

  public get isMessageManager(): boolean {
    return this.target?.constructor?.name === 'MessageManager';
  }

  public get isInteraction(): boolean {
    const name = this.target?.constructor?.name;
    return (
      name === 'Interaction' ||
      name === 'InteractionWebhook' ||
      Boolean(name?.endsWith('Interaction')) ||
      (this.target as unknown as { isInteraction?: () => boolean })?.isInteraction?.() === true
    );
  }

  public makeContent(): string | undefined {
    let content: string | undefined;
    if (this.options.content === null) {
      content = '';
    } else if (typeof this.options.content !== 'undefined') {
      content = Util.verifyString(this.options.content, DjsRangeError, 'MESSAGE_CONTENT_TYPE', false);
    }
    return content;
  }

  public resolveData(): this {
    if (this.data) return this;
    const isInteraction = this.isInteraction;
    const isWebhook = this.isWebhook;

    const content = this.makeContent();
    const tts = Boolean(this.options.tts);

    let nonce: string | number = SnowflakeUtil.generate();
    if (typeof this.options.nonce !== 'undefined') {
      nonce = this.options.nonce;
      if (typeof nonce === 'number' ? !Number.isInteger(nonce) : typeof nonce !== 'string') {
        throw new DjsRangeError('MESSAGE_NONCE_TYPE');
      }
    }

    const components = this.options.components
      ?.map(c => BaseMessageComponent.create(c))
      .filter((c): c is AnyComponent => c !== null)
      .map(c => c.toJSON());

    let username: string | undefined;
    let avatarURL: string | undefined;
    let threadName: string | undefined;
    let appliedTags: Snowflake[] | undefined;
    if (isWebhook) {
      username = this.options.username ?? this.target.name;
      if (this.options.avatarURL) avatarURL = this.options.avatarURL;
      if (this.options.threadName) threadName = this.options.threadName;
      if (this.options.appliedTags) appliedTags = this.options.appliedTags;
    }

    let flags: number | undefined;
    if (this.options.flags != null) {
      flags = Number(new MessageFlags(this.options.flags as number).bitfield);
    }

    if (isInteraction && this.options.ephemeral) {
      flags = (flags ?? 0) | MessageFlags.FLAGS.EPHEMERAL;
    }

    let allowedMentions =
      typeof this.options.allowedMentions === 'undefined'
        ? (this.target.client.options as unknown as { allowedMentions?: Record<string, unknown> }).allowedMentions
        : this.options.allowedMentions;

    if (allowedMentions) {
      const cloned = Util.cloneObject(allowedMentions);
      cloned.replied_user = (cloned as { repliedUser?: unknown }).repliedUser;
      delete (cloned as { repliedUser?: unknown }).repliedUser;
      allowedMentions = cloned;
    }

    let message_reference: Record<string, unknown> | undefined;
    if (typeof this.options.reply === 'object' && this.options.reply !== null) {
      const reference = this.options.reply.messageReference;
      const refId = typeof reference === 'object' && reference !== null ? reference.id ?? (reference as unknown as Snowflake) : reference;
      const message_id = this.isMessage
        ? refId
        : this.target.messages?.resolveId(reference);
      if (message_id) {
        message_reference = {
          message_id,
          type: MessageReferenceTypes.DEFAULT,
          fail_if_not_exists:
            this.options.reply.failIfNotExists ??
            (this.target.client.options as unknown as { failIfNotExists?: boolean }).failIfNotExists,
        };
      }
    }

    if (typeof this.options.forward === 'object' && this.options.forward !== null) {
      const reference = this.options.forward.message;
      const refObj = typeof reference === 'object' && reference !== null ? reference : { id: reference };
      const channel_id =
        refObj.channelId ??
        (this.target.client.channels as unknown as { resolveId(c: unknown): Snowflake | null }).resolveId(
          this.options.forward.channel,
        );
      const guild_id =
        refObj.guildId ??
        (this.target.client.guilds as unknown as { resolveId(g: unknown): Snowflake | null }).resolveId(
          this.options.forward.guild,
        );
      const message_id = this.target.messages?.resolveId(reference);
      if (message_id) {
        if (!channel_id) throw new DjsError('INVALID_TYPE', 'channelId', 'TextBasedChannelResolvable');
        message_reference = {
          type: MessageReferenceTypes.FORWARD,
          message_id,
          channel_id,
          guild_id: guild_id ?? undefined,
        };
      }
    }

    const attachments = this.options.files?.map((file, index) => ({
      id: index.toString(),
      description: typeof file === 'object' && file !== null && 'description' in file ? file.description : undefined,
    }));
    if (Array.isArray(this.options.attachments)) {
      this.options.attachments.push(...(attachments ?? []));
    } else {
      this.options.attachments = attachments;
    }

    let activity: Record<string, unknown> | undefined;
    if (
      this.options.activity instanceof Object &&
      typeof this.options.activity.partyId === 'string' &&
      this.options.activity.type
    ) {
      const type = ActivityFlags.resolve(this.options.activity.type as Parameters<typeof ActivityFlags.resolve>[0]);
      const sessionId = (this.target.client as unknown as { sessionId?: string }).sessionId;
      const partyId = this.options.activity.partyId;
      activity = {
        type,
        party_id: partyId,
        session_id: sessionId,
      };
    }

    let poll: Record<string, unknown> | undefined;
    if (this.options.poll) {
      poll = {
        question: {
          text: this.options.poll.question.text,
        },
        answers: this.options.poll.answers.map(answer => ({
          poll_media: {
            text: answer.text,
            emoji: answer.emoji ? Util.resolvePartialEmoji(answer.emoji) : undefined,
          },
        })),
        duration: this.options.poll.duration,
        allow_multiselect: this.options.poll.allowMultiselect,
        layout_type:
          typeof this.options.poll.layoutType === 'number'
            ? this.options.poll.layoutType
            : this.options.poll.layoutType != null
              ? (PollLayoutTypes as Record<string, number>)[this.options.poll.layoutType]
              : undefined,
      };
    }

    this.data = {
      activity,
      content,
      tts,
      nonce,
      embeds: this.options.embeds?.map(embed => new MessageEmbed(embed as APIEmbed).toJSON()),
      components,
      username,
      avatar_url: avatarURL,
      allowed_mentions:
        this.isMessage &&
        message_reference === undefined &&
        this.target?.author?.id !== (this.target?.client?.user as unknown as { id?: Snowflake })?.id
          ? undefined
          : allowedMentions,
      flags,
      message_reference,
      attachments: this.options.attachments,
      sticker_ids: this.options.stickers?.map(sticker =>
        typeof sticker === 'object' && sticker !== null && 'id' in sticker ? sticker.id : sticker,
      ),
      thread_name: threadName,
      applied_tags: appliedTags,
      poll,
    };
    return this;
  }

  public async resolveFiles(): Promise<this> {
    if (this.files) return this;

    this.files = await Promise.all(
      this.options.files?.map(file => MessagePayload.resolveFile(file)) ?? [],
    );
    return this;
  }

  public static async resolveFile(fileLike: unknown): Promise<MessageFile> {
    let attachment: unknown;
    let name: string;

    const findName = (thing: unknown): string => {
      if (typeof thing === 'string') {
        return Util.basename(thing);
      }
      if (typeof thing === 'object' && thing !== null && 'path' in thing && typeof (thing as { path: unknown }).path === 'string') {
        return Util.basename((thing as { path: string }).path);
      }
      return 'file.jpg';
    };

    const isRecord = typeof fileLike === 'object' && fileLike !== null;
    const ownAttachment =
      typeof fileLike === 'string' ||
      fileLike instanceof Buffer ||
      (isRecord && 'pipe' in fileLike && typeof (fileLike as { pipe: unknown }).pipe === 'function');

    if (ownAttachment) {
      attachment = fileLike;
      name = findName(attachment);
    } else {
      const fl = fileLike as {
        attachment?: unknown;
        name?: string;
        description?: string;
        duration?: number;
        waveform?: string;
      };
      attachment = fl.attachment;
      name = fl.name ?? findName(attachment);
    }

    const resource = await DataResolver.resolveFile(attachment as Parameters<typeof DataResolver.resolveFile>[0]);
    const flRecord = isRecord ? (fileLike as Record<string, unknown>) : {};
    return {
      attachment,
      name,
      file: resource as Buffer | import('node:stream').Readable,
      description: flRecord.description as string | undefined,
      duration_secs: flRecord.duration as number | undefined,
      waveform: flRecord.waveform as string | undefined,
    };
  }

  public static create(
    target: MessageTarget,
    options: string | BaseMessageOptions,
    extra: BaseMessageOptions = {},
  ): MessagePayload {
    return new this(
      target,
      typeof options !== 'object' || options === null
        ? ({ content: options, ...extra } as BaseMessageOptions)
        : { ...options, ...extra },
    );
  }
}

export default MessagePayload;
