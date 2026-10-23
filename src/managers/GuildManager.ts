import process from 'node:process';
import { setTimeout, clearTimeout } from 'node:timers';
import { Collection } from '@discordjs/collection';
import type { Snowflake } from 'discord-api-types/v10';
import CachedManager from './CachedManager.js';
import { DiscordjsTypeError } from '../errors/index.js';
import { Guild } from '../structures/Guild.js';
import { GuildChannel } from '../structures/GuildChannel.js';
import { GuildEmoji } from '../structures/GuildEmoji.js';
import { GuildMember } from '../structures/GuildMember.js';
import { Invite } from '../structures/Invite.js';
import { OAuth2Guild, type RawOAuth2GuildData } from '../structures/OAuth2Guild.js';
import { Role } from '../structures/Role.js';
import {
  ChannelTypes,
  Events,
  OverwriteTypes,
  VerificationLevels,
  DefaultMessageNotificationLevels,
  ExplicitContentFilterLevels,
  VideoQualityModes,
} from '../util/Constants.js';
import { DataResolver, Base64Resolvable } from '../util/DataResolver.js';
import Permissions, { PermissionResolvable } from '../util/Permissions.js';
import SystemChannelFlags, { SystemChannelFlagsResolvable } from '../util/SystemChannelFlags.js';
import Util, { IncidentActions, type ColorResolvable } from '../util/Util.js';
import type { Client } from '../client/Client.js';
import type { BaseFetchOptions, DateResolvable } from '../types/index.js';

export type GuildResolvable =
  | Guild
  | GuildChannel
  | GuildMember
  | GuildEmoji
  | Role
  | Snowflake
  | Invite;

export interface PartialRoleData {
  id?: Snowflake | number;
  name?: string;
  color?: ColorResolvable;
  hoist?: boolean;
  position?: number;
  permissions?: PermissionResolvable;
  mentionable?: boolean;
}

export interface PartialOverwriteData {
  id: Snowflake | number;
  type?: string | number;
  allow?: PermissionResolvable;
  deny?: PermissionResolvable;
}

export interface PartialChannelData {
  id?: Snowflake | number;
  parentId?: Snowflake | number;
  parent_id?: Snowflake | number;
  type?: string | number;
  name: string;
  topic?: string;
  nsfw?: boolean;
  bitrate?: number;
  userLimit?: number;
  user_limit?: number;
  rtcRegion?: string | null;
  rtc_region?: string | null;
  videoQualityMode?: string | number;
  video_quality_mode?: string | number;
  permissionOverwrites?: PartialOverwriteData[];
  permission_overwrites?: PartialOverwriteData[];
  rateLimitPerUser?: number;
  rate_limit_per_user?: number;
}

export interface GuildCreateOptions {
  afkChannelId?: Snowflake | number;
  afkTimeout?: number;
  channels?: PartialChannelData[];
  defaultMessageNotifications?: string | number;
  explicitContentFilter?: string | number;
  icon?: Base64Resolvable | null;
  roles?: PartialRoleData[];
  systemChannelId?: Snowflake | number;
  systemChannelFlags?: SystemChannelFlagsResolvable;
  verificationLevel?: string | number;
}

export interface FetchGuildOptions extends BaseFetchOptions {
  guild?: GuildResolvable;
  withCounts?: boolean;
}

export interface FetchGuildsOptions {
  before?: Snowflake;
  after?: Snowflake;
  limit?: number;
}

export interface IncidentActionsEditOptions {
  invitesDisabledUntil?: DateResolvable | null;
  dmsDisabledUntil?: DateResolvable | null;
}

let cacheWarningEmitted = false;

/**
 * Manages API methods for Guilds and stores their cache.
 * @extends {CachedManager}
 */
export class GuildManager extends CachedManager<Snowflake, Guild, GuildResolvable> {
  public constructor(client: Client, iterable?: Iterable<Guild>) {
    super(client, Guild, iterable);
    if (!cacheWarningEmitted && (this._cache as unknown as { constructor: { name: string } }).constructor.name !== 'Collection') {
      cacheWarningEmitted = true;
      process.emitWarning(
        `Overriding the cache handling for ${this.constructor.name} is unsupported and breaks functionality.`,
        'UnsupportedCacheOverwriteWarning',
      );
    }
  }

  /**
   * Resolves a GuildResolvable to a Guild object.
   */
  public override resolve(guild: Guild): Guild;
  public override resolve(guild: GuildResolvable): Guild | null;
  public override resolve(guild: unknown): Guild | null {
    if (
      guild instanceof GuildChannel ||
      guild instanceof GuildMember ||
      guild instanceof GuildEmoji ||
      guild instanceof Role ||
      (guild instanceof Invite && guild.guild)
    ) {
      return super.resolve(guild.guild as Guild);
    }
    return super.resolve(guild as GuildResolvable);
  }

  /**
   * Resolves a GuildResolvable to a Guild id string.
   */
  public override resolveId(guild: Snowflake | Guild): Snowflake;
  public override resolveId(guild: GuildResolvable): Snowflake | null;
  public override resolveId(guild: unknown): Snowflake | null {
    if (
      guild instanceof GuildChannel ||
      guild instanceof GuildMember ||
      guild instanceof GuildEmoji ||
      guild instanceof Role ||
      (guild instanceof Invite && guild.guild)
    ) {
      return super.resolveId(guild.guild?.id as Snowflake);
    }
    return super.resolveId(guild as GuildResolvable);
  }

  /**
   * Creates a guild.
   */
  public async create(name: string, options: GuildCreateOptions = {}): Promise<Guild> {
    const {
      afkChannelId,
      afkTimeout,
      channels = [],
      defaultMessageNotifications: rawNotifications,
      explicitContentFilter: rawFilter,
      icon: rawIcon = null,
      roles = [],
      systemChannelId,
      systemChannelFlags: rawFlags,
      verificationLevel: rawVerification,
    } = options;

    const icon = await DataResolver.resolveImage(rawIcon);

    let verificationLevel = rawVerification;
    if (typeof verificationLevel === 'string') {
      verificationLevel = (VerificationLevels as Record<string, number>)[verificationLevel];
    }

    let defaultMessageNotifications = rawNotifications;
    if (typeof defaultMessageNotifications === 'string') {
      defaultMessageNotifications =
        (DefaultMessageNotificationLevels as Record<string, number>)[defaultMessageNotifications];
    }

    let explicitContentFilter = rawFilter;
    if (typeof explicitContentFilter === 'string') {
      explicitContentFilter = (ExplicitContentFilterLevels as Record<string, number>)[explicitContentFilter];
    }

    for (const channel of channels) {
      if (channel.type) {
        channel.type =
          typeof channel.type === 'number'
            ? channel.type
            : (ChannelTypes as Record<string, number>)[channel.type];
      }
      channel.parent_id = channel.parentId;
      delete channel.parentId;
      channel.user_limit = channel.userLimit;
      delete channel.userLimit;
      channel.rate_limit_per_user = channel.rateLimitPerUser;
      delete channel.rateLimitPerUser;
      channel.rtc_region = channel.rtcRegion;
      delete channel.rtcRegion;
      channel.video_quality_mode =
        typeof channel.videoQualityMode === 'string'
          ? (VideoQualityModes as Record<string, number>)[channel.videoQualityMode]
          : channel.videoQualityMode;
      delete channel.videoQualityMode;

      if (!channel.permissionOverwrites) continue;
      for (const overwrite of channel.permissionOverwrites) {
        if (typeof overwrite.type === 'string') {
          overwrite.type = (OverwriteTypes as Record<string, number>)[overwrite.type];
        }
        if (overwrite.allow) {
          overwrite.allow = Permissions.resolve(overwrite.allow).toString() as unknown as PermissionResolvable;
        }
        if (overwrite.deny) {
          overwrite.deny = Permissions.resolve(overwrite.deny).toString() as unknown as PermissionResolvable;
        }
      }
      channel.permission_overwrites = channel.permissionOverwrites;
      delete channel.permissionOverwrites;
    }

    for (const role of roles) {
      if (role.color) {
        role.color = Util.resolveColor(role.color) as ColorResolvable;
      }
      if (role.permissions) {
        role.permissions = Permissions.resolve(role.permissions).toString() as unknown as PermissionResolvable;
      }
    }

    const systemChannelFlags = rawFlags ? SystemChannelFlags.resolve(rawFlags) : undefined;

    const data = await (this.client.api as any).guilds.post({
      data: {
        name,
        icon,
        verification_level: verificationLevel,
        default_message_notifications: defaultMessageNotifications,
        explicit_content_filter: explicitContentFilter,
        roles,
        channels,
        afk_channel_id: afkChannelId,
        afk_timeout: afkTimeout,
        system_channel_id: systemChannelId,
        system_channel_flags: systemChannelFlags,
        guild_template_code: '2TffvPucqHkN',
      },
    });

    if (this.client.guilds.cache.has(data.id as Snowflake)) {
      return this.client.guilds.cache.get(data.id as Snowflake)!;
    }

    return new Promise<Guild>((resolve) => {
      let timeout: NodeJS.Timeout;
      const handleGuild = (guild: Guild): void => {
        if (guild.id === data.id) {
          clearTimeout(timeout);
          this.client.removeListener(Events.GUILD_CREATE, handleGuild as (...args: unknown[]) => void);
          this.client.decrementMaxListeners();
          resolve(guild);
        }
      };
      this.client.incrementMaxListeners();
      this.client.on(Events.GUILD_CREATE, handleGuild as (...args: unknown[]) => void);

      timeout = setTimeout(() => {
        this.client.removeListener(Events.GUILD_CREATE, handleGuild as (...args: unknown[]) => void);
        this.client.decrementMaxListeners();
        resolve(this.client.guilds._add(data));
      }, 10_000).unref();
    });
  }

  /**
   * Obtains one or multiple guilds from Discord, or the guild cache if it's already available.
   */
  public async fetch(
    id: Snowflake | FetchGuildOptions,
  ): Promise<Guild>;
  public async fetch(
    options?: FetchGuildsOptions,
  ): Promise<Collection<Snowflake, OAuth2Guild>>;
  public async fetch(
    options: GuildResolvable | FetchGuildOptions | FetchGuildsOptions = {},
  ): Promise<Guild | Collection<Snowflake, OAuth2Guild>> {
    const id =
      this.resolveId(options as GuildResolvable) ??
      (typeof options === 'object' && options !== null && 'guild' in options && options.guild
        ? this.resolveId(options.guild as GuildResolvable)
        : null);

    if (id) {
      const fetchOpts = options as FetchGuildOptions;
      if (!fetchOpts.force) {
        const existing = this.cache.get(id);
        if (existing) return existing;
      }

      const data = await (this.client.api as unknown as { guilds(id: string): { get(opts: unknown): Promise<unknown> } }).guilds(id).get({
        query: { with_counts: fetchOpts.withCounts ?? true },
      });
      return this._add(data, fetchOpts.cache);
    }

    const data = await (this.client.api as unknown as { users(u: string): { guilds: { get(opts: unknown): Promise<unknown> } } }).users('@me').guilds.get({ query: options });
    return (data as RawOAuth2GuildData[]).reduce(
      (coll: Collection<Snowflake, OAuth2Guild>, guild: RawOAuth2GuildData) =>
        coll.set(guild.id, new OAuth2Guild(this.client, guild)),
      new Collection<Snowflake, OAuth2Guild>(),
    );
  }

  /**
   * Sets the incident actions for a guild.
   */
  public async setIncidentActions(
    guild: GuildResolvable,
    { invitesDisabledUntil, dmsDisabledUntil }: IncidentActionsEditOptions,
  ): Promise<IncidentActions> {
    const guildId = this.resolveId(guild);
    if (!guildId) throw new DiscordjsTypeError('INVALID_TYPE', 'guild', 'GuildResolvable');

    const data = await (this.client.api as unknown as { guilds(id: string): Record<string, { put(opts: unknown): Promise<unknown> }> }).guilds(guildId)['incident-actions']!.put({
      data: {
        invites_disabled_until: invitesDisabledUntil ? new Date(invitesDisabledUntil).toISOString() : undefined,
        dms_disabled_until: dmsDisabledUntil ? new Date(dmsDisabledUntil).toISOString() : undefined,
      },
    });

    const parsedData = Util.transformAPIIncidentsData(data as Parameters<typeof Util.transformAPIIncidentsData>[0]);
    const resolvedGuild = this.resolve(guild);

    if (resolvedGuild) {
      (resolvedGuild as unknown as { incidentsData: IncidentActions }).incidentsData = parsedData;
    }

    return parsedData;
  }
}

export default GuildManager;
