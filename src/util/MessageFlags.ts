import { BitField } from './BitField.js';
import type { BitFieldResolvable } from '../types/index.js';

export type MessageFlagsString =
  | 'CROSSPOSTED'
  | 'IS_CROSSPOST'
  | 'SUPPRESS_EMBEDS'
  | 'SOURCE_MESSAGE_DELETED'
  | 'URGENT'
  | 'HAS_THREAD'
  | 'EPHEMERAL'
  | 'LOADING'
  | 'FAILED_TO_MENTION_SOME_ROLES_IN_THREAD'
  | 'GUILD_FEED_HIDDEN'
  | 'SHOULD_SHOW_LINK_NOT_DISCORD_WARNING'
  | 'SUPPRESS_NOTIFICATIONS'
  | 'IS_VOICE_MESSAGE'
  | 'HAS_SNAPSHOT'
  | 'IS_COMPONENTS_V2';

export type MessageFlagsResolvable = BitFieldResolvable<MessageFlagsString, number>;

export class MessageFlags extends BitField<MessageFlagsString, number> {
  public static override FLAGS: Record<MessageFlagsString, number> = {
    CROSSPOSTED: 1 << 0,
    IS_CROSSPOST: 1 << 1,
    SUPPRESS_EMBEDS: 1 << 2,
    SOURCE_MESSAGE_DELETED: 1 << 3,
    URGENT: 1 << 4,
    HAS_THREAD: 1 << 5,
    EPHEMERAL: 1 << 6,
    LOADING: 1 << 7,
    FAILED_TO_MENTION_SOME_ROLES_IN_THREAD: 1 << 8,
    GUILD_FEED_HIDDEN: 1 << 9,
    SHOULD_SHOW_LINK_NOT_DISCORD_WARNING: 1 << 10,
    SUPPRESS_NOTIFICATIONS: 1 << 12,
    IS_VOICE_MESSAGE: 1 << 13,
    HAS_SNAPSHOT: 1 << 14,
    IS_COMPONENTS_V2: 1 << 15,
  };

  public static override defaultBit = 0;
}

export default MessageFlags;
