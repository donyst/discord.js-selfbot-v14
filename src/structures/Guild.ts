import process from 'node:process';
import { Collection } from '@discordjs/collection';
import type { Snowflake } from 'discord-api-types/v10';
import AnonymousGuild, { type AnonymousGuildData } from './AnonymousGuild.js';
import { GuildAuditLogs, type RawGuildAuditLogsData } from './GuildAuditLogs.js';
import { GuildPreview } from './GuildPreview.js';
import { GuildTemplate } from './GuildTemplate.js';
import { Integration } from './Integration.js';
import { Webhook } from './Webhook.js';
import { WelcomeScreen, type APIWelcomeScreenData } from './WelcomeScreen.js';
import { DiscordjsError as Error, DiscordjsTypeError as TypeError } from '../errors/index.js';
import AutoModerationRuleManager from '../managers/AutoModerationRuleManager.js';
import GuildBanManager from '../managers/GuildBanManager.js';
import GuildChannelManager, {
  type ChannelPosition,
  type GuildChannelResolvable,
  type TextChannelResolvable,
} from '../managers/GuildChannelManager.js';
import GuildEmojiManager from '../managers/GuildEmojiManager.js';
import GuildInviteManager from '../managers/GuildInviteManager.js';
import GuildMemberManager, { type GuildMemberResolvable } from '../managers/GuildMemberManager.js';
import GuildScheduledEventManager from '../managers/GuildScheduledEventManager.js';
import GuildSettingManager from '../managers/GuildSettingManager.js';
import GuildStickerManager from '../managers/GuildStickerManager.js';
import ApplicationCommandManager from '../managers/ApplicationCommandManager.js';
import PresenceManager from '../managers/PresenceManager.js';
import RoleManager, { type GuildRolePosition } from '../managers/RoleManager.js';
import StageInstanceManager from '../managers/StageInstanceManager.js';
import VoiceStateManager from '../managers/VoiceStateManager.js';
import {
  DefaultMessageNotificationLevels,
  VerificationLevels,
  ExplicitContentFilterLevels,
  Status,
  MFALevels,
  PremiumTiers,
} from '../util/Constants.js';
import { DataResolver, type Base64Resolvable } from '../util/DataResolver.js';
import SystemChannelFlags, { type SystemChannelFlagsResolvable } from '../util/SystemChannelFlags.js';
import Util, { type IncidentActions } from '../util/Util.js';
import type { Client } from '../client/Client.js';
import type { GuildMember } from './GuildMember.js';
import type { GuildEmoji } from './GuildEmoji.js';
import type { Role } from './Role.js';
import type { GuildChannel } from './GuildChannel.js';
import type { VoiceChannel } from './VoiceChannel.js';
import type { TextChannel } from './TextChannel.js';
import type { WebSocketShard } from '../client/websocket/WebSocketShard.js';
import type { BaseFetchOptions, DateResolvable, ImageURLOptions } from '../types/index.js';

let deprecationEmittedForSetChannelPositions = false;
let deprecationEmittedForSetRolePositions = false;
let deprecationEmittedForDeleted = false;
let deprecationEmittedForMe = false;

export const deletedGuilds = new WeakSet<Guild>();

export type PremiumTier = 'NONE' | 'TIER_1' | 'TIER_2' | 'TIER_3';
export type ExplicitContentFilterLevel = 'DISABLED' | 'MEMBERS_WITHOUT_ROLES' | 'ALL_MEMBERS';
export type MFALevel = 'NONE' | 'ELEVATED';
export type DefaultMessageNotificationLevel = 'ALL_MESSAGES' | 'ONLY_MENTIONS';
export type VoiceChannelResolvable = VoiceChannel | Snowflake;
export type GuildTextChannelResolvable = TextChannel | Snowflake;

export interface Vanity {
  code: string | null;
  uses: number;
}

export interface GuildWidgetSettings {
  enabled: boolean;
  channel: GuildChannel | null;
}

export interface GuildWidgetSettingsData {
  enabled: boolean;
  channel?: GuildChannelResolvable | null;
}

export interface WelcomeChannelData {
  description: string;
  channel: GuildChannelResolvable;
  emoji?: unknown;
}

export interface WelcomeScreenEditData {
  enabled?: boolean;
  description?: string;
  welcomeChannels?: WelcomeChannelData[];
}

export interface GuildEditData {
  name?: string;
  verificationLevel?: string | number;
  explicitContentFilter?: string | number;
  afkChannel?: VoiceChannelResolvable | null;
  systemChannel?: TextChannelResolvable | null;
  afkTimeout?: number;
  icon?: Base64Resolvable | null;
  owner?: GuildMemberResolvable;
  splash?: Base64Resolvable | null;
  discoverySplash?: Base64Resolvable | null;
  banner?: Base64Resolvable | null;
  defaultMessageNotifications?: string | number;
  systemChannelFlags?: SystemChannelFlagsResolvable;
  rulesChannel?: TextChannelResolvable | null;
  publicUpdatesChannel?: TextChannelResolvable | null;
  preferredLocale?: string;
  safetyAlertsChannel?: TextChannelResolvable | null;
  premiumProgressBarEnabled?: boolean;
  description?: string | null;
  features?: string[];
}

export interface IncidentActionsEditOptions {
  invitesDisabledUntil?: DateResolvable | null;
  dmsDisabledUntil?: DateResolvable | null;
}

export interface GuildAuditLogsFetchOptions {
  before?: Snowflake | { id: Snowflake };
  after?: Snowflake | { id: Snowflake };
  limit?: number;
  user?: unknown;
  type?: string | number;
}

export interface GuildRawData extends AnonymousGuildData {
  unavailable?: boolean;
  shardId?: number;
  discovery_splash?: string | null;
  member_count?: number;
  large?: boolean;
  premium_progress_bar_enabled?: boolean;
  application_id?: Snowflake | null;
  afk_timeout?: number;
  afk_channel_id?: Snowflake | null;
  system_channel_id?: Snowflake | null;
  premium_tier?: number;
  widget_enabled?: boolean;
  widget_channel_id?: string | null;
  explicit_content_filter?: number;
  mfa_level?: number;
  joined_at?: string;
  default_message_notifications?: number;
  system_channel_flags?: number;
  max_members?: number | null;
  max_presences?: number | null;
  max_video_channel_users?: number | null;
  max_stage_video_channel_users?: number | null;
  approximate_member_count?: number | null;
  approximate_presence_count?: number | null;
  rules_channel_id?: Snowflake | null;
  public_updates_channel_id?: Snowflake | null;
  preferred_locale?: string;
  safety_alerts_channel_id?: Snowflake | null;
  channels?: Record<string, unknown>[];
  threads?: Record<string, unknown>[];
  roles?: Record<string, unknown>[];
  members?: Record<string, unknown>[];
  owner_id?: Snowflake;
  presences?: Record<string, unknown>[];
  stage_instances?: Record<string, unknown>[];
  guild_scheduled_events?: Record<string, unknown>[];
  voice_states?: Record<string, unknown>[];
  emojis?: Record<string, unknown>[];
  stickers?: Record<string, unknown>[];
  incidents_data?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Represents a guild (or a server) on Discord.
 * @extends {AnonymousGuild}
 */
export class Guild extends AnonymousGuild {
  public members: GuildMemberManager;
  public channels: GuildChannelManager;
  public bans: GuildBanManager;
  public roles: RoleManager;
  public presences: PresenceManager;
  public voiceStates: VoiceStateManager;
  public stageInstances: StageInstanceManager;
  public invites: GuildInviteManager;
  public scheduledEvents: GuildScheduledEventManager;
  public autoModerationRules: AutoModerationRuleManager;
  public settings: GuildSettingManager;
  public commands: ApplicationCommandManager;
  public emojis!: GuildEmojiManager;
  public stickers!: GuildStickerManager;

  public available: boolean = true;
  public shardId!: number;
  public discoverySplash: string | null = null;
  public memberCount: number = 0;
  public large: boolean = false;
  public premiumProgressBarEnabled: boolean = false;
  public applicationId: Snowflake | null = null;
  public afkTimeout: number | null = null;
  public afkChannelId: Snowflake | null = null;
  public systemChannelId: Snowflake | null = null;
  public premiumTier: PremiumTier = 'NONE';
  public widgetEnabled: boolean | null = null;
  public widgetChannelId: string | null = null;
  public explicitContentFilter: ExplicitContentFilterLevel = 'DISABLED';
  public mfaLevel: MFALevel = 'NONE';
  public joinedTimestamp: number = 0;
  public defaultMessageNotifications: DefaultMessageNotificationLevel = 'ALL_MESSAGES';
  public systemChannelFlags: Readonly<SystemChannelFlags> = new SystemChannelFlags().freeze();
  public maximumMembers: number | null = null;
  public maximumPresences: number | null = null;
  public maxVideoChannelUsers: number | null = null;
  public maxStageVideoChannelUsers: number | null = null;
  public approximateMemberCount: number | null = null;
  public approximatePresenceCount: number | null = null;
  public vanityURLUses: number | null = null;
  public rulesChannelId: Snowflake | null = null;
  public publicUpdatesChannelId: Snowflake | null = null;
  public preferredLocale: string = 'en-US';
  public safetyAlertsChannelId: Snowflake | null = null;
  public ownerId!: Snowflake;
  public incidentsData: IncidentActions | null = null;

  public constructor(client: Client, data?: GuildRawData) {
    super(client, (data ?? {}) as unknown as AnonymousGuildData, false);

    this.members = new GuildMemberManager(this);
    this.channels = new GuildChannelManager(this);
    this.bans = new GuildBanManager(this);
    this.roles = new RoleManager(this);
    this.commands = new ApplicationCommandManager(this.client);
    this.commands.guild = this;
    this.presences = new PresenceManager(this.client);
    this.voiceStates = new VoiceStateManager(this);
    this.stageInstances = new StageInstanceManager(this);
    this.invites = new GuildInviteManager(this);
    this.scheduledEvents = new GuildScheduledEventManager(this);
    this.autoModerationRules = new AutoModerationRuleManager(this);
    this.settings = new GuildSettingManager(this);

    if (!data) return;
    if (data.unavailable) {
      this.available = false;
    } else {
      this._patch(data);
      if (!data.channels) this.available = false;
    }

    this.shardId = data.shardId!;
  }

  public get deleted(): boolean {
    if (!deprecationEmittedForDeleted) {
      deprecationEmittedForDeleted = true;
      process.emitWarning(
        'Guild#deleted is deprecated, see https://github.com/discordjs/discord.js/issues/7091.',
        'DeprecationWarning',
      );
    }
    return deletedGuilds.has(this);
  }

  public set deleted(value: boolean) {
    if (!deprecationEmittedForDeleted) {
      deprecationEmittedForDeleted = true;
      process.emitWarning(
        'Guild#deleted is deprecated, see https://github.com/discordjs/discord.js/issues/7091.',
        'DeprecationWarning',
      );
    }
    if (value) deletedGuilds.add(this);
    else deletedGuilds.delete(this);
  }

  public get shard(): WebSocketShard | undefined {
    return (this.client.ws as any).shards.get(this.shardId);
  }

  public override _patch(data: GuildRawData): this {
    super._patch(data);
    this.id = data.id;
    if ('name' in data && data.name) this.name = data.name;
    if ('icon' in data) this.icon = data.icon ?? null;
    if ('unavailable' in data) {
      this.available = !data.unavailable;
    } else {
      this.available ??= true;
    }

    if ('discovery_splash' in data) {
      this.discoverySplash = data.discovery_splash ?? null;
    }

    if ('member_count' in data && data.member_count !== undefined) {
      this.memberCount = data.member_count;
    }

    if ('large' in data) {
      this.large = Boolean(data.large);
    }

    if ('premium_progress_bar_enabled' in data && data.premium_progress_bar_enabled !== undefined) {
      this.premiumProgressBarEnabled = data.premium_progress_bar_enabled;
    }

    if ('application_id' in data) {
      this.applicationId = data.application_id ?? null;
    }

    if ('afk_timeout' in data && data.afk_timeout !== undefined) {
      this.afkTimeout = data.afk_timeout;
    }

    if ('afk_channel_id' in data) {
      this.afkChannelId = data.afk_channel_id ?? null;
    }

    if ('system_channel_id' in data) {
      this.systemChannelId = data.system_channel_id ?? null;
    }

    if ('premium_tier' in data && data.premium_tier !== undefined) {
      this.premiumTier = (PremiumTiers as Record<number, PremiumTier>)[data.premium_tier] ?? 'NONE';
    }

    if ('widget_enabled' in data) {
      this.widgetEnabled = data.widget_enabled ?? null;
    }

    if ('widget_channel_id' in data) {
      this.widgetChannelId = data.widget_channel_id ?? null;
    }

    if ('explicit_content_filter' in data && data.explicit_content_filter !== undefined) {
      this.explicitContentFilter =
        (ExplicitContentFilterLevels as Record<number, ExplicitContentFilterLevel>)[data.explicit_content_filter] ??
        'DISABLED';
    }

    if ('mfa_level' in data && data.mfa_level !== undefined) {
      this.mfaLevel = (MFALevels as Record<number, MFALevel>)[data.mfa_level] ?? 'NONE';
    }

    if ('joined_at' in data && data.joined_at) {
      this.joinedTimestamp = new Date(data.joined_at).getTime();
    }

    if ('default_message_notifications' in data && data.default_message_notifications !== undefined) {
      this.defaultMessageNotifications =
        (DefaultMessageNotificationLevels as Record<number, DefaultMessageNotificationLevel>)[
          data.default_message_notifications
        ] ?? 'ALL_MESSAGES';
    }

    if ('system_channel_flags' in data && data.system_channel_flags !== undefined) {
      this.systemChannelFlags = new SystemChannelFlags(data.system_channel_flags).freeze();
    }

    if ('max_members' in data) {
      this.maximumMembers = data.max_members ?? null;
    } else {
      this.maximumMembers ??= null;
    }

    if ('max_presences' in data) {
      this.maximumPresences = data.max_presences ?? 25_000;
    } else {
      this.maximumPresences ??= null;
    }

    if ('max_video_channel_users' in data) {
      this.maxVideoChannelUsers = data.max_video_channel_users ?? null;
    } else {
      this.maxVideoChannelUsers ??= null;
    }

    if ('max_stage_video_channel_users' in data) {
      this.maxStageVideoChannelUsers = data.max_stage_video_channel_users ?? null;
    } else {
      this.maxStageVideoChannelUsers ??= null;
    }

    if ('approximate_member_count' in data) {
      this.approximateMemberCount = data.approximate_member_count ?? null;
    } else {
      this.approximateMemberCount ??= null;
    }

    if ('approximate_presence_count' in data) {
      this.approximatePresenceCount = data.approximate_presence_count ?? null;
    } else {
      this.approximatePresenceCount ??= null;
    }

    this.vanityURLUses ??= null;

    if ('rules_channel_id' in data) {
      this.rulesChannelId = data.rules_channel_id ?? null;
    }

    if ('public_updates_channel_id' in data) {
      this.publicUpdatesChannelId = data.public_updates_channel_id ?? null;
    }

    if ('preferred_locale' in data && data.preferred_locale) {
      this.preferredLocale = data.preferred_locale;
    }

    if ('safety_alerts_channel_id' in data) {
      this.safetyAlertsChannelId = data.safety_alerts_channel_id ?? null;
    } else {
      this.safetyAlertsChannelId ??= null;
    }

    if (data.channels) {
      this.channels.cache.clear();
      for (const rawChannel of data.channels) {
        (this.client.channels as any)._add(rawChannel, this);
      }
    }

    if (data.threads) {
      for (const rawThread of data.threads) {
        (this.client.channels as any)._add(rawThread, this);
      }
    }

    if (data.roles) {
      this.roles.cache.clear();
      for (const role of data.roles) this.roles._add(role as unknown as import('./Role.js').APIRoleData);
    }

    if (data.members) {
      this.members.cache.clear();
      for (const guildUser of data.members) this.members._add(guildUser);
    }

    if ('owner_id' in data && data.owner_id) {
      this.ownerId = data.owner_id;
    }

    if (data.presences) {
      for (const presence of data.presences) {
        this.presences._add(Object.assign(presence, { guild: this }));
      }
    }

    if (data.stage_instances) {
      this.stageInstances.cache.clear();
      for (const stageInstance of data.stage_instances) {
        this.stageInstances._add(stageInstance);
      }
    }

    if (data.guild_scheduled_events) {
      this.scheduledEvents.cache.clear();
      for (const scheduledEvent of data.guild_scheduled_events) {
        this.scheduledEvents._add(scheduledEvent);
      }
    }

    if (data.voice_states) {
      this.voiceStates.cache.clear();
      for (const voiceState of data.voice_states) {
        this.voiceStates._add(voiceState as unknown as import('./VoiceState.js').RawVoiceStateData);
      }
    }

    if (!this.emojis) {
      this.emojis = new GuildEmojiManager(this);
      if (data.emojis) for (const emoji of data.emojis) this.emojis._add(emoji);
    } else if (data.emojis) {
      (this.client.actions as unknown as { GuildEmojisUpdate: { handle(d: unknown): void } }).GuildEmojisUpdate.handle({
        guild_id: this.id,
        emojis: data.emojis,
      });
    }

    if (!this.stickers) {
      this.stickers = new GuildStickerManager(this);
      if (data.stickers) for (const sticker of data.stickers) this.stickers._add(sticker as unknown as import('./Sticker.js').APIStickerData);
    } else if (data.stickers) {
      (this.client.actions as unknown as { GuildStickersUpdate: { handle(d: unknown): void } }).GuildStickersUpdate.handle({
        guild_id: this.id,
        stickers: data.stickers,
      });
    }

    if ('incidents_data' in data && data.incidents_data) {
      this.incidentsData = Util.transformAPIIncidentsData(data.incidents_data as Parameters<typeof Util.transformAPIIncidentsData>[0]);
    } else {
      this.incidentsData ??= null;
    }

    return this;
  }

  public get joinedAt(): Date {
    return new Date(this.joinedTimestamp);
  }

  public discoverySplashURL({ format, size }: ImageURLOptions = {}): string | null {
    return (
      (this.discoverySplash &&
        this.client.rest.cdn.DiscoverySplash(this.id, this.discoverySplash, format, size)) ??
      null
    );
  }

  public fetchOwner(options?: BaseFetchOptions): Promise<GuildMember> {
    return this.members.fetch({ ...options, user: this.ownerId }) as Promise<GuildMember>;
  }

  public get afkChannel(): VoiceChannel | null {
    return (this.client.channels.resolve(this.afkChannelId!) as VoiceChannel | null) ?? null;
  }

  public get systemChannel(): TextChannel | null {
    return (this.client.channels.resolve(this.systemChannelId!) as TextChannel | null) ?? null;
  }

  public get safetyAlertsChannel(): TextChannel | null {
    return (this.client.channels.resolve(this.safetyAlertsChannelId!) as TextChannel | null) ?? null;
  }

  public get widgetChannel(): GuildChannel | null {
    return (this.client.channels.resolve(this.widgetChannelId!) as GuildChannel | null) ?? null;
  }

  public get rulesChannel(): TextChannel | null {
    return (this.client.channels.resolve(this.rulesChannelId!) as TextChannel | null) ?? null;
  }

  public get publicUpdatesChannel(): TextChannel | null {
    return (this.client.channels.resolve(this.publicUpdatesChannelId!) as TextChannel | null) ?? null;
  }

  public get me(): GuildMember | null {
    if (!deprecationEmittedForMe) {
      process.emitWarning('Guild#me is deprecated. Use Guild#members#me instead.', 'DeprecationWarning');
      deprecationEmittedForMe = true;
    }
    return this.members.me;
  }

  public get maximumBitrate(): number {
    if (this.features.includes('VIP_REGIONS')) {
      return 384_000;
    }
    switch (this.premiumTier) {
      case 'TIER_1':
        return 128_000;
      case 'TIER_2':
        return 256_000;
      case 'TIER_3':
        return 384_000;
      default:
        return 96_000;
    }
  }

  public async fetchIntegrations(): Promise<Collection<Snowflake | string, Integration>> {
    const data = await (this.client.api as any).guilds(this.id).integrations.get();
    return (data as Array<Record<string, unknown>>).reduce(
      (collection: Collection<Snowflake | string, Integration>, integration: Record<string, unknown>) =>
        collection.set(
          integration.id as Snowflake,
          new Integration(this.client, integration as any, this),
        ),
      new Collection<Snowflake | string, Integration>(),
    );
  }

  public async fetchTemplates(): Promise<Collection<string, GuildTemplate>> {
    const templates = await (this.client.api as any).guilds(this.id).templates.get();
    return (templates as Array<Record<string, unknown>>).reduce(
      (col: Collection<string, GuildTemplate>, data: Record<string, unknown>) =>
        col.set(data.code as string, new GuildTemplate(this.client, data as any)),
      new Collection<string, GuildTemplate>(),
    );
  }

  public async fetchWelcomeScreen(): Promise<WelcomeScreen> {
    const data = await (this.client.api as any).guilds(this.id, 'welcome-screen').get();
    return new WelcomeScreen(this, data as APIWelcomeScreenData);
  }

  public async createTemplate(name: string, description?: string): Promise<GuildTemplate> {
    const data = await (this.client.api as any).guilds(this.id).templates.post({
      data: { name, description },
    });
    return new GuildTemplate(this.client, data);
  }

  public async fetchPreview(): Promise<GuildPreview> {
    const data = await (this.client.api as any).guilds(this.id).preview.get();
    return new GuildPreview(this.client, data);
  }

  public async fetchVanityData(): Promise<Vanity> {
    const data = await (this.client.api as any).guilds(this.id, 'vanity-url').get();
    this.vanityURLCode = data.code;
    this.vanityURLUses = data.uses;
    return data as Vanity;
  }

  public async fetchWebhooks(): Promise<Collection<Snowflake, Webhook>> {
    const apiHooks = await (this.client.api as any).guilds(this.id).webhooks.get();
    const hooks = new Collection<Snowflake, Webhook>();
    for (const hook of apiHooks) {
      hooks.set(hook.id as Snowflake, new Webhook(this.client, hook));
    }
    return hooks;
  }

  public fetchWidget(): Promise<unknown> {
    return (this.client as any).fetchGuildWidget(this.id);
  }

  public async fetchWidgetSettings(): Promise<GuildWidgetSettings> {
    const data = await (this.client.api as any).guilds(this.id).widget.get();
    this.widgetEnabled = data.enabled;
    this.widgetChannelId = data.channel_id;
    return {
      enabled: data.enabled,
      channel: data.channel_id ? (this.channels.cache.get(data.channel_id) as GuildChannel ?? null) : null,
    };
  }

  public async fetchAuditLogs(options: GuildAuditLogsFetchOptions = {}): Promise<GuildAuditLogs> {
    const { before, after, limit, user, type } = options;
    const beforeId = typeof before === 'object' && before !== null ? before.id : before;
    const afterId = typeof after === 'object' && after !== null ? after.id : after;

    const data = await (this.client.api as any).guilds(this.id)['audit-logs'].get({
      query: {
        before: beforeId,
        after: afterId,
        limit,
        user_id: user ? (this.client.users as any).resolveId(user) : undefined,
        action_type:
          typeof type === 'string'
            ? (GuildAuditLogs.Actions as Record<string, number>)[type]
            : type,
      },
    });

    return GuildAuditLogs.build(this, data as RawGuildAuditLogsData);
  }

  public async edit(data: GuildEditData, reason?: string): Promise<Guild> {
    const _data: Record<string, unknown> = {};
    if (data.name) _data.name = data.name;
    if (typeof data.verificationLevel !== 'undefined') {
      _data.verification_level =
        typeof data.verificationLevel === 'number'
          ? data.verificationLevel
          : (VerificationLevels as Record<string, number>)[data.verificationLevel];
    }
    if (typeof data.afkChannel !== 'undefined') {
      _data.afk_channel_id = this.client.channels.resolveId(
        data.afkChannel as Parameters<typeof this.client.channels.resolveId>[0],
      );
    }
    if (typeof data.systemChannel !== 'undefined') {
      _data.system_channel_id = this.client.channels.resolveId(
        data.systemChannel as Parameters<typeof this.client.channels.resolveId>[0],
      );
    }
    if (data.afkTimeout) _data.afk_timeout = Number(data.afkTimeout);
    if (typeof data.icon !== 'undefined') _data.icon = await DataResolver.resolveImage(data.icon);
    if (data.owner) _data.owner_id = (this.client.users as any).resolveId(data.owner);
    if (typeof data.splash !== 'undefined') _data.splash = await DataResolver.resolveImage(data.splash);
    if (typeof data.discoverySplash !== 'undefined') {
      _data.discovery_splash = await DataResolver.resolveImage(data.discoverySplash);
    }
    if (typeof data.banner !== 'undefined') _data.banner = await DataResolver.resolveImage(data.banner);
    if (typeof data.explicitContentFilter !== 'undefined') {
      _data.explicit_content_filter =
        typeof data.explicitContentFilter === 'number'
          ? data.explicitContentFilter
          : (ExplicitContentFilterLevels as Record<string, number>)[data.explicitContentFilter];
    }
    if (typeof data.defaultMessageNotifications !== 'undefined') {
      _data.default_message_notifications =
        typeof data.defaultMessageNotifications === 'number'
          ? data.defaultMessageNotifications
          : (DefaultMessageNotificationLevels as Record<string, number>)[data.defaultMessageNotifications];
    }
    if (typeof data.systemChannelFlags !== 'undefined') {
      _data.system_channel_flags = SystemChannelFlags.resolve(data.systemChannelFlags);
    }
    if (typeof data.rulesChannel !== 'undefined') {
      _data.rules_channel_id = this.client.channels.resolveId(
        data.rulesChannel as Parameters<typeof this.client.channels.resolveId>[0],
      );
    }
    if (typeof data.publicUpdatesChannel !== 'undefined') {
      _data.public_updates_channel_id = this.client.channels.resolveId(
        data.publicUpdatesChannel as Parameters<typeof this.client.channels.resolveId>[0],
      );
    }
    if (typeof data.features !== 'undefined') {
      _data.features = data.features;
    }
    if (typeof data.description !== 'undefined') {
      _data.description = data.description;
    }
    if (typeof data.preferredLocale !== 'undefined') _data.preferred_locale = data.preferredLocale;
    if (typeof data.safetyAlertsChannel !== 'undefined') {
      _data.safety_alerts_channel_id = this.client.channels.resolveId(
        data.safetyAlertsChannel as Parameters<typeof this.client.channels.resolveId>[0],
      );
    }
    if ('premiumProgressBarEnabled' in data) {
      _data.premium_progress_bar_enabled = data.premiumProgressBarEnabled;
    }

    const newData = await (this.client.api as any).guilds(this.id).patch({ data: _data, reason });
    return (this.client.actions as any).GuildUpdate.handle(newData).updated;
  }

  public async editWelcomeScreen(data: WelcomeScreenEditData): Promise<WelcomeScreen> {
    const { enabled, description, welcomeChannels } = data;
    const welcome_channels = welcomeChannels?.map((welcomeChannelData) => {
      const emoji = this.emojis.resolve(welcomeChannelData.emoji as any);
      return {
        emoji_id: emoji?.id,
        emoji_name: emoji?.name ?? (welcomeChannelData.emoji as string),
        channel_id: this.channels.resolveId(welcomeChannelData.channel),
        description: welcomeChannelData.description,
      };
    });

    const patchData = await (this.client.api as any).guilds(this.id, 'welcome-screen').patch({
      data: {
        welcome_channels,
        description,
        enabled,
      },
    });
    return new WelcomeScreen(this, patchData as APIWelcomeScreenData);
  }

  public setExplicitContentFilter(
    explicitContentFilter: ExplicitContentFilterLevel | number | null,
    reason?: string,
  ): Promise<Guild> {
    return this.edit({ explicitContentFilter: explicitContentFilter ?? undefined }, reason);
  }

  public setDefaultMessageNotifications(
    defaultMessageNotifications: DefaultMessageNotificationLevel | number | null,
    reason?: string,
  ): Promise<Guild> {
    return this.edit({ defaultMessageNotifications: defaultMessageNotifications ?? undefined }, reason);
  }

  public setSystemChannelFlags(
    systemChannelFlags: SystemChannelFlagsResolvable,
    reason?: string,
  ): Promise<Guild> {
    return this.edit({ systemChannelFlags }, reason);
  }

  public setName(name: string, reason?: string): Promise<Guild> {
    return this.edit({ name }, reason);
  }

  public setVerificationLevel(
    verificationLevel: string | number | null,
    reason?: string,
  ): Promise<Guild> {
    return this.edit({ verificationLevel: verificationLevel ?? undefined }, reason);
  }

  public setAFKChannel(afkChannel: VoiceChannelResolvable | null, reason?: string): Promise<Guild> {
    return this.edit({ afkChannel }, reason);
  }

  public setSystemChannel(systemChannel: TextChannelResolvable | null, reason?: string): Promise<Guild> {
    return this.edit({ systemChannel }, reason);
  }

  public setAFKTimeout(afkTimeout: number, reason?: string): Promise<Guild> {
    return this.edit({ afkTimeout }, reason);
  }

  public setIcon(icon: Base64Resolvable | null, reason?: string): Promise<Guild> {
    return this.edit({ icon }, reason);
  }

  public setOwner(owner: GuildMemberResolvable, reason?: string): Promise<Guild> {
    return this.edit({ owner }, reason);
  }

  public setSplash(splash: Base64Resolvable | null, reason?: string): Promise<Guild> {
    return this.edit({ splash }, reason);
  }

  public setDiscoverySplash(discoverySplash: Base64Resolvable | null, reason?: string): Promise<Guild> {
    return this.edit({ discoverySplash }, reason);
  }

  public setBanner(banner: Base64Resolvable | null, reason?: string): Promise<Guild> {
    return this.edit({ banner }, reason);
  }

  public setRulesChannel(rulesChannel: TextChannelResolvable | null, reason?: string): Promise<Guild> {
    return this.edit({ rulesChannel }, reason);
  }

  public setPublicUpdatesChannel(
    publicUpdatesChannel: TextChannelResolvable | null,
    reason?: string,
  ): Promise<Guild> {
    return this.edit({ publicUpdatesChannel }, reason);
  }

  public setPreferredLocale(preferredLocale: string | null, reason?: string): Promise<Guild> {
    return this.edit({ preferredLocale: preferredLocale ?? undefined }, reason);
  }

  public setSafetyAlertsChannel(
    safetyAlertsChannel: TextChannelResolvable | null,
    reason?: string,
  ): Promise<Guild> {
    return this.edit({ safetyAlertsChannel }, reason);
  }

  public setPremiumProgressBarEnabled(enabled = true, reason?: string): Promise<Guild> {
    return this.edit({ premiumProgressBarEnabled: enabled }, reason);
  }

  public setChannelPositions(channelPositions: ChannelPosition[]): Promise<Guild> {
    if (!deprecationEmittedForSetChannelPositions) {
      process.emitWarning(
        'The Guild#setChannelPositions method is deprecated. Use GuildChannelManager#setPositions instead.',
        'DeprecationWarning',
      );
      deprecationEmittedForSetChannelPositions = true;
    }
    return this.channels.setPositions(channelPositions);
  }

  public setRolePositions(rolePositions: GuildRolePosition[]): Promise<Guild> {
    if (!deprecationEmittedForSetRolePositions) {
      process.emitWarning(
        'The Guild#setRolePositions method is deprecated. Use RoleManager#setPositions instead.',
        'DeprecationWarning',
      );
      deprecationEmittedForSetRolePositions = true;
    }
    return this.roles.setPositions(rolePositions);
  }

  public async setWidgetSettings(settings: GuildWidgetSettingsData, reason?: string): Promise<this> {
    await (this.client.api as any).guilds(this.id).widget.patch({
      data: {
        enabled: settings.enabled,
        channel_id: settings.channel ? this.channels.resolveId(settings.channel) : null,
      },
      reason,
    });
    return this;
  }

  public disableInvites(disabled = true): Promise<Guild> {
    const features = this.features.filter((feature) => feature !== 'INVITES_DISABLED');
    if (disabled) features.push('INVITES_DISABLED');
    return this.edit({ features });
  }

  public setIncidentActions(incidentActions: IncidentActionsEditOptions): Promise<IncidentActions> {
    return this.client.guilds.setIncidentActions(this.id, incidentActions);
  }

  public async leave(): Promise<Guild> {
    if (this.ownerId === (this.client.user as any).id) throw new Error('GUILD_OWNED');
    await (this.client.api as any).users('@me').guilds(this.id).delete();
    return (this.client.actions as any).GuildDelete.handle({ id: this.id }).guild;
  }

  public async delete(): Promise<Guild> {
    await (this.client.api as any).guilds(this.id).delete();
    return (this.client.actions as any).GuildDelete.handle({ id: this.id }).guild;
  }

  public equals(guild: Guild): boolean {
    return (
      Boolean(guild) &&
      guild instanceof (this.constructor as typeof Guild) &&
      this.id === guild.id &&
      this.available === guild.available &&
      this.splash === guild.splash &&
      this.discoverySplash === guild.discoverySplash &&
      this.name === guild.name &&
      this.memberCount === guild.memberCount &&
      this.large === guild.large &&
      this.icon === guild.icon &&
      this.ownerId === guild.ownerId &&
      this.verificationLevel === guild.verificationLevel &&
      (this.features === guild.features ||
        (this.features.length === guild.features.length &&
          this.features.every((feat, i) => feat === guild.features[i])))
    );
  }

  public override toJSON(): Record<string, unknown> {
    const json = super.toJSON({
      available: false,
      createdTimestamp: true,
      nameAcronym: true,
      presences: false,
      voiceStates: false,
    }) as Record<string, unknown>;
    json.iconURL = this.iconURL();
    json.splashURL = this.splashURL();
    json.discoverySplashURL = this.discoverySplashURL();
    json.bannerURL = this.bannerURL();
    return json;
  }

  public markAsRead(): Promise<void> {
    return (this.client.api as unknown as { guilds(id: string): { ack: { post(): Promise<void> } } }).guilds(this.id).ack.post();
  }

  public async setCommunity(
    stats = true,
    publicUpdatesChannel?: GuildTextChannelResolvable,
    rulesChannel?: GuildTextChannelResolvable,
    reason?: string,
  ): Promise<Guild> {
    if (stats) {
      const everyoneRole = this.roles.everyone;
      if (everyoneRole?.mentionable) {
        await everyoneRole.setMentionable(false, reason);
      }
      return this.edit(
        {
          defaultMessageNotifications: 'ONLY_MENTIONS',
          explicitContentFilter: 'ALL_MEMBERS',
          features: [...this.features, 'COMMUNITY'],
          publicUpdatesChannel: (publicUpdatesChannel ? this.channels.resolveId(publicUpdatesChannel) : null) || '1',
          rulesChannel: (rulesChannel ? this.channels.resolveId(rulesChannel) : null) || '1',
          verificationLevel:
            (VerificationLevels as Record<string, number>)[this.verificationLevel] < 1
              ? 'LOW'
              : this.verificationLevel,
        },
        reason,
      );
    }
    return this.edit(
      {
        publicUpdatesChannel: null,
        rulesChannel: null,
        features: this.features.filter((f) => f !== 'COMMUNITY'),
        preferredLocale: this.preferredLocale,
        description: this.description,
      },
      reason,
    );
  }

  public topEmojis(): Promise<Collection<number, GuildEmoji>> {
    return new Promise((resolve, reject) => {
      (this.client.api as any)
        .guilds(this.id)['top-emojis']
        .get()
        .then((data: { items: Array<{ emoji_rank: number; emoji_id: Snowflake }> }) => {
          const emojis = new Collection<number, GuildEmoji>();
          for (const emoji of data.items) {
            const cached = this.emojis.cache.get(emoji.emoji_id);
            if (cached) emojis.set(emoji.emoji_rank, cached);
          }
          resolve(emojis);
        })
        .catch(reject);
    });
  }

  public async setVanityCode(code = ''): Promise<Vanity> {
    if (typeof code !== 'string') throw new TypeError('INVALID_VANITY_URL_CODE');
    const data = await (this.client.api as any).guilds(this.id, 'vanity-url').patch({
      data: { code },
    });
    this.vanityURLCode = data.code;
    this.vanityURLUses = data.uses;
    return data as Vanity;
  }

  public get voiceAdapterCreator(): (methods: unknown) => {
    sendPayload: (data: unknown) => boolean;
    destroy: () => void;
  } {
    return (methods: unknown) => {
      (this.client as any).voice.adapters.set(this.id, methods);
      return {
        sendPayload: (data: unknown): boolean => {
          if (this.shard?.status !== Status.READY) return false;
          (this.shard as any).send(data);
          return true;
        },
        destroy: (): void => {
          (this.client as any).voice.adapters.delete(this.id);
        },
      };
    };
  }

  public _sortedRoles(): Collection<Snowflake, Role> {
    return Util.discordSort(this.roles.cache);
  }

  public _sortedChannels(channel: GuildChannel): Collection<Snowflake, GuildChannel> {
    const category = channel.type === 'GUILD_CATEGORY';
    return Util.discordSort(
      this.channels.cache.filter(
        (c) =>
          (['GUILD_TEXT', 'GUILD_NEWS', 'GUILD_STORE'].includes(channel.type)
            ? ['GUILD_TEXT', 'GUILD_NEWS', 'GUILD_STORE'].includes(c.type)
            : c.type === channel.type) &&
          (category || (c as unknown as { parent: unknown }).parent === channel.parent),
      ) as Collection<Snowflake, GuildChannel>,
    );
  }
}

export default Guild;
