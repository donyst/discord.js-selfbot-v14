import { BitField } from './BitField.js';
import type { BitFieldResolvable } from '../types/index.js';

export type SystemChannelFlagsString =
  | 'SUPPRESS_JOIN_NOTIFICATIONS'
  | 'SUPPRESS_PREMIUM_SUBSCRIPTIONS'
  | 'SUPPRESS_GUILD_REMINDER_NOTIFICATIONS'
  | 'SUPPRESS_JOIN_NOTIFICATION_REPLIES'
  | 'SUPPRESS_ROLE_SUBSCRIPTION_PURCHASE_NOTIFICATIONS'
  | 'SUPPRESS_ROLE_SUBSCRIPTION_PURCHASE_NOTIFICATION_REPLIES';

export type SystemChannelFlagsResolvable = BitFieldResolvable<SystemChannelFlagsString, number>;

export class SystemChannelFlags extends BitField<SystemChannelFlagsString, number> {
  public static override FLAGS: Record<SystemChannelFlagsString, number> = {
    SUPPRESS_JOIN_NOTIFICATIONS: 1 << 0,
    SUPPRESS_PREMIUM_SUBSCRIPTIONS: 1 << 1,
    SUPPRESS_GUILD_REMINDER_NOTIFICATIONS: 1 << 2,
    SUPPRESS_JOIN_NOTIFICATION_REPLIES: 1 << 3,
    SUPPRESS_ROLE_SUBSCRIPTION_PURCHASE_NOTIFICATIONS: 1 << 4,
    SUPPRESS_ROLE_SUBSCRIPTION_PURCHASE_NOTIFICATION_REPLIES: 1 << 5,
  };

  public static override defaultBit = 0;
}

export default SystemChannelFlags;
