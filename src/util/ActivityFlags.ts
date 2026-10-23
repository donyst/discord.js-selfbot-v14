import { BitField } from './BitField.js';
import type { BitFieldResolvable } from '../types/index.js';

export type ActivityFlagsString =
  | 'INSTANCE'
  | 'JOIN'
  | 'SPECTATE'
  | 'JOIN_REQUEST'
  | 'SYNC'
  | 'PLAY'
  | 'PARTY_PRIVACY_FRIENDS'
  | 'PARTY_PRIVACY_VOICE_CHANNEL'
  | 'EMBEDDED';

export type ActivityFlagsResolvable = BitFieldResolvable<ActivityFlagsString, number>;

/**
 * Data structure that makes it easy to interact with an Activity#flags bitfield.
 */
export class ActivityFlags extends BitField<ActivityFlagsString, number> {
  public static override FLAGS: Record<ActivityFlagsString, number> = {
    INSTANCE: 1 << 0,
    JOIN: 1 << 1,
    SPECTATE: 1 << 2,
    JOIN_REQUEST: 1 << 3,
    SYNC: 1 << 4,
    PLAY: 1 << 5,
    PARTY_PRIVACY_FRIENDS: 1 << 6,
    PARTY_PRIVACY_VOICE_CHANNEL: 1 << 7,
    EMBEDDED: 1 << 8,
  };

  public static override defaultBit = 0;
}

export default ActivityFlags;
