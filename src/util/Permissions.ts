import { PermissionFlagsBits } from 'discord-api-types/v10';
import { BitField } from './BitField.js';
import type { BitFieldResolvable } from '../types/index.js';

export { PermissionFlagsBits };

export type PermissionString =
  | keyof typeof PermissionFlagsBits
  | 'CREATE_INSTANT_INVITE'
  | 'KICK_MEMBERS'
  | 'BAN_MEMBERS'
  | 'ADMINISTRATOR'
  | 'MANAGE_CHANNELS'
  | 'MANAGE_GUILD'
  | 'ADD_REACTIONS'
  | 'VIEW_AUDIT_LOG'
  | 'PRIORITY_SPEAKER'
  | 'STREAM'
  | 'VIEW_CHANNEL'
  | 'SEND_MESSAGES'
  | 'SEND_TTS_MESSAGES'
  | 'MANAGE_MESSAGES'
  | 'EMBED_LINKS'
  | 'ATTACH_FILES'
  | 'READ_MESSAGE_HISTORY'
  | 'MENTION_EVERYONE'
  | 'USE_EXTERNAL_EMOJIS'
  | 'VIEW_GUILD_INSIGHTS'
  | 'CONNECT'
  | 'SPEAK'
  | 'MUTE_MEMBERS'
  | 'DEAFEN_MEMBERS'
  | 'MOVE_MEMBERS'
  | 'USE_VAD'
  | 'CHANGE_NICKNAME'
  | 'MANAGE_NICKNAMES'
  | 'MANAGE_ROLES'
  | 'MANAGE_WEBHOOKS'
  | 'MANAGE_EMOJIS_AND_STICKERS'
  | 'MANAGE_GUILD_EXPRESSIONS'
  | 'USE_APPLICATION_COMMANDS'
  | 'REQUEST_TO_SPEAK'
  | 'MANAGE_EVENTS'
  | 'MANAGE_THREADS'
  | 'USE_PUBLIC_THREADS'
  | 'CREATE_PUBLIC_THREADS'
  | 'USE_PRIVATE_THREADS'
  | 'CREATE_PRIVATE_THREADS'
  | 'USE_EXTERNAL_STICKERS'
  | 'SEND_MESSAGES_IN_THREADS'
  | 'START_EMBEDDED_ACTIVITIES'
  | 'USE_EMBEDDED_ACTIVITIES'
  | 'MODERATE_MEMBERS'
  | 'VIEW_CREATOR_MONETIZATION_ANALYTICS'
  | 'USE_SOUNDBOARD'
  | 'CREATE_GUILD_EXPRESSIONS'
  | 'CREATE_EVENTS'
  | 'USE_EXTERNAL_SOUNDS'
  | 'SEND_VOICE_MESSAGES'
  | 'USE_CLYDE_AI'
  | 'SET_VOICE_CHANNEL_STATUS'
  | 'SEND_POLLS'
  | 'USE_EXTERNAL_APPS';

export type PermissionResolvable = BitFieldResolvable<PermissionString, bigint>;

const LEGACY_FLAGS: Record<string, bigint> = {
  CREATE_INSTANT_INVITE: 1n << 0n,
  KICK_MEMBERS: 1n << 1n,
  BAN_MEMBERS: 1n << 2n,
  ADMINISTRATOR: 1n << 3n,
  MANAGE_CHANNELS: 1n << 4n,
  MANAGE_GUILD: 1n << 5n,
  ADD_REACTIONS: 1n << 6n,
  VIEW_AUDIT_LOG: 1n << 7n,
  PRIORITY_SPEAKER: 1n << 8n,
  STREAM: 1n << 9n,
  VIEW_CHANNEL: 1n << 10n,
  SEND_MESSAGES: 1n << 11n,
  SEND_TTS_MESSAGES: 1n << 12n,
  MANAGE_MESSAGES: 1n << 13n,
  EMBED_LINKS: 1n << 14n,
  ATTACH_FILES: 1n << 15n,
  READ_MESSAGE_HISTORY: 1n << 16n,
  MENTION_EVERYONE: 1n << 17n,
  USE_EXTERNAL_EMOJIS: 1n << 18n,
  VIEW_GUILD_INSIGHTS: 1n << 19n,
  CONNECT: 1n << 20n,
  SPEAK: 1n << 21n,
  MUTE_MEMBERS: 1n << 22n,
  DEAFEN_MEMBERS: 1n << 23n,
  MOVE_MEMBERS: 1n << 24n,
  USE_VAD: 1n << 25n,
  CHANGE_NICKNAME: 1n << 26n,
  MANAGE_NICKNAMES: 1n << 27n,
  MANAGE_ROLES: 1n << 28n,
  MANAGE_WEBHOOKS: 1n << 29n,
  MANAGE_EMOJIS_AND_STICKERS: 1n << 30n,
  USE_APPLICATION_COMMANDS: 1n << 31n,
  REQUEST_TO_SPEAK: 1n << 32n,
  MANAGE_EVENTS: 1n << 33n,
  MANAGE_THREADS: 1n << 34n,
  USE_PUBLIC_THREADS: 1n << 35n,
  CREATE_PUBLIC_THREADS: 1n << 35n,
  USE_PRIVATE_THREADS: 1n << 36n,
  CREATE_PRIVATE_THREADS: 1n << 36n,
  USE_EXTERNAL_STICKERS: 1n << 37n,
  SEND_MESSAGES_IN_THREADS: 1n << 38n,
  START_EMBEDDED_ACTIVITIES: 1n << 39n,
  USE_EMBEDDED_ACTIVITIES: 1n << 39n,
  MODERATE_MEMBERS: 1n << 40n,
  VIEW_CREATOR_MONETIZATION_ANALYTICS: 1n << 41n,
  USE_SOUNDBOARD: 1n << 42n,
  CREATE_GUILD_EXPRESSIONS: 1n << 43n,
  MANAGE_GUILD_EXPRESSIONS: 1n << 43n,
  CREATE_EVENTS: 1n << 44n,
  USE_EXTERNAL_SOUNDS: 1n << 45n,
  SEND_VOICE_MESSAGES: 1n << 46n,
  USE_CLYDE_AI: 1n << 47n,
  SET_VOICE_CHANNEL_STATUS: 1n << 48n,
  SEND_POLLS: 1n << 49n,
  USE_EXTERNAL_APPS: 1n << 50n,
};

const COMBINED_FLAGS: Record<string, bigint> = {
  ...PermissionFlagsBits,
  ...LEGACY_FLAGS,
};

/**
 * Data structure that makes it easy to interact with a permission bitfield.
 */
export class PermissionsBitField extends BitField<PermissionString, bigint> {
  public static override Flags: Record<string, bigint> = COMBINED_FLAGS;
  public static override FLAGS: Record<string, bigint> = COMBINED_FLAGS;

  public static override defaultBit = 0n;

  public static readonly All: bigint = Object.values(COMBINED_FLAGS).reduce((all, p) => all | p, 0n);
  public static readonly ALL: bigint = PermissionsBitField.All;

  public static readonly Default: bigint = 104324673n;
  public static readonly DEFAULT: bigint = PermissionsBitField.Default;

  public static readonly StageModerator: bigint =
    (COMBINED_FLAGS.ManageChannels ?? COMBINED_FLAGS.MANAGE_CHANNELS) |
    (COMBINED_FLAGS.MuteMembers ?? COMBINED_FLAGS.MUTE_MEMBERS) |
    (COMBINED_FLAGS.MoveMembers ?? COMBINED_FLAGS.MOVE_MEMBERS);
  public static readonly STAGE_MODERATOR: bigint = PermissionsBitField.StageModerator;

  public override missing(bits: PermissionResolvable, checkAdmin = true): PermissionString[] {
    const adminBit = COMBINED_FLAGS.Administrator ?? COMBINED_FLAGS.ADMINISTRATOR;
    return checkAdmin && this.has(adminBit) ? [] : super.missing(bits);
  }

  public override any(permission: PermissionResolvable, checkAdmin = true): boolean {
    const adminBit = COMBINED_FLAGS.Administrator ?? COMBINED_FLAGS.ADMINISTRATOR;
    return (checkAdmin && super.has(adminBit)) || super.any(permission);
  }

  public override has(permission: PermissionResolvable, checkAdmin = true): boolean {
    const adminBit = COMBINED_FLAGS.Administrator ?? COMBINED_FLAGS.ADMINISTRATOR;
    return (checkAdmin && super.has(adminBit)) || super.has(permission);
  }
}

export { PermissionsBitField as Permissions };
export default PermissionsBitField;
