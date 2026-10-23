import { BitField } from './BitField.js';
import type { BitFieldResolvable } from '../types/index.js';

export type InviteFlagsString =
  | 'GUEST'
  | 'IS_GUEST_INVITE'
  | 'IS_VIEWED'
  | 'IS_ENHANCED'
  | 'IS_APPLICATION_BYPASS';

export type InviteFlagsResolvable = BitFieldResolvable<InviteFlagsString, number>;

export class InviteFlags extends BitField<InviteFlagsString, number> {
  public static override FLAGS: Record<InviteFlagsString, number> = {
    GUEST: 1 << 0,
    IS_GUEST_INVITE: 1 << 0,
    IS_VIEWED: 1 << 1,
    IS_ENHANCED: 1 << 2,
    IS_APPLICATION_BYPASS: 1 << 3,
  };

  public static override defaultBit = 0;
}

export default InviteFlags;
