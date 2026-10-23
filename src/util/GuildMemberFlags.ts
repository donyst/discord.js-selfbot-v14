import { BitField } from './BitField.js';
import type { BitFieldResolvable } from '../types/index.js';

export type GuildMemberFlagsString =
  | 'DID_REJOIN'
  | 'COMPLETED_ONBOARDING'
  | 'BYPASSES_VERIFICATION'
  | 'STARTED_ONBOARDING';

export type GuildMemberFlagsResolvable = BitFieldResolvable<GuildMemberFlagsString, number>;

export class GuildMemberFlags extends BitField<GuildMemberFlagsString, number> {
  public static override FLAGS: Record<GuildMemberFlagsString, number> = {
    DID_REJOIN: 1 << 0,
    COMPLETED_ONBOARDING: 1 << 1,
    BYPASSES_VERIFICATION: 1 << 2,
    STARTED_ONBOARDING: 1 << 3,
  };

  public static override defaultBit = 0;
}

export default GuildMemberFlags;
