import { Collection } from '@discordjs/collection';
import GuildChannel, { type ChannelData } from './GuildChannel.js';
import TextBasedChannel from './interfaces/TextBasedChannel.js';
import GuildTextThreadManager from '../managers/GuildTextThreadManager.js';
import MessageManager from '../managers/MessageManager.js';
import type { Snowflake } from '../types/index.js';
import type { Guild } from './Guild.js';
import type { Client } from '../client/Client.js';
import type { Invite, CreateInviteOptions } from './Invite.js';

export interface BaseGuildTextChannelData {
  nsfw?: boolean;
  topic?: string | null;
  last_message_id?: Snowflake | null;
  last_pin_timestamp?: string | null;
  default_auto_archive_duration?: number | null;
  default_thread_rate_limit_per_user?: number | null;
  messages?: unknown[];
  [key: string]: unknown;
}

export interface BaseGuildTextChannel extends GuildChannel, TextBasedChannel {}

/**
 * Represents a text-based guild channel on Discord.
 */
export class BaseGuildTextChannel extends GuildChannel {
  public messages: MessageManager;
  public threads: GuildTextThreadManager;
  public nsfw: boolean;
  public topic: string | null = null;
  public lastMessageId: Snowflake | null = null;
  public lastPinTimestamp: number | null = null;
  public defaultAutoArchiveDuration: number | null = null;
  public defaultThreadRateLimitPerUser: number | null = null;

  public constructor(guild: Guild, data: BaseGuildTextChannelData, client?: Client) {
    super(guild, data as ChannelData, client, false);

    this.messages = new MessageManager(this);
    this.threads = new GuildTextThreadManager(this as unknown as {
      id: Snowflake;
      client: unknown;
      type: string;
      guild: Guild;
      defaultAutoArchiveDuration?: number;
      messages: { resolveId(m: unknown): Snowflake | null };
    });
    this.nsfw = Boolean(data.nsfw);

    this._patch(data);
  }

  public override _patch(data: BaseGuildTextChannelData): this {
    super._patch(data as ChannelData);

    if ('topic' in data) {
      this.topic = data.topic ?? null;
    }

    if ('nsfw' in data) {
      this.nsfw = Boolean(data.nsfw);
    }

    if ('last_message_id' in data) {
      this.lastMessageId = data.last_message_id ?? null;
    }

    if ('last_pin_timestamp' in data) {
      this.lastPinTimestamp = data.last_pin_timestamp ? new Date(data.last_pin_timestamp).getTime() : null;
    }

    if ('default_auto_archive_duration' in data) {
      this.defaultAutoArchiveDuration = data.default_auto_archive_duration ?? null;
    }

    if ('default_thread_rate_limit_per_user' in data) {
      this.defaultThreadRateLimitPerUser = data.default_thread_rate_limit_per_user ?? null;
    } else {
      this.defaultThreadRateLimitPerUser ??= null;
    }

    if ('messages' in data && Array.isArray(data.messages)) {
      for (const message of data.messages) {
        (this.messages as unknown as { _add(m: unknown): void })._add(message);
      }
    }

    return this;
  }

  public setDefaultAutoArchiveDuration(defaultAutoArchiveDuration: number | 'MAX', reason?: string): Promise<this> {
    return this.edit({ defaultAutoArchiveDuration: defaultAutoArchiveDuration as unknown as number }, reason);
  }

  public setType(type: string | number, reason?: string): Promise<GuildChannel> {
    return this.edit({ type }, reason);
  }

  public setTopic(topic: string | null, reason?: string): Promise<GuildChannel> {
    return this.edit({ topic }, reason);
  }

  public createInvite(options?: CreateInviteOptions): Promise<Invite> {
    return (this.guild.invites as unknown as { create(id: Snowflake, opts?: CreateInviteOptions): Promise<Invite> }).create(
      this.id,
      options,
    );
  }

  public fetchInvites(cache = true): Promise<Collection<string, Invite>> {
    return (this.guild.invites as unknown as { fetch(opts: { channelId: Snowflake; cache?: boolean }): Promise<Collection<string, Invite>> }).fetch({
      channelId: this.id,
      cache,
    });
  }
}

TextBasedChannel.applyToClass(BaseGuildTextChannel, true);

export default BaseGuildTextChannel;
