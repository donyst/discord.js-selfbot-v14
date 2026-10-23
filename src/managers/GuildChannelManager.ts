import process from 'node:process';
import { Collection } from '@discordjs/collection';
import type { Snowflake } from 'discord-api-types/v10';
import CachedManager from './CachedManager.js';
import { DiscordjsError as Error, DiscordjsTypeError as TypeError } from '../errors/index.js';
import type { CategoryChannel } from '../structures/CategoryChannel.js';
import { GuildChannel } from '../structures/GuildChannel.js';
import { PermissionOverwrites, OverwriteResolvable } from '../structures/PermissionOverwrites.js';
import { ThreadChannel } from '../structures/ThreadChannel.js';
import { Webhook } from '../structures/Webhook.js';
import ChannelFlags, { ChannelFlagsResolvable } from '../util/ChannelFlags.js';
import {
  ThreadChannelTypes,
  ChannelTypes,
  VideoQualityModes,
  SortOrderTypes,
  ForumLayoutTypes,
} from '../util/Constants.js';
import { DataResolver, Base64Resolvable } from '../util/DataResolver.js';
import Util, {
  GuildForumTag,
  DefaultReactionEmoji,
} from '../util/Util.js';
import type { Guild } from '../structures/Guild.js';
import type { BaseFetchOptions } from '../types/index.js';

export type GuildChannelResolvable = GuildChannel | ThreadChannel | Snowflake;
export type CategoryChannelResolvable = CategoryChannel | Snowflake;
export type TextChannelResolvable = GuildChannel | Snowflake;
export type GuildTextChannelResolvable = import('../structures/TextChannel.js').TextChannel | Snowflake;

export type VideoQualityMode = 'AUTO' | 'FULL' | number;
export type SortOrderType = 'LATEST_ACTIVITY' | 'CREATION_DATE' | number;
export type ForumLayoutType = 'NOT_SET' | 'LIST_VIEW' | 'GALLERY_VIEW' | number;
export type ThreadAutoArchiveDuration = 60 | 1440 | 4320 | 10080 | 'MAX';

export interface SetChannelPositionOptions {
  relative?: boolean;
  reason?: string;
}

export interface ChannelPosition {
  channel: GuildChannelResolvable;
  position?: number;
  parent?: CategoryChannelResolvable;
  lockPermissions?: boolean;
}

export interface GuildChannelCreateOptions {
  type?: string | number;
  topic?: string;
  nsfw?: boolean;
  bitrate?: number;
  userLimit?: number;
  parent?: CategoryChannelResolvable;
  permissionOverwrites?: OverwriteResolvable[];
  position?: number;
  rateLimitPerUser?: number;
  rtcRegion?: string | null;
  videoQualityMode?: VideoQualityMode;
  availableTags?: GuildForumTag[];
  defaultReactionEmoji?: DefaultReactionEmoji | null;
  defaultSortOrder?: SortOrderType;
  defaultForumLayout?: ForumLayoutType;
  defaultThreadRateLimitPerUser?: number;
  reason?: string;
}

export interface ChannelWebhookCreateOptions {
  avatar?: Base64Resolvable | null;
  reason?: string;
}

export interface ChannelData {
  name?: string;
  type?: string | number;
  position?: number;
  topic?: string;
  nsfw?: boolean;
  bitrate?: number;
  userLimit?: number;
  parent?: CategoryChannelResolvable | null;
  lockPermissions?: boolean;
  permissionOverwrites?: OverwriteResolvable[];
  rateLimitPerUser?: number;
  defaultAutoArchiveDuration?: ThreadAutoArchiveDuration;
  rtcRegion?: string | null;
  videoQualityMode?: VideoQualityMode;
  flags?: ChannelFlagsResolvable;
  availableTags?: GuildForumTag[];
  defaultReactionEmoji?: DefaultReactionEmoji | null;
  defaultThreadRateLimitPerUser?: number;
  defaultSortOrder?: SortOrderType;
}

let cacheWarningEmitted = false;
let storeChannelDeprecationEmitted = false;

/**
 * Manages API methods for GuildChannels and stores their cache.
 * @extends {CachedManager}
 */
export class GuildChannelManager extends CachedManager<
  Snowflake,
  GuildChannel | ThreadChannel,
  GuildChannelResolvable
> {
  /**
   * The guild this Manager belongs to
   */
  public guild: Guild;

  public constructor(guild: Guild, iterable?: Iterable<GuildChannel | ThreadChannel>) {
    super(guild.client, GuildChannel as unknown as typeof GuildChannel & (new (...args: unknown[]) => GuildChannel | ThreadChannel), iterable);

    const cacheAny = this._cache as unknown as {
      constructor: { name: string };
      maxSize?: number;
      sweepFilter?: { isDefault?: boolean };
    };

    const defaultCaching =
      cacheAny.constructor.name === 'Collection' ||
      ((cacheAny.maxSize === undefined || cacheAny.maxSize === Infinity) &&
        (cacheAny.sweepFilter === undefined || cacheAny.sweepFilter.isDefault));
    if (!cacheWarningEmitted && !defaultCaching) {
      cacheWarningEmitted = true;
      process.emitWarning(
        `Overriding the cache handling for ${this.constructor.name} is unsupported and breaks functionality.`,
        'UnsupportedCacheOverwriteWarning',
      );
    }

    this.guild = guild;
  }

  /**
   * The number of channels in this manager's cache excluding thread channels
   * that do not count towards a guild's maximum channels restriction.
   */
  public get channelCountWithoutThreads(): number {
    return this.cache.reduce((acc, channel) => {
      if ((ThreadChannelTypes as readonly string[]).includes(channel.type)) return acc;
      return acc + 1;
    }, 0);
  }

  public override _add(channel: GuildChannel | ThreadChannel): GuildChannel | ThreadChannel {
    const existing = this.cache.get(channel.id);
    if (existing) return existing;
    this.cache.set(channel.id, channel);
    return channel;
  }

  /**
   * Resolves a GuildChannelResolvable to a Channel object.
   */
  public override resolve(channel: GuildChannel | ThreadChannel): GuildChannel | ThreadChannel;
  public override resolve(channel: GuildChannelResolvable): (GuildChannel | ThreadChannel) | null;
  public override resolve(channel: unknown): (GuildChannel | ThreadChannel) | null {
    if (channel instanceof ThreadChannel) return this.cache.get(channel.id) ?? null;
    return super.resolve(channel as GuildChannelResolvable);
  }

  /**
   * Resolves a GuildChannelResolvable to a channel id.
   */
  public override resolveId(channel: Snowflake | GuildChannel | ThreadChannel): Snowflake;
  public override resolveId(channel: GuildChannelResolvable): Snowflake | null;
  public override resolveId(channel: unknown): Snowflake | null {
    if (channel instanceof ThreadChannel) return super.resolveId(channel.id);
    return super.resolveId(channel as GuildChannelResolvable);
  }

  /**
   * Creates a new channel in the guild.
   */
  public async create(
    name: string,
    options: GuildChannelCreateOptions = {},
  ): Promise<GuildChannel> {
    let parentId: Snowflake | null | undefined = undefined;
    if (options.parent) {
      parentId = this.client.channels.resolveId(options.parent as unknown as Parameters<typeof this.client.channels.resolveId>[0]);
    }

    const permissionOverwrites = options.permissionOverwrites?.map((o) =>
      PermissionOverwrites.resolve(o, this.guild),
    );

    const intType =
      typeof options.type === 'number'
        ? options.type
        : options.type
        ? (ChannelTypes as Record<string, number>)[options.type] ?? ChannelTypes.GUILD_TEXT
        : ChannelTypes.GUILD_TEXT;

    const videoMode =
      typeof options.videoQualityMode === 'number'
        ? options.videoQualityMode
        : options.videoQualityMode
        ? (VideoQualityModes as Record<string, number>)[options.videoQualityMode]
        : undefined;

    const sortMode =
      typeof options.defaultSortOrder === 'number'
        ? options.defaultSortOrder
        : options.defaultSortOrder
        ? (SortOrderTypes as Record<string, number>)[options.defaultSortOrder]
        : undefined;

    const layoutMode =
      typeof options.defaultForumLayout === 'number'
        ? options.defaultForumLayout
        : options.defaultForumLayout
        ? (ForumLayoutTypes as Record<string, number>)[options.defaultForumLayout]
        : undefined;

    if (intType === ChannelTypes.GUILD_STORE && !storeChannelDeprecationEmitted) {
      storeChannelDeprecationEmitted = true;
      process.emitWarning(
        'Creating store channels is deprecated by Discord and will stop working in March 2022. Check the docs for more info.',
        'DeprecationWarning',
      );
    }

    const data = await (this.client.api as any).guilds(this.guild.id).channels.post({
      data: {
        name,
        topic: options.topic,
        type: intType,
        nsfw: options.nsfw,
        bitrate: options.bitrate,
        user_limit: options.userLimit,
        parent_id: parentId,
        position: options.position,
        permission_overwrites: permissionOverwrites,
        rate_limit_per_user: options.rateLimitPerUser,
        rtc_region: options.rtcRegion,
        video_quality_mode: videoMode,
        available_tags: options.availableTags?.map((tag) => Util.transformGuildForumTag(tag)),
        default_reaction_emoji: options.defaultReactionEmoji
          ? Util.transformGuildDefaultReaction(options.defaultReactionEmoji)
          : undefined,
        default_sort_order: sortMode,
        default_forum_layout: layoutMode,
        default_thread_rate_limit_per_user: options.defaultThreadRateLimitPerUser,
      },
      reason: options.reason,
    });

    return (this.client.actions as any).ChannelCreate.handle(data).channel;
  }

  /**
   * Creates a webhook for the channel.
   */
  public async createWebhook(
    channel: GuildChannelResolvable,
    name: string,
    options: ChannelWebhookCreateOptions = {},
  ): Promise<Webhook> {
    const id = this.resolveId(channel);
    if (!id) throw new TypeError('INVALID_TYPE', 'channel', 'GuildChannelResolvable');

    const resolvedImage = await DataResolver.resolveImage(options.avatar);

    const data = await (this.client.api as any).channels[id].webhooks.post({
      data: {
        name,
        avatar: resolvedImage,
      },
      reason: options.reason,
    });
    return new Webhook(this.client, data);
  }

  /**
   * Adds the target channel to a channel's followers.
   */
  public async addFollower(
    channel: NewsChannelLike | Snowflake,
    targetChannel: TextChannelResolvable,
    reason?: string,
  ): Promise<Snowflake> {
    const channelId = this.resolveId(channel as GuildChannelResolvable);
    const targetChannelId = this.resolveId(targetChannel);
    if (!channelId || !targetChannelId) throw new Error('GUILD_CHANNEL_RESOLVE');

    const { webhook_id } = await (this.client.api as any).channels[channelId].followers.post({
      data: { webhook_channel_id: targetChannelId },
      reason,
    });
    return webhook_id as Snowflake;
  }

  /**
   * Edits the channel.
   */
  public async edit(
    channel: GuildChannelResolvable,
    data: ChannelData,
    reason?: string,
  ): Promise<GuildChannel> {
    const resolvedChannel = this.resolve(channel) as GuildChannel | null;
    if (!resolvedChannel) throw new TypeError('INVALID_TYPE', 'channel', 'GuildChannelResolvable');

    const parentId =
      data.parent !== undefined
        ? data.parent
          ? this.client.channels.resolveId(data.parent as unknown as Parameters<typeof this.client.channels.resolveId>[0])
          : null
        : undefined;

    if (typeof data.position !== 'undefined') {
      await this.setPosition(resolvedChannel, data.position, { reason });
    }

    let permission_overwrites = data.permissionOverwrites?.map((o) =>
      PermissionOverwrites.resolve(o, this.guild),
    );

    if (data.lockPermissions) {
      if (parentId) {
        const newParent = this.cache.get(parentId) as GuildChannel | undefined;
        if (newParent?.type === 'GUILD_CATEGORY') {
          permission_overwrites = newParent.permissionOverwrites.cache.map((o) =>
            PermissionOverwrites.resolve(o, this.guild),
          );
        }
      } else if (resolvedChannel.parent) {
        permission_overwrites = (resolvedChannel.parent as unknown as GuildChannel).permissionOverwrites.cache.map(
          (o) => PermissionOverwrites.resolve(o, this.guild),
        );
      }
    }

    let defaultAutoArchiveDuration = data.defaultAutoArchiveDuration;
    if (defaultAutoArchiveDuration === 'MAX') {
      defaultAutoArchiveDuration = Util.resolveAutoArchiveMaxLimit() as unknown as ThreadAutoArchiveDuration;
    }

    const videoMode =
      typeof data.videoQualityMode === 'string'
        ? (VideoQualityModes as Record<string, number>)[data.videoQualityMode]
        : data.videoQualityMode;

    const sortOrder =
      typeof data.defaultSortOrder === 'string'
        ? (SortOrderTypes as Record<string, number>)[data.defaultSortOrder]
        : data.defaultSortOrder;

    const patchPayload: Record<string, unknown> = {
      name: (data.name ?? resolvedChannel.name).trim(),
      type: data.type,
      topic: data.topic,
      nsfw: data.nsfw,
      bitrate: data.bitrate ?? (resolvedChannel as unknown as { bitrate?: number }).bitrate,
      user_limit: data.userLimit ?? (resolvedChannel as unknown as { userLimit?: number }).userLimit,
      rtc_region: 'rtcRegion' in data ? data.rtcRegion : (resolvedChannel as unknown as { rtcRegion?: string }).rtcRegion,
      video_quality_mode: videoMode,
      parent_id: parentId,
      lock_permissions: data.lockPermissions,
      rate_limit_per_user: data.rateLimitPerUser,
      default_auto_archive_duration: defaultAutoArchiveDuration,
      permission_overwrites,
      available_tags: data.availableTags?.map((tag) => Util.transformGuildForumTag(tag)),
      default_reaction_emoji: data.defaultReactionEmoji
        ? Util.transformGuildDefaultReaction(data.defaultReactionEmoji)
        : undefined,
      default_thread_rate_limit_per_user: data.defaultThreadRateLimitPerUser,
      flags: 'flags' in data && data.flags !== undefined ? ChannelFlags.resolve(data.flags) : undefined,
      default_sort_order: sortOrder,
    };

    const newData = await (this.client.api as any).channels(resolvedChannel.id).patch({
      data: patchPayload,
      reason,
    });

    return (this.client.actions as any).ChannelUpdate.handle(newData).updated;
  }

  /**
   * Sets a new position for the guild channel.
   */
  public async setPosition(
    channel: GuildChannelResolvable,
    position: number,
    { relative, reason }: SetChannelPositionOptions = {},
  ): Promise<GuildChannel> {
    const resolvedChannel = this.resolve(channel) as GuildChannel | null;
    if (!resolvedChannel) throw new TypeError('INVALID_TYPE', 'channel', 'GuildChannelResolvable');

    const updatedChannels = await (Util as any).setPosition(
      resolvedChannel,
      position,
      relative,
      (this.guild as any)._sortedChannels(resolvedChannel),
      (this.client.api as any).guilds(this.guild.id).channels,
      reason,
    );

    (this.client.actions as any).GuildChannelsPositionUpdate.handle({
      guild_id: this.guild.id,
      channels: updatedChannels,
    });
    return resolvedChannel;
  }

  /**
   * Obtains one or more guild channels from Discord, or the channel cache if they're already available.
   */
  public async fetch(
    id: Snowflake,
    options?: BaseFetchOptions,
  ): Promise<GuildChannel | ThreadChannel | null>;
  public async fetch(
    options?: BaseFetchOptions,
  ): Promise<Collection<Snowflake, GuildChannel>>;
  public async fetch(
    id?: Snowflake | BaseFetchOptions,
    options?: BaseFetchOptions,
  ): Promise<GuildChannel | ThreadChannel | Collection<Snowflake, GuildChannel> | null> {
    let channelId: Snowflake | undefined;
    let cache = true;
    let force = false;

    if (typeof id === 'object' && id !== null) {
      cache = id.cache ?? true;
      force = id.force ?? false;
    } else if (typeof id === 'string') {
      channelId = id;
      if (options) {
        cache = options.cache ?? true;
        force = options.force ?? false;
      }
    }

    if (channelId && !force) {
      const existing = this.cache.get(channelId);
      if (existing) return existing;
    }

    if (channelId) {
      const data = await (this.client.api as any).channels(channelId).get();
      if (this.guild.id !== data.guild_id) throw new Error('GUILD_CHANNEL_UNOWNED');
      return (this.client.channels as any)._add(data, this.guild, { cache });
    }

    const data = await (this.client.api as any).guilds(this.guild.id).channels.get();
    const channels = new Collection<Snowflake, GuildChannel>();
    for (const channel of data) {
      channels.set(
        channel.id as Snowflake,
        (this.client.channels as any)._add(channel, this.guild, { cache }) as GuildChannel,
      );
    }
    return channels;
  }

  /**
   * Fetches all webhooks for the channel.
   */
  public async fetchWebhooks(channel: GuildChannelResolvable): Promise<Collection<Snowflake, Webhook>> {
    const id = this.resolveId(channel);
    if (!id) throw new TypeError('INVALID_TYPE', 'channel', 'GuildChannelResolvable');
    const data = await (this.client as unknown as { api: { channels: Record<string, { webhooks: { get(): Promise<Array<import('../structures/Webhook.js').RawWebhookData>> } }> } })
      .api.channels[id].webhooks.get();
    return data.reduce(
      (hooks: Collection<Snowflake, Webhook>, hook: import('../structures/Webhook.js').RawWebhookData) =>
        hooks.set(hook.id as Snowflake, new Webhook(this.client, hook)),
      new Collection<Snowflake, Webhook>(),
    );
  }

  /**
   * Batch-updates the guild's channels' positions.
   */
  public async setPositions(channelPositions: ChannelPosition[]): Promise<Guild> {
    const transformedPositions = channelPositions.map((r) => ({
      id: this.client.channels.resolveId(r.channel as unknown as Parameters<typeof this.client.channels.resolveId>[0]),
      position: r.position,
      lock_permissions: r.lockPermissions,
      parent_id: typeof r.parent !== 'undefined' ? this.resolveId(r.parent) : undefined,
    }));

    await (this.client.api as any).guilds(this.guild.id).channels.patch({
      data: transformedPositions,
    });
    return (this.client.actions as any).GuildChannelsPositionUpdate.handle({
      guild_id: this.guild.id,
      channels: transformedPositions,
    }).guild;
  }

  /**
   * Deletes the channel.
   */
  public async delete(channel: GuildChannelResolvable, reason?: string): Promise<void> {
    const id = this.resolveId(channel);
    if (!id) throw new TypeError('INVALID_TYPE', 'channel', 'GuildChannelResolvable');
    await (this.client.api as any).channels(id).delete({ reason });
  }
}

export interface NewsChannelLike {
  id: Snowflake;
  type: string;
}

export default GuildChannelManager;
