import process from 'node:process';
import type { Snowflake } from 'discord-api-types/v10';
import MessagePayload, { type MessagePayloadOptions, type MessageTarget } from './MessagePayload.js';
import { DiscordjsError as DiscordError } from '../errors/index.js';
import { WebhookTypes } from '../util/Constants.js';
import DataResolver from '../util/DataResolver.js';
import SnowflakeUtil from '../util/SnowflakeUtil.js';
import type { Client } from '../client/Client.js';
import type { Guild } from './Guild.js';
import type User from './User.js';
import type Message from './Message.js';
import type Channel from './Channel.js';
import type { BufferResolvable, ImageURLOptions } from '../types/index.js';

let deprecationEmittedForFetchMessage = false;

export type WebhookType = 'Incoming' | 'Channel Follower' | 'Application' | string;

export interface RawWebhookData {
  id: Snowflake;
  type?: number | string;
  guild_id?: Snowflake;
  channel_id?: Snowflake;
  user?: Record<string, unknown>;
  name?: string;
  avatar?: string | null;
  token?: string | null;
  application_id?: Snowflake | null;
  source_guild?: Record<string, unknown>;
  source_channel?: Record<string, unknown>;
  url?: string;
}

export interface WebhookMessageOptions extends MessagePayloadOptions {
  username?: string;
  avatarURL?: string;
  threadId?: Snowflake;
  threadName?: string;
  appliedTags?: Snowflake[];
  withComponents?: boolean;
}

export interface WebhookEditMessageOptions {
  content?: string;
  embeds?: unknown[];
  files?: unknown[];
  allowedMentions?: unknown;
  attachments?: unknown[];
  components?: unknown[];
  threadId?: Snowflake;
  withComponents?: boolean;
}

export interface WebhookEditData {
  name?: string;
  avatar?: BufferResolvable | null;
  channel?: Snowflake | { id: Snowflake };
}

export interface WebhookFetchMessageOptions {
  cache?: boolean;
  threadId?: Snowflake;
}

/**
 * Represents a webhook.
 */
export class Webhook {
  public readonly client: Client;
  public name!: string;
  public token!: string | null;
  public avatar!: string | null;
  public id!: Snowflake;
  public type!: WebhookType;
  public guildId!: Snowflake;
  public channelId!: Snowflake;
  public owner!: User | Record<string, unknown> | null;
  public sourceGuild!: Guild | Record<string, unknown> | null;
  public sourceChannel!: Channel | Record<string, unknown> | null;

  public constructor(client: Client, data?: RawWebhookData) {
    Object.defineProperty(this, 'client', { value: client });
    if (data) this._patch(data);
  }

  public _patch(data: RawWebhookData): void {
    if ('name' in data && data.name !== undefined) {
      this.name = data.name;
    }

    Object.defineProperty(this, 'token', {
      value: data.token ?? null,
      writable: true,
      configurable: true,
    });

    if ('avatar' in data) {
      this.avatar = data.avatar ?? null;
    }

    this.id = data.id;

    if ('type' in data && data.type !== undefined) {
      this.type = (WebhookTypes as unknown as Record<string, WebhookType>)[data.type] ?? (data.type as WebhookType);
    }

    if ('guild_id' in data && data.guild_id !== undefined) {
      this.guildId = data.guild_id;
    }

    if ('channel_id' in data && data.channel_id !== undefined) {
      this.channelId = data.channel_id;
    }

    if ('user' in data) {
      this.owner = data.user
        ? (this.client as unknown as { users?: { _add: (u: unknown) => User } }).users?._add(data.user) ?? data.user
        : null;
    } else {
      this.owner ??= null;
    }

    if ('source_guild' in data) {
      this.sourceGuild = data.source_guild
        ? (this.client as unknown as { guilds?: { cache: { get: (id: unknown) => Guild | undefined } } }).guilds?.cache.get(data.source_guild.id) ?? data.source_guild
        : null;
    } else {
      this.sourceGuild ??= null;
    }

    if ('source_channel' in data) {
      this.sourceChannel = data.source_channel
        ? (this.client as unknown as { channels?: { cache: { get: (id: unknown) => Channel | undefined } } }).channels?.cache.get((data.source_channel as { id?: Snowflake }).id) ?? data.source_channel
        : null;
    } else {
      this.sourceChannel ??= null;
    }
  }

  /**
   * Sends a message with this webhook.
   */
  public async send(options: string | MessagePayload | WebhookMessageOptions): Promise<Message | Record<string, unknown>> {
    if (!this.token) throw new DiscordError('WEBHOOK_TOKEN_UNAVAILABLE');

    let messagePayload: MessagePayload;

    if (options instanceof MessagePayload) {
      messagePayload = options.resolveData();
    } else {
      messagePayload = MessagePayload.create(this as unknown as MessageTarget, options as MessagePayloadOptions).resolveData();
    }

    const { data, files } = await messagePayload.resolveFiles();
    const api = (this.client as unknown as { api: { webhooks: (id: Snowflake, token: string) => { post: (opts: unknown) => Promise<Record<string, unknown>> } } }).api;
    const d = await api.webhooks(this.id, this.token).post({
      data,
      files,
      query: {
        thread_id: (messagePayload.options as WebhookMessageOptions).threadId,
        wait: true,
        with_components: (messagePayload.options as WebhookMessageOptions).withComponents,
      },
      auth: false,
      webhook: true,
    });
    const channels = (this.client as unknown as { channels?: { cache: { get: (id: Snowflake) => { messages: { _add: (data: unknown, cache: boolean) => Message } } | undefined } } }).channels;
    return channels?.cache.get(d.channel_id as Snowflake)?.messages._add(d, false) ?? d;
  }

  /**
   * Sends a raw slack message with this webhook.
   */
  public async sendSlackMessage(body: Record<string, unknown>): Promise<boolean> {
    if (!this.token) throw new DiscordError('WEBHOOK_TOKEN_UNAVAILABLE');

    const api = (this.client as unknown as { api: { webhooks: (id: Snowflake, token: string) => { slack: { post: (opts: unknown) => Promise<unknown> } } } }).api;
    const data = await api.webhooks(this.id, this.token).slack.post({
      query: { wait: true },
      auth: false,
      data: body,
      webhook: true,
    });
    return String(data) === 'ok';
  }

  /**
   * Edits this webhook.
   */
  public async edit({ name = this.name, avatar, channel }: WebhookEditData, reason?: string): Promise<this> {
    let resolvedAvatar: unknown = avatar;
    if (avatar && !(typeof avatar === 'string' && avatar.startsWith('data:'))) {
      resolvedAvatar = await DataResolver.resolveImage(avatar as Parameters<typeof DataResolver.resolveImage>[0]);
    }
    const resolvedChannelId = typeof channel === 'object' && channel !== null ? channel.id : channel;
    const api = (this.client as unknown as { api: { webhooks: (id: Snowflake, token?: string) => { patch: (opts: unknown) => Promise<RawWebhookData> } } }).api;
    const data = await api.webhooks(this.id, resolvedChannelId ? undefined : this.token || undefined).patch({
      data: { name, avatar: resolvedAvatar, channel_id: resolvedChannelId },
      reason,
      auth: !this.token || Boolean(resolvedChannelId),
      webhook: true,
    });

    if (data.name !== undefined) this.name = data.name;
    this.avatar = data.avatar ?? null;
    if (data.channel_id !== undefined) this.channelId = data.channel_id;
    return this;
  }

  /**
   * Gets a message that was sent by this webhook.
   */
  public async fetchMessage(
    message: Snowflake | '@original',
    cacheOrOptions: WebhookFetchMessageOptions | boolean = { cache: true },
  ): Promise<Message | Record<string, unknown>> {
    let opts: WebhookFetchMessageOptions = typeof cacheOrOptions === 'boolean' ? { cache: cacheOrOptions } : cacheOrOptions;

    if (typeof cacheOrOptions === 'boolean' && !deprecationEmittedForFetchMessage) {
      process.emitWarning(
        'Passing a boolean to cache the message in Webhook#fetchMessage is deprecated. Pass an object instead.',
        'DeprecationWarning',
      );
      deprecationEmittedForFetchMessage = true;
    }

    if (!this.token) throw new DiscordError('WEBHOOK_TOKEN_UNAVAILABLE');

    const api = (this.client as unknown as { api: { webhooks: (id: Snowflake, token: string) => { messages: (msgId: string) => { get: (opts: unknown) => Promise<Record<string, unknown>> } } } }).api;
    const data = await api.webhooks(this.id, this.token)
      .messages(message)
      .get({
        query: {
          thread_id: opts.threadId,
        },
        auth: false,
        webhook: true,
      });
    const channels = (this.client as unknown as { channels?: { cache: { get: (id: Snowflake) => { messages: { _add: (data: unknown, cache?: boolean) => Message } } | undefined } } }).channels;
    return channels?.cache.get(data.channel_id as Snowflake)?.messages._add(data, opts.cache) ?? data;
  }

  /**
   * Edits a message that was sent by this webhook.
   */
  public async editMessage(
    message: Snowflake | { id: Snowflake } | '@original',
    options: string | MessagePayload | WebhookEditMessageOptions,
  ): Promise<Message | Record<string, unknown>> {
    if (!this.token) throw new DiscordError('WEBHOOK_TOKEN_UNAVAILABLE');

    let messagePayload: MessagePayload;

    if (options instanceof MessagePayload) messagePayload = options;
    else messagePayload = MessagePayload.create(this as unknown as MessageTarget, options as MessagePayloadOptions);

    const { data, files } = await messagePayload.resolveData().resolveFiles();
    const msgId = typeof message === 'string' ? message : message.id;

    const api = (this.client as unknown as { api: { webhooks: (id: Snowflake, token: string) => { messages: (id: string) => { patch: (opts: unknown) => Promise<Record<string, unknown>> } } } }).api;
    const d = await api.webhooks(this.id, this.token)
      .messages(msgId)
      .patch({
        data,
        files,
        query: {
          thread_id: (messagePayload.options as WebhookMessageOptions).threadId,
          with_components: (messagePayload.options as WebhookMessageOptions).withComponents,
        },
        auth: false,
        webhook: true,
      });

    const channels = (this.client as unknown as { channels?: { cache: { get: (id: Snowflake) => { messages: { cache: { get: (id: Snowflake) => Message & { _clone: () => Message; _patch: (d: unknown) => void } | undefined }; _add: (d: unknown) => Message } } | undefined } } }).channels;
    const messageManager = channels?.cache.get(d.channel_id as Snowflake)?.messages;
    if (!messageManager) return d;

    const existing = messageManager.cache.get(d.id as Snowflake);
    if (!existing) return messageManager._add(d);

    const clone = existing._clone();
    clone._patch(d);
    return clone;
  }

  /**
   * Deletes the webhook.
   */
  public async delete(reason?: string): Promise<void> {
    const api = (this.client as unknown as { api: { webhooks: (id: Snowflake, token: string | null) => { delete: (opts: unknown) => Promise<unknown> } } }).api;
    await api.webhooks(this.id, this.token).delete({ reason, auth: !this.token, webhook: true });
  }

  /**
   * Delete a message that was sent by this webhook.
   */
  public async deleteMessage(message: Snowflake | { id: Snowflake } | '@original', threadId?: Snowflake): Promise<void> {
    if (!this.token) throw new DiscordError('WEBHOOK_TOKEN_UNAVAILABLE');

    const msgId = typeof message === 'string' ? message : message.id;
    const api = (this.client as unknown as { api: { webhooks: (id: Snowflake, token: string) => { messages: (id: string) => { delete: (opts: unknown) => Promise<unknown> } } } }).api;
    await api.webhooks(this.id, this.token)
      .messages(msgId)
      .delete({
        query: {
          thread_id: threadId,
        },
        auth: false,
        webhook: true,
      });
  }

  /**
   * The channel the webhook belongs to
   */
  public get channel(): Channel | null {
    return (this.client as unknown as { channels: { resolve: (id: Snowflake) => Channel | null } }).channels.resolve(this.channelId);
  }

  /**
   * The timestamp the webhook was created at
   */
  public get createdTimestamp(): number {
    return SnowflakeUtil.timestampFrom(this.id);
  }

  /**
   * The time the webhook was created at
   */
  public get createdAt(): Date {
    return new Date(this.createdTimestamp);
  }

  /**
   * The URL of this webhook
   */
  public get url(): string {
    const httpOptions = (this.client as unknown as { options: { http: { api: string } } }).options.http;
    const api = (this.client as unknown as { api: { webhooks: (id: Snowflake, token: string | null) => string } }).api;
    return httpOptions.api + api.webhooks(this.id, this.token);
  }

  /**
   * A link to the webhook's avatar.
   */
  public avatarURL({ format, size }: ImageURLOptions = {}): string | null {
    if (!this.avatar) return null;
    return (this.client as unknown as { rest: { cdn: { Avatar: (id: Snowflake, hash: string, f?: string, s?: number) => string } } })
      .rest.cdn.Avatar(this.id, this.avatar, format, size);
  }

  public isChannelFollower(): boolean {
    return this.type === 'Channel Follower';
  }

  public isIncoming(): boolean {
    return this.type === 'Incoming';
  }

  public static applyToClass(structure: { prototype: unknown }, ignore: string[] = []): void {
    for (const prop of [
      'send',
      'sendSlackMessage',
      'fetchMessage',
      'edit',
      'editMessage',
      'delete',
      'deleteMessage',
      'createdTimestamp',
      'createdAt',
      'url',
    ]) {
      if (ignore.includes(prop)) continue;
      const desc = Object.getOwnPropertyDescriptor(Webhook.prototype, prop);
      if (desc) {
        Object.defineProperty(structure.prototype, prop, desc);
      }
    }
  }
}

export default Webhook;
