import { BitField } from './BitField.js';
import type { BitFieldResolvable } from '../types/index.js';

export type UserFlagsString =
  | 'DISCORD_EMPLOYEE'
  | 'PARTNERED_SERVER_OWNER'
  | 'HYPESQUAD_EVENTS'
  | 'BUGHUNTER_LEVEL_1'
  | 'MFA_SMS'
  | 'PREMIUM_PROMO_DISMISSED'
  | 'HOUSE_BRAVERY'
  | 'HOUSE_BRILLIANCE'
  | 'HOUSE_BALANCE'
  | 'EARLY_SUPPORTER'
  | 'TEAM_USER'
  | 'INTERNAL_APPLICATION'
  | 'SYSTEM'
  | 'HAS_UNREAD_URGENT_MESSAGES'
  | 'BUGHUNTER_LEVEL_2'
  | 'UNDERAGE_DELETED'
  | 'VERIFIED_BOT'
  | 'EARLY_VERIFIED_BOT_DEVELOPER'
  | 'DISCORD_CERTIFIED_MODERATOR'
  | 'BOT_HTTP_INTERACTIONS'
  | 'SPAMMER'
  | 'DISABLE_PREMIUM'
  | 'ACTIVE_DEVELOPER'
  | 'HIGH_GLOBAL_RATE_LIMIT'
  | 'DELETED'
  | 'DISABLED_SUSPICIOUS_ACTIVITY'
  | 'SELF_DELETED'
  | 'PREMIUM_DISCRIMINATOR'
  | 'USED_DESKTOP_CLIENT'
  | 'USED_WEB_CLIENT'
  | 'USED_MOBILE_CLIENT'
  | 'DISABLED'
  | 'VERIFIED_EMAIL'
  | 'QUARANTINED'
  | 'COLLABORATOR'
  | 'RESTRICTED_COLLABORATOR';

export type UserFlagsResolvable = BitFieldResolvable<UserFlagsString, bigint>;

/**
 * Data structure that makes it easy to interact with a User#flags bitfield.
 */
export class UserFlags extends BitField<UserFlagsString, bigint> {
  public static override FLAGS: Record<UserFlagsString, bigint> = {
    DISCORD_EMPLOYEE: 1n << 0n,
    PARTNERED_SERVER_OWNER: 1n << 1n,
    HYPESQUAD_EVENTS: 1n << 2n,
    BUGHUNTER_LEVEL_1: 1n << 3n,
    MFA_SMS: 1n << 4n,
    PREMIUM_PROMO_DISMISSED: 1n << 5n,
    HOUSE_BRAVERY: 1n << 6n,
    HOUSE_BRILLIANCE: 1n << 7n,
    HOUSE_BALANCE: 1n << 8n,
    EARLY_SUPPORTER: 1n << 9n,
    TEAM_USER: 1n << 10n,
    INTERNAL_APPLICATION: 1n << 11n,
    SYSTEM: 1n << 12n,
    HAS_UNREAD_URGENT_MESSAGES: 1n << 13n,
    BUGHUNTER_LEVEL_2: 1n << 14n,
    UNDERAGE_DELETED: 1n << 15n,
    VERIFIED_BOT: 1n << 16n,
    EARLY_VERIFIED_BOT_DEVELOPER: 1n << 17n,
    DISCORD_CERTIFIED_MODERATOR: 1n << 18n,
    BOT_HTTP_INTERACTIONS: 1n << 19n,
    SPAMMER: 1n << 20n,
    DISABLE_PREMIUM: 1n << 21n,
    ACTIVE_DEVELOPER: 1n << 22n,
    HIGH_GLOBAL_RATE_LIMIT: 1n << 33n,
    DELETED: 1n << 34n,
    DISABLED_SUSPICIOUS_ACTIVITY: 1n << 35n,
    SELF_DELETED: 1n << 36n,
    PREMIUM_DISCRIMINATOR: 1n << 37n,
    USED_DESKTOP_CLIENT: 1n << 38n,
    USED_WEB_CLIENT: 1n << 39n,
    USED_MOBILE_CLIENT: 1n << 40n,
    DISABLED: 1n << 41n,
    VERIFIED_EMAIL: 1n << 43n,
    QUARANTINED: 1n << 44n,
    COLLABORATOR: 1n << 50n,
    RESTRICTED_COLLABORATOR: 1n << 51n,
  };

  public static override defaultBit = 0n;
}

export default UserFlags;
