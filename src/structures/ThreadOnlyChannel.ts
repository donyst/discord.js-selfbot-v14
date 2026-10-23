import { Collection } from '@discordjs/collection';
import GuildChannel, { type ChannelData } from './GuildChannel.js';
import TextBasedChannel from './interfaces/TextBasedChannel.js';
import GuildForumThreadManager from '../managers/GuildForumThreadManager.js';
import { SortOrderTypes } from '../util/Constants.js';
import Util, { type APIGuildForumTag, type APIGuildForumDefaultReactionEmoji } from '../util/Util.js';
import type { Snowflake } from '../types/index.js';
import type { Guild } from './Guild.js';
import type { Client } from '../client/Client.js';
import type { Invite, CreateInviteOptions } from './Invite.js';

export interface GuildForumTagEmoji {
  id: Snowflake | null;
  name: string | null;
}

export interface GuildForumTag {
  id: Snowflake;
  name: string;
  moderated: boolean;
  emoji: GuildForumTagEmoji | null;
}

export interface GuildForumTagData {
  id?: Snowflake;
  name: string;
  moderated?: boolean;
  emoji?: GuildForumTagEmoji | null;
}

export interface DefaultReactionEmoji {
  id: Snowflake | null;
  name: string | null;
}

export interface ThreadOnlyChannelData {
  available_tags?: unknown[];
  default_reaction_emoji?: unknown;
  default_thread_rate_limit_per_user?: number | null;
  rate_limit_per_user?: number | null;
  default_auto_archive_duration?: number | null;
  nsfw?: boolean;
  topic?: string | null;
  default_sort_order?: number;
  [key: string]: unknown;
}

export interface ThreadOnlyChannel extends GuildChannel, TextBasedChannel {
  guild: Guild;
}

/**
 * Represents a channel that only contains threads
 */
export abstract class ThreadOnlyChannel extends GuildChannel {
  public threads: GuildForumThreadManager;
  public availableTags: GuildForumTag[] = [];
  public defaultReactionEmoji: DefaultReactionEmoji | null = null;
  public defaultThreadRateLimitPerUser: number | null = null;
  public rateLimitPerUser: number | null = null;
  public defaultAutoArchiveDuration: number | null = null;
  public nsfw: boolean = false;
  public topic: string | null = null;
  public defaultSortOrder: string | null = null;

  public constructor(guild: Guild, data: ThreadOnlyChannelData, client?: Client) {
    super(guild, data as ChannelData, client, false);

    this.threads = new GuildForumThreadManager(this as unknown as {
      id: Snowflake;
      client: unknown;
      guild: Guild;
      defaultAutoArchiveDuration?: number;
    });

    this._patch(data);
  }

  public override _patch(data: ThreadOnlyChannelData): this {
    super._patch(data as ChannelData);

    if ('available_tags' in data && Array.isArray(data.available_tags)) {
      this.availableTags = data.available_tags.map(tag => Util.transformAPIGuildForumTag(tag as unknown as APIGuildForumTag));
    } else {
      this.availableTags ??= [];
    }

    if ('default_reaction_emoji' in data) {
      this.defaultReactionEmoji = data.default_reaction_emoji
        ? Util.transformAPIGuildDefaultReaction(data.default_reaction_emoji as unknown as APIGuildForumDefaultReactionEmoji)
        : null;
    } else {
      this.defaultReactionEmoji ??= null;
    }

    if ('default_thread_rate_limit_per_user' in data) {
      this.defaultThreadRateLimitPerUser = data.default_thread_rate_limit_per_user ?? null;
    } else {
      this.defaultThreadRateLimitPerUser ??= null;
    }

    if ('rate_limit_per_user' in data) {
      this.rateLimitPerUser = data.rate_limit_per_user ?? null;
    } else {
      this.rateLimitPerUser ??= null;
    }

    if ('default_auto_archive_duration' in data) {
      this.defaultAutoArchiveDuration = data.default_auto_archive_duration ?? null;
    } else {
      this.defaultAutoArchiveDuration ??= null;
    }

    if ('nsfw' in data) {
      this.nsfw = Boolean(data.nsfw);
    } else {
      this.nsfw ??= false;
    }

    if ('topic' in data) {
      this.topic = data.topic ?? null;
    }

    if ('default_sort_order' in data && data.default_sort_order != null) {
      this.defaultSortOrder = (SortOrderTypes as Record<number, string>)[data.default_sort_order] ?? null;
    } else {
      this.defaultSortOrder ??= null;
    }

    return this;
  }

  public setAvailableTags(availableTags: GuildForumTagData[], reason?: string): Promise<this> {
    return this.edit({ availableTags }, reason) as Promise<this>;
  }

  public setDefaultReactionEmoji(defaultReactionEmoji: DefaultReactionEmoji | null, reason?: string): Promise<this> {
    return this.edit({ defaultReactionEmoji }, reason) as Promise<this>;
  }

  public setDefaultThreadRateLimitPerUser(defaultThreadRateLimitPerUser: number, reason?: string): Promise<this> {
    return this.edit({ defaultThreadRateLimitPerUser }, reason) as Promise<this>;
  }

  public setDefaultSortOrder(defaultSortOrder: number | string | null, reason?: string): Promise<this> {
    return this.edit({ defaultSortOrder }, reason) as Promise<this>;
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

  public setDefaultAutoArchiveDuration(defaultAutoArchiveDuration: number | 'MAX', reason?: string): Promise<this> {
    return this.edit({ defaultAutoArchiveDuration: defaultAutoArchiveDuration as unknown as number }, reason) as Promise<this>;
  }

  public setTopic(topic: string | null, reason?: string): Promise<this> {
    return this.edit({ topic: topic ?? undefined }, reason) as Promise<this>;
  }
}

TextBasedChannel.applyToClass(ThreadOnlyChannel, true, [
  'send',
  'lastMessage',
  'lastPinAt',
  'bulkDelete',
  'sendTyping',
  'createMessageCollector',
  'awaitMessages',
  'createMessageComponentCollector',
  'awaitMessageComponent',
]);

export default ThreadOnlyChannel;
