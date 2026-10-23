import { DiscordjsError, DiscordjsTypeError, DiscordjsRangeError } from '../errors/index.js';

/**
 * Cleanup symbol used for sweeping and caches
 */
export const _cleanupSymbol = Symbol('djsCleanup');

/**
 * Max bulk deletable message age (14 days in milliseconds)
 */
export const MaxBulkDeletableMessageAge = 1_209_600_000;

/**
 * User agent string representing Discord Desktop
 */
export const UserAgent =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) discord/1.0.9265 Chrome/134.0.6998.205 Electron/35.3.0 Safari/537.36';

/**
 * Chrome TLS ciphers for client impersonation
 */
export const ciphers: readonly string[] = [
  'TLS_AES_128_GCM_SHA256',
  'TLS_AES_256_GCM_SHA384',
  'TLS_CHACHA20_POLY1305_SHA256',
  'ECDHE-ECDSA-AES128-GCM-SHA256',
  'ECDHE-RSA-AES128-GCM-SHA256',
  'ECDHE-ECDSA-AES256-GCM-SHA384',
  'ECDHE-RSA-AES256-GCM-SHA384',
  'ECDHE-ECDSA-CHACHA20-POLY1305',
  'ECDHE-RSA-CHACHA20-POLY1305',
  'ECDHE-RSA-AES128-SHA',
  'ECDHE-RSA-AES256-SHA',
  'AES128-GCM-SHA256',
  'AES256-GCM-SHA384',
  'AES128-SHA',
  'AES256-SHA',
] as const;

/**
 * WebSocket error codes
 */
export const WSCodes: Record<number, string> = {
  1000: 'WS_CLOSE_REQUESTED',
  1011: 'INTERNAL_ERROR',
  4004: 'TOKEN_INVALID',
  4010: 'SHARDING_INVALID',
  4011: 'SHARDING_REQUIRED',
  4013: 'INVALID_INTENTS',
  4014: 'DISALLOWED_INTENTS',
};

export const AllowedImageFormats = ['webp', 'png', 'jpg', 'jpeg', 'gif'] as const;
export type AllowedImageFormat = (typeof AllowedImageFormats)[number];

export const AllowedImageSizes = [16, 32, 56, 64, 96, 128, 256, 300, 512, 600, 1024, 2048, 4096] as const;
export type AllowedImageSize = (typeof AllowedImageSizes)[number];

export interface ImageURLOptions {
  format?: AllowedImageFormat | string;
  size?: AllowedImageSize | number;
  dynamic?: boolean;
}

export function makeImageUrl(root: string, { format = 'webp', size }: ImageURLOptions = {}): string {
  if (size !== undefined && typeof size !== 'number') {
    throw new DiscordjsTypeError('INVALID_TYPE', 'size', 'number');
  }
  if (format && !AllowedImageFormats.includes(format as AllowedImageFormat)) {
    throw new DiscordjsError('IMAGE_FORMAT', format);
  }
  if (size && !AllowedImageSizes.includes(size as AllowedImageSize)) {
    throw new DiscordjsRangeError('IMAGE_SIZE', size);
  }
  return `${root}.${format}${size ? `?size=${size}` : ''}`;
}

/**
 * API & CDN Endpoints
 */
export const Endpoints = {
  CDN(root: string) {
    return {
      Emoji: (emojiId: string, format = 'webp') => `${root}/emojis/${emojiId}.${format}`,
      Asset: (name: string) => `${root}/assets/${name}`,
      DefaultAvatar: (index: number | string) => `${root}/embed/avatars/${index}.png`,
      Avatar: (userId: string, hash: string, format?: string, size?: number, dynamic = false) => {
        if (dynamic && hash.startsWith('a_')) format = 'gif';
        return makeImageUrl(`${root}/avatars/${userId}/${hash}`, { format, size });
      },
      AvatarDecoration: (hash: string) => makeImageUrl(`${root}/avatar-decoration-presets/${hash}`, { format: 'png' }),
      GuildTagBadge: (guildId: string, hash: string) => `${root}/guild-tag-badges/${guildId}/${hash}.png`,
      GuildMemberAvatar: (
        guildId: string,
        memberId: string,
        hash: string,
        format = 'webp',
        size?: number,
        dynamic = false,
      ) => {
        if (dynamic && hash.startsWith('a_')) format = 'gif';
        return makeImageUrl(`${root}/guilds/${guildId}/users/${memberId}/avatars/${hash}`, { format, size });
      },
      GuildMemberBanner: (
        guildId: string,
        memberId: string,
        hash: string,
        format = 'webp',
        size?: number,
        dynamic = false,
      ) => {
        if (dynamic && hash.startsWith('a_')) format = 'gif';
        return makeImageUrl(`${root}/guilds/${guildId}/users/${memberId}/banners/${hash}`, { format, size });
      },
      Banner: (id: string, hash: string, format?: string, size?: number, dynamic = false) => {
        if (dynamic && hash.startsWith('a_')) format = 'gif';
        return makeImageUrl(`${root}/banners/${id}/${hash}`, { format, size });
      },
      Icon: (guildId: string, hash: string, format?: string, size?: number, dynamic = false) => {
        if (dynamic && hash.startsWith('a_')) format = 'gif';
        return makeImageUrl(`${root}/icons/${guildId}/${hash}`, { format, size });
      },
      AppIcon: (appId: string, hash: string, options?: ImageURLOptions) =>
        makeImageUrl(`${root}/app-icons/${appId}/${hash}`, options),
      AppAsset: (appId: string, hash: string, options?: ImageURLOptions) =>
        makeImageUrl(`${root}/app-assets/${appId}/${hash}`, options),
      StickerPackBanner: (bannerId: string, format?: string, size?: number) =>
        makeImageUrl(`${root}/app-assets/710982414301790216/store/${bannerId}`, { size, format }),
      GDMIcon: (channelId: string, hash: string, format?: string, size?: number) =>
        makeImageUrl(`${root}/channel-icons/${channelId}/${hash}`, { size, format }),
      Splash: (guildId: string, hash: string, format?: string, size?: number) =>
        makeImageUrl(`${root}/splashes/${guildId}/${hash}`, { size, format }),
      DiscoverySplash: (guildId: string, hash: string, format?: string, size?: number) =>
        makeImageUrl(`${root}/discovery-splashes/${guildId}/${hash}`, { size, format }),
      TeamIcon: (teamId: string, hash: string, options?: ImageURLOptions) =>
        makeImageUrl(`${root}/team-icons/${teamId}/${hash}`, options),
      Sticker: (stickerId: string, stickerFormat: string) =>
        `${root}/stickers/${stickerId}.${
          stickerFormat === 'LOTTIE' ? 'json' : stickerFormat === 'GIF' ? 'gif' : 'png'
        }`,
      RoleIcon: (roleId: string, hash: string, format = 'webp', size?: number) =>
        makeImageUrl(`${root}/role-icons/${roleId}/${hash}`, { size, format }),
      GuildScheduledEventCover: (scheduledEventId: string, coverHash: string, format?: string, size?: number) =>
        makeImageUrl(`${root}/guild-events/${scheduledEventId}/${coverHash}`, { size, format }),
    };
  },
  invite: (root: string, code: string, eventId?: string) =>
    eventId ? `${root}/${code}?event=${eventId}` : `${root}/${code}`,
  scheduledEvent: (root: string, guildId: string, eventId: string) => `${root}/${guildId}/${eventId}`,
  botGateway: '/gateway',
};

/**
 * Status of the Client
 */
export const Status: Record<string, number> = {
  READY: 0,
  CONNECTING: 1,
  RECONNECTING: 2,
  IDLE: 3,
  NEARLY: 4,
  DISCONNECTED: 5,
  WAITING_FOR_GUILDS: 6,
  IDENTIFYING: 7,
  RESUMING: 8,
};

/**
 * Voice connection status
 */
export const VoiceStatus: Record<string, number> = {
  CONNECTED: 0,
  CONNECTING: 1,
  AUTHENTICATING: 2,
  RECONNECTING: 3,
  DISCONNECTED: 4,
};

/**
 * Gateway Opcodes
 */
export const Opcodes: Record<string, number> = {
  DISPATCH: 0,
  HEARTBEAT: 1,
  IDENTIFY: 2,
  STATUS_UPDATE: 3,
  VOICE_STATE_UPDATE: 4,
  VOICE_GUILD_PING: 5,
  RESUME: 6,
  RECONNECT: 7,
  REQUEST_GUILD_MEMBERS: 8,
  INVALID_SESSION: 9,
  HELLO: 10,
  HEARTBEAT_ACK: 11,
  GUILD_SYNC: 12,
  DM_UPDATE: 13,
  GUILD_SUBSCRIPTIONS: 14,
  LOBBY_CONNECT: 15,
  LOBBY_DISCONNECT: 16,
  LOBBY_VOICE_STATE_UPDATE: 17,
  STREAM_CREATE: 18,
  STREAM_DELETE: 19,
  STREAM_WATCH: 20,
  STREAM_PING: 21,
  STREAM_SET_PAUSED: 22,
  REQUEST_GUILD_APPLICATION_COMMANDS: 24,
  EMBEDDED_ACTIVITY_LAUNCH: 25,
  EMBEDDED_ACTIVITY_CLOSE: 26,
  EMBEDDED_ACTIVITY_UPDATE: 27,
  REQUEST_FORUM_UNREADS: 28,
  REMOTE_COMMAND: 29,
  GET_DELETED_ENTITY_IDS_NOT_MATCHING_HASH: 30,
  REQUEST_SOUNDBOARD_SOUNDS: 31,
  SPEED_TEST_CREATE: 32,
  SPEED_TEST_DELETE: 33,
  REQUEST_LAST_MESSAGES: 34,
  SEARCH_RECENT_MEMBERS: 35,
  REQUEST_CHANNEL_STATUSES: 36,
  GUILD_SUBSCRIPTIONS_BULK: 37,
};

/**
 * Voice Opcodes
 */
export const VoiceOpcodes: Record<string, number> = {
  IDENTIFY: 0,
  SELECT_PROTOCOL: 1,
  READY: 2,
  HEARTBEAT: 3,
  SESSION_DESCRIPTION: 4,
  SPEAKING: 5,
  HEARTBEAT_ACK: 6,
  RESUME: 7,
  HELLO: 8,
  RESUMED: 9,
  SOURCES: 12,
  CLIENT_DISCONNECT: 13,
  SESSION_UPDATE: 14,
  MEDIA_SINK_WANTS: 15,
  VOICE_BACKEND_VERSION: 16,
  CHANNEL_OPTIONS_UPDATE: 17,
};

/**
 * Client Event Names
 */
export const Events = {
  RATE_LIMIT: 'rateLimit',
  INVALID_REQUEST_WARNING: 'invalidRequestWarning',
  API_RESPONSE: 'apiResponse',
  API_REQUEST: 'apiRequest',
  CLIENT_READY: 'ready',
  APPLICATION_COMMAND_CREATE: 'applicationCommandCreate',
  APPLICATION_COMMAND_DELETE: 'applicationCommandDelete',
  APPLICATION_COMMAND_UPDATE: 'applicationCommandUpdate',
  APPLICATION_COMMAND_PERMISSIONS_UPDATE: 'applicationCommandPermissionsUpdate',
  AUTO_MODERATION_ACTION_EXECUTION: 'autoModerationActionExecution',
  AUTO_MODERATION_RULE_CREATE: 'autoModerationRuleCreate',
  AUTO_MODERATION_RULE_DELETE: 'autoModerationRuleDelete',
  AUTO_MODERATION_RULE_UPDATE: 'autoModerationRuleUpdate',
  GUILD_AVAILABLE: 'guildAvailable',
  GUILD_CREATE: 'guildCreate',
  GUILD_DELETE: 'guildDelete',
  GUILD_UPDATE: 'guildUpdate',
  GUILD_UNAVAILABLE: 'guildUnavailable',
  GUILD_MEMBER_ADD: 'guildMemberAdd',
  GUILD_MEMBER_REMOVE: 'guildMemberRemove',
  GUILD_MEMBER_UPDATE: 'guildMemberUpdate',
  GUILD_MEMBER_AVAILABLE: 'guildMemberAvailable',
  GUILD_MEMBER_SPEAKING: 'guildMemberSpeaking',
  GUILD_MEMBERS_CHUNK: 'guildMembersChunk',
  GUILD_INTEGRATIONS_UPDATE: 'guildIntegrationsUpdate',
  GUILD_ROLE_CREATE: 'roleCreate',
  GUILD_ROLE_DELETE: 'roleDelete',
  INVITE_CREATE: 'inviteCreate',
  INVITE_DELETE: 'inviteDelete',
  GUILD_ROLE_UPDATE: 'roleUpdate',
  GUILD_EMOJI_CREATE: 'emojiCreate',
  GUILD_EMOJI_DELETE: 'emojiDelete',
  GUILD_EMOJI_UPDATE: 'emojiUpdate',
  GUILD_BAN_ADD: 'guildBanAdd',
  GUILD_BAN_REMOVE: 'guildBanRemove',
  CHANNEL_CREATE: 'channelCreate',
  CHANNEL_DELETE: 'channelDelete',
  CHANNEL_UPDATE: 'channelUpdate',
  CHANNEL_PINS_UPDATE: 'channelPinsUpdate',
  MESSAGE_CREATE: 'messageCreate',
  MESSAGE_DELETE: 'messageDelete',
  MESSAGE_UPDATE: 'messageUpdate',
  MESSAGE_BULK_DELETE: 'messageDeleteBulk',
  MESSAGE_REACTION_ADD: 'messageReactionAdd',
  MESSAGE_REACTION_REMOVE: 'messageReactionRemove',
  MESSAGE_REACTION_REMOVE_ALL: 'messageReactionRemoveAll',
  MESSAGE_REACTION_REMOVE_EMOJI: 'messageReactionRemoveEmoji',
  THREAD_CREATE: 'threadCreate',
  THREAD_DELETE: 'threadDelete',
  THREAD_UPDATE: 'threadUpdate',
  THREAD_LIST_SYNC: 'threadListSync',
  THREAD_MEMBER_UPDATE: 'threadMemberUpdate',
  THREAD_MEMBERS_UPDATE: 'threadMembersUpdate',
  USER_UPDATE: 'userUpdate',
  PRESENCE_UPDATE: 'presenceUpdate',
  VOICE_SERVER_UPDATE: 'voiceServerUpdate',
  VOICE_STATE_UPDATE: 'voiceStateUpdate',
  TYPING_START: 'typingStart',
  WEBHOOKS_UPDATE: 'webhookUpdate',
  ERROR: 'error',
  WARN: 'warn',
  DEBUG: 'debug',
  CACHE_SWEEP: 'cacheSweep',
  SHARD_DISCONNECT: 'shardDisconnect',
  SHARD_ERROR: 'shardError',
  SHARD_RECONNECTING: 'shardReconnecting',
  SHARD_READY: 'shardReady',
  SHARD_RESUME: 'shardResume',
  INVALIDATED: 'invalidated',
  RAW: 'raw',
  STAGE_INSTANCE_CREATE: 'stageInstanceCreate',
  STAGE_INSTANCE_UPDATE: 'stageInstanceUpdate',
  STAGE_INSTANCE_DELETE: 'stageInstanceDelete',
  GUILD_STICKER_CREATE: 'stickerCreate',
  GUILD_STICKER_DELETE: 'stickerDelete',
  GUILD_STICKER_UPDATE: 'stickerUpdate',
  GUILD_SCHEDULED_EVENT_CREATE: 'guildScheduledEventCreate',
  GUILD_SCHEDULED_EVENT_UPDATE: 'guildScheduledEventUpdate',
  GUILD_SCHEDULED_EVENT_DELETE: 'guildScheduledEventDelete',
  GUILD_SCHEDULED_EVENT_USER_ADD: 'guildScheduledEventUserAdd',
  GUILD_SCHEDULED_EVENT_USER_REMOVE: 'guildScheduledEventUserRemove',
  GUILD_AUDIT_LOG_ENTRY_CREATE: 'guildAuditLogEntryCreate',
  UNHANDLED_PACKET: 'unhandledPacket',
  RELATIONSHIP_ADD: 'relationshipAdd',
  RELATIONSHIP_UPDATE: 'relationshipUpdate',
  RELATIONSHIP_REMOVE: 'relationshipRemove',
  CHANNEL_RECIPIENT_ADD: 'channelRecipientAdd',
  CHANNEL_RECIPIENT_REMOVE: 'channelRecipientRemove',
  INTERACTION_CREATE: 'interactionCreate',
  INTERACTION_MODAL_CREATE: 'interactionModalCreate',
  CALL_CREATE: 'callCreate',
  CALL_UPDATE: 'callUpdate',
  CALL_DELETE: 'callDelete',
  MESSAGE_POLL_VOTE_ADD: 'messagePollVoteAdd',
  MESSAGE_POLL_VOTE_REMOVE: 'messagePollVoteRemove',
  VOICE_CHANNEL_EFFECT_SEND: 'voiceChannelEffectSend',
  VOICE_BROADCAST_SUBSCRIBE: 'subscribe',
  VOICE_BROADCAST_UNSUBSCRIBE: 'unsubscribe',
  QR_CODE: 'qrCode',
  QR_SCAN: 'qrScan',
  QR_CANCEL: 'qrCancel',
} as const;

export type EventKey = (typeof Events)[keyof typeof Events];

/**
 * Shard Events
 */
export const ShardEvents = {
  CLOSE: 'close',
  DESTROYED: 'destroyed',
  INVALID_SESSION: 'invalidSession',
  READY: 'ready',
  RESUMED: 'resumed',
  ALL_READY: 'allReady',
} as const;

export function keyMirror<T extends readonly string[]>(arr: T): { [K in T[number]]: K } {
  const tmp = Object.create(null) as { [K in T[number]]: K };
  for (const value of arr) {
    (tmp as Record<string, string>)[value] = value;
  }
  return tmp;
}

export function createEnum<T extends readonly (string | null)[]>(keys: T): Record<string, string | number> {
  const obj: Record<string, string | number> = {};
  for (let index = 0; index < keys.length; index++) {
    const key = keys[index];
    if (key === null) continue;
    obj[key] = index;
    obj[index] = key;
  }
  return obj;
}

export const PartialTypes = keyMirror([
  'USER',
  'CHANNEL',
  'GUILD_MEMBER',
  'MESSAGE',
  'REACTION',
  'GUILD_SCHEDULED_EVENT',
] as const);

export const WSEvents = keyMirror([
  'READY',
  'RESUMED',
  'APPLICATION_COMMAND_CREATE',
  'APPLICATION_COMMAND_DELETE',
  'APPLICATION_COMMAND_UPDATE',
  'APPLICATION_COMMAND_PERMISSIONS_UPDATE',
  'AUTO_MODERATION_ACTION_EXECUTION',
  'AUTO_MODERATION_RULE_CREATE',
  'AUTO_MODERATION_RULE_DELETE',
  'AUTO_MODERATION_RULE_UPDATE',
  'GUILD_CREATE',
  'GUILD_DELETE',
  'GUILD_UPDATE',
  'INVITE_CREATE',
  'INVITE_DELETE',
  'GUILD_MEMBER_ADD',
  'GUILD_MEMBER_REMOVE',
  'GUILD_MEMBER_UPDATE',
  'GUILD_MEMBERS_CHUNK',
  'GUILD_INTEGRATIONS_UPDATE',
  'GUILD_ROLE_CREATE',
  'GUILD_ROLE_DELETE',
  'GUILD_ROLE_UPDATE',
  'GUILD_BAN_ADD',
  'GUILD_BAN_REMOVE',
  'GUILD_EMOJIS_UPDATE',
  'CHANNEL_CREATE',
  'CHANNEL_DELETE',
  'CHANNEL_UPDATE',
  'CHANNEL_PINS_UPDATE',
  'MESSAGE_CREATE',
  'MESSAGE_DELETE',
  'MESSAGE_UPDATE',
  'MESSAGE_DELETE_BULK',
  'MESSAGE_REACTION_ADD',
  'MESSAGE_REACTION_REMOVE',
  'MESSAGE_REACTION_REMOVE_ALL',
  'MESSAGE_REACTION_REMOVE_EMOJI',
  'THREAD_CREATE',
  'THREAD_UPDATE',
  'THREAD_DELETE',
  'THREAD_LIST_SYNC',
  'THREAD_MEMBER_UPDATE',
  'THREAD_MEMBERS_UPDATE',
  'USER_UPDATE',
  'PRESENCE_UPDATE',
  'TYPING_START',
  'VOICE_STATE_UPDATE',
  'VOICE_SERVER_UPDATE',
  'WEBHOOKS_UPDATE',
  'STAGE_INSTANCE_CREATE',
  'STAGE_INSTANCE_UPDATE',
  'STAGE_INSTANCE_DELETE',
  'GUILD_STICKERS_UPDATE',
  'GUILD_SCHEDULED_EVENT_CREATE',
  'GUILD_SCHEDULED_EVENT_UPDATE',
  'GUILD_SCHEDULED_EVENT_DELETE',
  'GUILD_SCHEDULED_EVENT_USER_ADD',
  'GUILD_SCHEDULED_EVENT_USER_REMOVE',
  'GUILD_AUDIT_LOG_ENTRY_CREATE',
] as const);

export const InviteScopes: readonly string[] = [
  'applications.builds.read',
  'applications.commands',
  'applications.entitlements',
  'applications.store.update',
  'bot',
  'connections',
  'email',
  'identify',
  'guilds',
  'guilds.join',
  'gdm.join',
  'webhook.incoming',
  'role_connections.write',
] as const;

export const IntegrationExpireBehaviors = createEnum(['REMOVE_ROLE', 'KICK'] as const);

export const MessageTypes: readonly (string | null)[] = [
  'DEFAULT', // 0
  'RECIPIENT_ADD',
  'RECIPIENT_REMOVE',
  'CALL',
  'CHANNEL_NAME_CHANGE',
  'CHANNEL_ICON_CHANGE',
  'CHANNEL_PINNED_MESSAGE',
  'GUILD_MEMBER_JOIN',
  'USER_PREMIUM_GUILD_SUBSCRIPTION',
  'USER_PREMIUM_GUILD_SUBSCRIPTION_TIER_1',
  'USER_PREMIUM_GUILD_SUBSCRIPTION_TIER_2',
  'USER_PREMIUM_GUILD_SUBSCRIPTION_TIER_3',
  'CHANNEL_FOLLOW_ADD',
  null, // 13
  'GUILD_DISCOVERY_DISQUALIFIED',
  'GUILD_DISCOVERY_REQUALIFIED',
  'GUILD_DISCOVERY_GRACE_PERIOD_INITIAL_WARNING',
  'GUILD_DISCOVERY_GRACE_PERIOD_FINAL_WARNING',
  'THREAD_CREATED',
  'REPLY',
  'APPLICATION_COMMAND',
  'THREAD_STARTER_MESSAGE',
  'GUILD_INVITE_REMINDER',
  'CONTEXT_MENU_COMMAND',
  'AUTO_MODERATION_ACTION',
  'ROLE_SUBSCRIPTION_PURCHASE',
  'INTERACTION_PREMIUM_UPSELL',
  'STAGE_START',
  'STAGE_END',
  'STAGE_SPEAKER',
  'STAGE_RAISE_HAND',
  'STAGE_TOPIC',
  'GUILD_APPLICATION_PREMIUM_SUBSCRIPTION',
  null, // 33
  null,
  'PREMIUM_REFERRAL',
  'GUILD_INCIDENT_ALERT_MODE_ENABLED',
  'GUILD_INCIDENT_ALERT_MODE_DISABLED',
  'GUILD_INCIDENT_REPORT_RAID',
  'GUILD_INCIDENT_REPORT_FALSE_ALARM',
  'GUILD_DEADCHAT_REVIVE_PROMPT',
  'CUSTOM_GIFT',
  'GUILD_GAMING_STATS_PROMPT',
  null,
  'PURCHASE_NOTIFICATION',
  null,
  'POLL_RESULT',
  'CHANGELOG',
  'NITRO_NOTIFICATION',
] as const;

export type MessageType = NonNullable<(typeof MessageTypes)[number]>;

export const MessageReferenceTypes = createEnum(['DEFAULT', 'FORWARD'] as const);
export type MessageReferenceType = keyof typeof MessageReferenceTypes;

export const SweeperKeys: readonly string[] = [
  'applicationCommands',
  'autoModerationRules',
  'bans',
  'emojis',
  'invites',
  'guildMembers',
  'messages',
  'presences',
  'reactions',
  'stageInstances',
  'stickers',
  'threadMembers',
  'threads',
  'users',
  'voiceStates',
] as const;

export type SweeperKey = (typeof SweeperKeys)[number];

export const SystemMessageTypes = MessageTypes.filter(
  (type): type is string =>
    type !== null && !['DEFAULT', 'REPLY', 'APPLICATION_COMMAND', 'CONTEXT_MENU_COMMAND'].includes(type),
);

export const ActivityTypes = createEnum([
  'PLAYING',
  'STREAMING',
  'LISTENING',
  'WATCHING',
  'CUSTOM',
  'COMPETING',
  'HANG',
] as const);

export const ChannelTypes = createEnum([
  'GUILD_TEXT',
  'DM',
  'GUILD_VOICE',
  'GROUP_DM',
  'GUILD_CATEGORY',
  'GUILD_NEWS',
  'GUILD_STORE',
  null,
  null,
  null,
  'GUILD_NEWS_THREAD',
  'GUILD_PUBLIC_THREAD',
  'GUILD_PRIVATE_THREAD',
  'GUILD_STAGE_VOICE',
  'GUILD_DIRECTORY',
  'GUILD_FORUM',
  'GUILD_MEDIA',
] as const);

export const TextBasedChannelTypes: readonly string[] = [
  'DM',
  'GUILD_TEXT',
  'GUILD_NEWS',
  'GUILD_NEWS_THREAD',
  'GUILD_PUBLIC_THREAD',
  'GUILD_PRIVATE_THREAD',
  'GUILD_VOICE',
  'GUILD_STAGE_VOICE',
] as const;

export const ThreadChannelTypes: readonly string[] = [
  'GUILD_NEWS_THREAD',
  'GUILD_PUBLIC_THREAD',
  'GUILD_PRIVATE_THREAD',
] as const;

export const VoiceBasedChannelTypes: readonly string[] = ['GUILD_VOICE', 'GUILD_STAGE_VOICE'] as const;

export const ClientApplicationAssetTypes: Record<string, number> = {
  SMALL: 1,
  BIG: 2,
};

export const Colors: Record<string, number> = {
  DEFAULT: 0x000000,
  WHITE: 0xffffff,
  AQUA: 0x1abc9c,
  GREEN: 0x57f287,
  BLUE: 0x3498db,
  YELLOW: 0xfee75c,
  PURPLE: 0x9b59b6,
  LUMINOUS_VIVID_PINK: 0xe91e63,
  FUCHSIA: 0xeb459e,
  GOLD: 0xf1c40f,
  ORANGE: 0xe67e22,
  RED: 0xed4245,
  GREY: 0x95a5a6,
  NAVY: 0x34495e,
  DARK_AQUA: 0x11806a,
  DARK_GREEN: 0x1f8b4c,
  DARK_BLUE: 0x206694,
  DARK_PURPLE: 0x71368a,
  DARK_VIVID_PINK: 0xad1457,
  DARK_GOLD: 0xc27c0e,
  DARK_ORANGE: 0xa84300,
  DARK_RED: 0x992d22,
  DARK_GREY: 0x979c9f,
  DARKER_GREY: 0x7f8c8d,
  LIGHT_GREY: 0xbcc0c0,
  DARK_NAVY: 0x2c3e50,
  BLURPLE: 0x5865f2,
  GREYPLE: 0x99aab5,
  DARK_BUT_NOT_BLACK: 0x2c2f33,
  NOT_QUITE_BLACK: 0x23272a,
};

export const HolographicStyles: Record<string, number> = {
  PRIMARY: 11_127_295,
  SECONDARY: 16_759_788,
  TERTIARY: 16_761_760,
};

export const ExplicitContentFilterLevels = createEnum(['DISABLED', 'MEMBERS_WITHOUT_ROLES', 'ALL_MEMBERS'] as const);
export const VerificationLevels = createEnum(['NONE', 'LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH'] as const);

export const APIErrors: Record<string, number> = {
  UNKNOWN_ACCOUNT: 10001,
  UNKNOWN_APPLICATION: 10002,
  UNKNOWN_CHANNEL: 10003,
  UNKNOWN_GUILD: 10004,
  UNKNOWN_INTEGRATION: 10005,
  UNKNOWN_INVITE: 10006,
  UNKNOWN_MEMBER: 10007,
  UNKNOWN_MESSAGE: 10008,
  UNKNOWN_OVERWRITE: 10009,
  UNKNOWN_PROVIDER: 10010,
  UNKNOWN_ROLE: 10011,
  UNKNOWN_TOKEN: 10012,
  UNKNOWN_USER: 10013,
  UNKNOWN_EMOJI: 10014,
  UNKNOWN_WEBHOOK: 10015,
  UNKNOWN_WEBHOOK_SERVICE: 10016,
  UNKNOWN_SESSION: 10020,
  UNKNOWN_BAN: 10026,
  UNKNOWN_SKU: 10027,
  UNKNOWN_STORE_LISTING: 10028,
  UNKNOWN_ENTITLEMENT: 10029,
  UNKNOWN_BUILD: 10030,
  UNKNOWN_LOBBY: 10031,
  UNKNOWN_BRANCH: 10032,
  UNKNOWN_STORE_DIRECTORY_LAYOUT: 10033,
  UNKNOWN_REDISTRIBUTABLE: 10036,
  UNKNOWN_GIFT_CODE: 10038,
  UNKNOWN_STREAM: 10049,
  UNKNOWN_PREMIUM_SERVER_SUBSCRIBE_COOLDOWN: 10050,
  UNKNOWN_GUILD_TEMPLATE: 10057,
  UNKNOWN_DISCOVERABLE_SERVER_CATEGORY: 10059,
  UNKNOWN_STICKER: 10060,
  UNKNOWN_INTERACTION: 10062,
  UNKNOWN_APPLICATION_COMMAND: 10063,
  UNKNOWN_APPLICATION_COMMAND_PERMISSIONS: 10066,
  UNKNOWN_STAGE_INSTANCE: 10067,
  UNKNOWN_GUILD_MEMBER_VERIFICATION_FORM: 10068,
  UNKNOWN_GUILD_WELCOME_SCREEN: 10069,
  UNKNOWN_GUILD_SCHEDULED_EVENT: 10070,
  UNKNOWN_GUILD_SCHEDULED_EVENT_USER: 10071,
  BOT_PROHIBITED_ENDPOINT: 20001,
  BOT_ONLY_ENDPOINT: 20002,
  CANNOT_SEND_EXPLICIT_CONTENT: 20009,
  NOT_AUTHORIZED: 20012,
  SLOWMODE_RATE_LIMIT: 20016,
  ACCOUNT_OWNER_ONLY: 20018,
  ANNOUNCEMENT_EDIT_LIMIT_EXCEEDED: 20022,
  CHANNEL_HIT_WRITE_RATELIMIT: 20028,
  SERVER_HIT_WRITE_RATELIMIT: 20029,
  CONTENT_NOT_ALLOWED: 20031,
  GUILD_PREMIUM_LEVEL_TOO_LOW: 20035,
  MAXIMUM_GUILDS: 30001,
  MAXIMUM_FRIENDS: 30002,
  MAXIMUM_PINS: 30003,
  MAXIMUM_RECIPIENTS: 30004,
  MAXIMUM_ROLES: 30005,
  MAXIMUM_WEBHOOKS: 30007,
  MAXIMUM_EMOJIS: 30008,
  MAXIMUM_REACTIONS: 30010,
  MAXIMUM_CHANNELS: 30013,
  MAXIMUM_ATTACHMENTS: 30015,
  MAXIMUM_INVITES: 30016,
  MAXIMUM_ANIMATED_EMOJIS: 30018,
  MAXIMUM_SERVER_MEMBERS: 30019,
  MAXIMUM_NUMBER_OF_SERVER_CATEGORIES: 30030,
  GUILD_ALREADY_HAS_TEMPLATE: 30031,
  MAXIMUM_THREAD_PARTICIPANTS: 30033,
  MAXIMUM_NON_GUILD_MEMBERS_BANS: 30035,
  MAXIMUM_BAN_FETCHES: 30037,
  MAXIMUM_NUMBER_OF_UNCOMPLETED_GUILD_SCHEDULED_EVENTS_REACHED: 30038,
  MAXIMUM_NUMBER_OF_STICKERS_REACHED: 30039,
  MAXIMUM_PRUNE_REQUESTS: 30040,
  MAXIMUM_GUILD_WIDGET_SETTINGS_UPDATE: 30042,
  MAXIMUM_NUMBER_OF_PREMIUM_EMOJIS: 30056,
  UNAUTHORIZED: 40001,
  ACCOUNT_VERIFICATION_REQUIRED: 40002,
  DIRECT_MESSAGES_TOO_FAST: 40003,
  REQUEST_ENTITY_TOO_LARGE: 40005,
  FEATURE_TEMPORARILY_DISABLED: 40006,
  USER_BANNED: 40007,
  TARGET_USER_NOT_CONNECTED_TO_VOICE: 40032,
  ALREADY_CROSSPOSTED: 40033,
  MISSING_ACCESS: 50001,
  INVALID_ACCOUNT_TYPE: 50002,
  CANNOT_EXECUTE_ON_DM: 50003,
  EMBED_DISABLED: 50004,
  CANNOT_EDIT_MESSAGE_BY_OTHER: 50005,
  CANNOT_SEND_EMPTY_MESSAGE: 50006,
  CANNOT_MESSAGE_USER: 50007,
  CANNOT_SEND_MESSAGES_IN_VOICE_CHANNEL: 50008,
  CHANNEL_VERIFICATION_LEVEL_TOO_HIGH: 50009,
  OAUTH2_APPLICATION_BOT_ABSENT: 50010,
  MAXIMUM_OAUTH2_APPLICATIONS: 50011,
  INVALID_OAUTH_STATE: 50012,
  MISSING_PERMISSIONS: 50013,
  INVALID_AUTHENTICATION_TOKEN: 50014,
  NOTE_TOO_LONG: 50015,
  INVALID_BULK_DELETE_QUANTITY: 50016,
  CANNOT_PIN_MESSAGE_IN_OTHER_CHANNEL: 50019,
  INVALID_OR_TAKEN_INVITE_CODE: 50020,
  CANNOT_EXECUTE_ON_SYSTEM_MESSAGE: 50021,
  CANNOT_EXECUTE_ON_CHANNEL_TYPE: 50024,
  INVALID_OAUTH_TOKEN: 50025,
  MISSING_OAUTH_SCOPE: 50026,
  INVALID_WEBHOOK_TOKEN: 50027,
  INVALID_ROLE: 50028,
  INVALID_RECIPIENTS: 50033,
  BULK_DELETE_MESSAGE_TOO_OLD: 50034,
  INVALID_FORM_BODY: 50035,
  INVITE_ACCEPTED_TO_GUILD_NOT_CONTAINING_BOT: 50036,
  INVALID_API_VERSION: 50041,
  FILE_UPLOADED_EXCEEDS_MAXIMUM_SIZE: 50045,
  INVALID_FILE_UPLOADED: 50046,
  CANNOT_SELF_REDEEM_GIFT: 50054,
  INVALID_GUILD: 50055,
  INVALID_MESSAGE_TYPE: 50068,
  PAYMENT_SOURCE_REQUIRED: 50070,
  CANNOT_DELETE_COMMUNITY_REQUIRED_CHANNEL: 50074,
  INVALID_STICKER_SENT: 50081,
  INVALID_OPERATION_ON_ARCHIVED_THREAD: 50083,
  INVALID_THREAD_NOTIFICATION_SETTINGS: 50084,
  PARAMETER_EARLIER_THAN_CREATION: 50085,
  GUILD_NOT_AVAILABLE_IN_LOCATION: 50095,
  GUILD_MONETIZATION_REQUIRED: 50097,
  INSUFFICIENT_BOOSTS: 50101,
  INVALID_JSON: 50109,
  CANNOT_MIX_SUBSCRIPTION_AND_NON_SUBSCRIPTION_ROLES_FOR_EMOJI: 50144,
  CANNOT_CONVERT_PREMIUM_EMOJI_TO_NORMAL_EMOJI: 50145,
  VOICE_MESSAGES_DO_NOT_SUPPORT_ADDITIONAL_CONTENT: 50159,
  VOICE_MESSAGES_MUST_HAVE_A_SINGLE_AUDIO_ATTACHMENT: 50160,
  VOICE_MESSAGES_MUST_HAVE_SUPPORTING_METADATA: 50161,
  VOICE_MESSAGES_CANNOT_BE_EDITED: 50162,
  YOU_CANNOT_SEND_VOICE_MESSAGES_IN_THIS_CHANNEL: 50173,
  TWO_FACTOR_REQUIRED: 60003,
  NO_USERS_WITH_DISCORDTAG_EXIST: 80004,
  REACTION_BLOCKED: 90001,
  RESOURCE_OVERLOADED: 130000,
  STAGE_ALREADY_OPEN: 150006,
  CANNOT_REPLY_WITHOUT_READ_MESSAGE_HISTORY_PERMISSION: 160002,
  MESSAGE_ALREADY_HAS_THREAD: 160004,
  THREAD_LOCKED: 160005,
  MAXIMUM_ACTIVE_THREADS: 160006,
  MAXIMUM_ACTIVE_ANNOUNCEMENT_THREADS: 160007,
  INVALID_JSON_FOR_UPLOADED_LOTTIE_FILE: 170001,
  UPLOADED_LOTTIES_CANNOT_CONTAIN_RASTERIZED_IMAGES: 170002,
  STICKER_MAXIMUM_FRAMERATE_EXCEEDED: 170003,
  STICKER_FRAME_COUNT_EXCEEDS_MAXIMUM_OF_1000_FRAMES: 170004,
  LOTTIE_ANIMATION_MAXIMUM_DIMENSIONS_EXCEEDED: 170005,
  STICKER_FRAME_RATE_IS_TOO_SMALL_OR_TOO_LARGE: 170006,
  STICKER_ANIMATION_DURATION_EXCEEDS_MAXIMUM_OF_5_SECONDS: 170007,
  CANNOT_UPDATE_A_FINISHED_EVENT: 180000,
  FAILED_TO_CREATE_STAGE_NEEDED_FOR_STAGE_EVENT: 180002,
};

export const DefaultMessageNotificationLevels = createEnum(['ALL_MESSAGES', 'ONLY_MENTIONS'] as const);
export const MembershipStates = createEnum([null, 'INVITED', 'ACCEPTED'] as const);
export const WebhookTypes = createEnum([null, 'Incoming', 'Channel Follower', 'Application'] as const);
export const StickerTypes = createEnum([null, 'STANDARD', 'GUILD'] as const);
export const StickerFormatTypes = createEnum([null, 'PNG', 'APNG', 'LOTTIE', 'GIF'] as const);
export const OverwriteTypes = createEnum(['role', 'member'] as const);

export const ApplicationCommandTypes = createEnum([null, 'CHAT_INPUT', 'USER', 'MESSAGE'] as const);
export type ApplicationCommandType = keyof typeof ApplicationCommandTypes;

export const ApplicationCommandOptionTypes = createEnum([
  null,
  'SUB_COMMAND',
  'SUB_COMMAND_GROUP',
  'STRING',
  'INTEGER',
  'BOOLEAN',
  'USER',
  'CHANNEL',
  'ROLE',
  'MENTIONABLE',
  'NUMBER',
  'ATTACHMENT',
] as const);
export type ApplicationCommandOptionType = keyof typeof ApplicationCommandOptionTypes;

export const ApplicationCommandPermissionTypes = createEnum([null, 'ROLE', 'USER'] as const);
export const ApplicationRoleConnectionMetadataTypes = createEnum([
  null,
  'INTEGER_LESS_THAN_OR_EQUAL',
  'INTEGER_GREATER_THAN_OR_EQUAL',
  'INTEGER_EQUAL',
  'INTEGER_NOT_EQUAL',
  'DATATIME_LESS_THAN_OR_EQUAL',
  'DATATIME_GREATER_THAN_OR_EQUAL',
  'BOOLEAN_EQUAL',
  'BOOLEAN_NOT_EQUAL',
] as const);

export const AutoModerationRuleTriggerTypes = createEnum([
  null,
  'KEYWORD',
  null,
  'SPAM',
  'KEYWORD_PRESET',
  'MENTION_SPAM',
] as const);
export type AutoModerationRuleTriggerType = keyof typeof AutoModerationRuleTriggerTypes;

export const AutoModerationRuleKeywordPresetTypes = createEnum([null, 'PROFANITY', 'SEXUAL_CONTENT', 'SLURS'] as const);
export type AutoModerationRuleKeywordPresetType = keyof typeof AutoModerationRuleKeywordPresetTypes;

export const AutoModerationActionTypes = createEnum([null, 'BLOCK_MESSAGE', 'SEND_ALERT_MESSAGE', 'TIMEOUT'] as const);
export type AutoModerationActionType = keyof typeof AutoModerationActionTypes;

export const AutoModerationRuleEventTypes = createEnum([null, 'MESSAGE_SEND'] as const);
export type AutoModerationRuleEventType = keyof typeof AutoModerationRuleEventTypes;

export const InteractionTypes = createEnum([
  null,
  'PING',
  'APPLICATION_COMMAND',
  'MESSAGE_COMPONENT',
  'APPLICATION_COMMAND_AUTOCOMPLETE',
  'MODAL_SUBMIT',
] as const);
export type InteractionType = keyof typeof InteractionTypes;

export const InteractionResponseTypes = createEnum([
  null,
  'PONG',
  null,
  null,
  'CHANNEL_MESSAGE_WITH_SOURCE',
  'DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE',
  'DEFERRED_MESSAGE_UPDATE',
  'UPDATE_MESSAGE',
  'APPLICATION_COMMAND_AUTOCOMPLETE_RESULT',
  'MODAL',
] as const);

export const MessageComponentTypes = createEnum([
  null,
  'ACTION_ROW',
  'BUTTON',
  'STRING_SELECT',
  'TEXT_INPUT',
  'USER_SELECT',
  'ROLE_SELECT',
  'MENTIONABLE_SELECT',
  'CHANNEL_SELECT',
  'SECTION',
  'TEXT_DISPLAY',
  'THUMBNAIL',
  'MEDIA_GALLERY',
  'FILE',
  'SEPARATOR',
  null,
  null,
  'CONTAINER',
] as const);

export type MessageComponentType = keyof typeof MessageComponentTypes;

export const SelectMenuComponentTypes = createEnum([
  null,
  null,
  null,
  'STRING_MENU',
  null,
  'USER_SELECT',
  'ROLE_SELECT',
  'MENTIONABLE_SELECT',
  'CHANNEL_SELECT',
] as const);

export const MessageButtonStyles = createEnum([null, 'PRIMARY', 'SECONDARY', 'SUCCESS', 'DANGER', 'LINK'] as const);
export const MFALevels = createEnum(['NONE', 'ELEVATED'] as const);
export const NSFWLevels = createEnum(['DEFAULT', 'EXPLICIT', 'SAFE', 'AGE_RESTRICTED'] as const);
export const PrivacyLevels = createEnum([null, 'PUBLIC', 'GUILD_ONLY'] as const);
export const TextInputStyles = createEnum([null, 'SHORT', 'PARAGRAPH'] as const);
export const GuildScheduledEventPrivacyLevels = createEnum([null, null, 'GUILD_ONLY'] as const);
export const PremiumTiers = createEnum(['NONE', 'TIER_1', 'TIER_2', 'TIER_3'] as const);
export const GuildScheduledEventStatuses = createEnum([null, 'SCHEDULED', 'ACTIVE', 'COMPLETED', 'CANCELED'] as const);
export const GuildScheduledEventEntityTypes = createEnum([null, 'STAGE_INSTANCE', 'VOICE', 'EXTERNAL'] as const);
export const VideoQualityModes = createEnum([null, 'AUTO', 'FULL'] as const);
export const ReactionTypes = createEnum(['NORMAL', 'BURST'] as const);
export const SortOrderTypes = createEnum([null, 'LATEST_ACTIVITY', 'CREATION_DATE'] as const);
export const ForumLayoutTypes = createEnum(['NOT_SET', 'LIST_VIEW', 'GALLERY_VIEW'] as const);
export const PollLayoutTypes = createEnum([null, 'DEFAULT', 'IMAGE_ONLY_ANSWERS'] as const);

export const RelationshipTypes = createEnum([
  'NONE',
  'FRIEND',
  'BLOCKED',
  'PENDING_INCOMING',
  'PENDING_OUTGOING',
  'IMPLICIT',
] as const);

export const SeparatorSpacingSizes = createEnum([null, 'SMALL', 'LARGE'] as const);
