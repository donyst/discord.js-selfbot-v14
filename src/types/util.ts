import type { Snowflake } from './index.js';

export type StringResolvable = string | string[];
export type DateResolvable = Date | number | string;

export type ImageFormat = 'webp' | 'png' | 'jpg' | 'jpeg' | 'gif';

export type ImageSize = 16 | 32 | 64 | 128 | 256 | 512 | 1024 | 2048 | 4096;

export interface ImageURLOptions {
  format?: ImageFormat;
  size?: ImageSize;
  dynamic?: boolean;
}

export type BitFieldResolvable<T extends string, N extends number | bigint> =
  | T
  | N
  | `${bigint}`
  | Readonly<BitFieldLike<T, N>>
  | boolean
  | (T | N | `${bigint}` | Readonly<BitFieldLike<T, N>> | boolean)[];

export interface BitFieldLike<T extends string, N extends number | bigint> {
  bitfield: N;
  has(bit: BitFieldResolvable<T, N>): boolean;
  any(bit: BitFieldResolvable<T, N>): boolean;
  equals(bit: BitFieldResolvable<T, N>): boolean;
  toArray(): T[];
  toJSON(): N extends bigint ? string : number;
  valueOf(): N;
}

export interface DeconstructedSnowflake {
  timestamp: number;
  readonly date: Date;
  workerId: number;
  processId: number;
  increment: number;
  binary: string;
}

export type UserResolvable = import('../managers/UserManager.js').UserResolvable;
export type ChannelResolvable = import('../managers/ChannelManager.js').ChannelResolvable;
export type GuildResolvable = import('../managers/GuildManager.js').GuildResolvable;
export type RoleResolvable = import('../managers/RoleManager.js').RoleResolvable;
export type MessageResolvable = import('../managers/MessageManager.js').MessageResolvable;
export type InviteResolvable = import('../structures/Invite.js').Invite | string;
export type GuildTemplateResolvable = import('../structures/GuildTemplate.js').GuildTemplate | string;
export type TextChannelResolvable = import('../structures/TextChannel.js').TextChannel | Snowflake;
export type GuildChannelResolvable = import('../managers/GuildChannelManager.js').GuildChannelResolvable;
export type GuildTextChannelResolvable = import('../managers/GuildChannelManager.js').GuildTextChannelResolvable;

export type Constructable<T> = abstract new (...args: never[]) => T;

export type TextBasedChannels =
  | import('../structures/TextChannel.js').TextChannel
  | import('../structures/DMChannel.js').DMChannel
  | import('../structures/NewsChannel.js').NewsChannel
  | import('../structures/ThreadChannel.js').ThreadChannel
  | import('../structures/VoiceChannel.js').VoiceChannel
  | import('../structures/StageChannel.js').StageChannel
  | import('../structures/GroupDMChannel.js').GroupDMChannel
  | import('../structures/interfaces/TextBasedChannel.js').TextBasedChannel;

export type TextBasedChannelResolvable = TextBasedChannels | Snowflake;
