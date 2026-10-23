import { BitField } from './BitField.js';
import type { BitFieldResolvable } from '../types/index.js';

export type ApplicationFlagsString =
  | 'EMBEDDED_RELEASED'
  | 'MANAGED_EMOJI'
  | 'EMBEDDED_IAP'
  | 'GROUP_DM_CREATE'
  | 'RPC_PRIVATE_BETA'
  | 'APPLICATION_AUTO_MODERATION_RULE_CREATE_BADGE'
  | 'ALLOW_ASSETS'
  | 'ALLOW_ACTIVITY_ACTION_SPECTATE'
  | 'ALLOW_ACTIVITY_ACTION_JOIN_REQUEST'
  | 'RPC_HAS_CONNECTED'
  | 'GATEWAY_PRESENCE'
  | 'GATEWAY_PRESENCE_LIMITED'
  | 'GATEWAY_GUILD_MEMBERS'
  | 'GATEWAY_GUILD_MEMBERS_LIMITED'
  | 'VERIFICATION_PENDING_GUILD_LIMIT'
  | 'EMBEDDED'
  | 'GATEWAY_MESSAGE_CONTENT'
  | 'GATEWAY_MESSAGE_CONTENT_LIMITED'
  | 'EMBEDDED_FIRST_PARTY'
  | 'APPLICATION_COMMAND_BADGE'
  | 'ACTIVE'
  | 'IFRAME_MODAL';

export type ApplicationFlagsResolvable = BitFieldResolvable<ApplicationFlagsString, number>;

export class ApplicationFlags extends BitField<ApplicationFlagsString, number> {
  public static override FLAGS: Record<ApplicationFlagsString, number> = {
    EMBEDDED_RELEASED: 1 << 1,
    MANAGED_EMOJI: 1 << 2,
    EMBEDDED_IAP: 1 << 3,
    GROUP_DM_CREATE: 1 << 4,
    RPC_PRIVATE_BETA: 1 << 5,
    APPLICATION_AUTO_MODERATION_RULE_CREATE_BADGE: 1 << 6,
    ALLOW_ASSETS: 1 << 8,
    ALLOW_ACTIVITY_ACTION_SPECTATE: 1 << 9,
    ALLOW_ACTIVITY_ACTION_JOIN_REQUEST: 1 << 10,
    RPC_HAS_CONNECTED: 1 << 11,
    GATEWAY_PRESENCE: 1 << 12,
    GATEWAY_PRESENCE_LIMITED: 1 << 13,
    GATEWAY_GUILD_MEMBERS: 1 << 14,
    GATEWAY_GUILD_MEMBERS_LIMITED: 1 << 15,
    VERIFICATION_PENDING_GUILD_LIMIT: 1 << 16,
    EMBEDDED: 1 << 17,
    GATEWAY_MESSAGE_CONTENT: 1 << 18,
    GATEWAY_MESSAGE_CONTENT_LIMITED: 1 << 19,
    EMBEDDED_FIRST_PARTY: 1 << 20,
    APPLICATION_COMMAND_BADGE: 1 << 23,
    ACTIVE: 1 << 24,
    IFRAME_MODAL: 1 << 26,
  };

  public static override defaultBit = 0;
}

export default ApplicationFlags;
