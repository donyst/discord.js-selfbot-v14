/**
 * Core TypeScript Type Definitions for discord.js-selfbot-v13
 * Strict Type System - Zero 'any' Policy
 */

export type Snowflake = `${bigint}` | string;

export type Awaitable<T> = T | PromiseLike<T>;

export interface BaseFetchOptions {
  cache?: boolean;
  force?: boolean;
}

export interface RecursiveArray<T> extends Array<T | RecursiveArray<T>> {}

export type BufferResolvable =
  | string
  | Buffer
  | ArrayBuffer
  | Uint8Array
  | Uint8ClampedArray
  | Int8Array
  | Uint16Array
  | Int16Array
  | Uint32Array
  | Int32Array
  | Float32Array
  | Float64Array;

export type JSONEncodable<T> = {
  toJSON(): T;
};

/**
 * Super Properties representation sent in 'X-Super-Properties' header & Gateway IDENTIFY
 */
export interface SuperProperties {
  os: 'Windows' | 'Mac OS X' | 'Linux' | 'iOS' | 'Android' | string;
  browser: 'Discord Client' | 'Chrome' | 'Edge' | 'Firefox' | 'Safari' | string;
  device?: string;
  device_model_name?: string;
  system_locale: string;
  browser_user_agent: string;
  browser_version: string;
  os_version: string;
  os_arch?: string;
  app_arch?: string;
  os_sdk_version?: string;
  client_version?: string;
  release_channel: 'stable' | 'ptb' | 'canary' | 'development' | string;
  client_build_number: number;
  native_build_number?: number;
  client_event_source: string | null;
  client_launch_id?: string;
  launch_signature?: string;
  client_app_state?: 'focused' | 'unfocused';
  has_client_mods?: boolean;
  client_heartbeat_session_id?: string;
  [key: string]: unknown;
}

/**
 * Discord Gateway Opcodes
 */
export enum GatewayOpcode {
  DISPATCH = 0,
  HEARTBEAT = 1,
  IDENTIFY = 2,
  PRESENCE_UPDATE = 3,
  VOICE_STATE_UPDATE = 4,
  RESUME = 6,
  RECONNECT = 7,
  REQUEST_GUILD_MEMBERS = 8,
  INVALID_SESSION = 9,
  HELLO = 10,
  HEARTBEAT_ACK = 11,
  LAZY_REQUEST = 37,
}

/**
 * Gateway Close Event Codes
 */
export enum GatewayCloseCode {
  UNKNOWN_ERROR = 4000,
  UNKNOWN_OPCODE = 4001,
  DECODE_ERROR = 4002,
  NOT_AUTHENTICATED = 4003,
  AUTHENTICATION_FAILED = 4004,
  ALREADY_AUTHENTICATED = 4005,
  INVALID_SEQ = 4007,
  RATE_LIMITED = 4008,
  SESSION_TIMED_OUT = 4009,
  INVALID_SHARD = 4010,
  SHARDING_REQUIRED = 4011,
  INVALID_API_VERSION = 4012,
  INVALID_INTENTS = 4013,
  DISALLOWED_INTENTS = 4014,
}

/**
 * Activity Types
 */
export enum ActivityType {
  PLAYING = 0,
  STREAMING = 1,
  LISTENING = 2,
  WATCHING = 3,
  CUSTOM = 4,
  COMPETING = 5,
  HANG = 6,
}

/**
 * Client Statuses
 */
export type PresenceStatus = 'online' | 'idle' | 'dnd' | 'invisible' | 'offline';

/**
 * User Relationships
 */
export enum RelationshipType {
  NONE = 0,
  FRIEND = 1,
  BLOCKED = 2,
  INCOMING_REQUEST = 3,
  OUTGOING_REQUEST = 4,
  IMPLICIT = 5,
}

export type { EmojiIdentifierResolvable } from '../util/Util.js';

export type GuildVoiceChannelResolvable =
  | import('../structures/VoiceChannel.js').VoiceChannel
  | import('../structures/StageChannel.js').StageChannel
  | Snowflake;

export * from './util.js';



