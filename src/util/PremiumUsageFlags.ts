import { BitField } from './BitField.js';
import type { BitFieldResolvable } from '../types/index.js';

export type PremiumUsageFlagsString = 'PREMIUM_DISCRIMINATOR' | 'ANIMATED_AVATAR' | 'PROFILE_BANNER';

export type PremiumUsageFlagsResolvable = BitFieldResolvable<PremiumUsageFlagsString, number>;

export class PremiumUsageFlags extends BitField<PremiumUsageFlagsString, number> {
  public static override FLAGS: Record<PremiumUsageFlagsString, number> = {
    PREMIUM_DISCRIMINATOR: 1 << 0,
    ANIMATED_AVATAR: 1 << 1,
    PROFILE_BANNER: 1 << 2,
  };

  public static override defaultBit = 0;
}

export default PremiumUsageFlags;
