import { BitField } from './BitField.js';
import type { BitFieldResolvable } from '../types/index.js';

export type PurchasedFlagsString = 'NITRO_CLASSIC' | 'NITRO' | 'GUILD_BOOST' | 'NITRO_BASIC';

export type PurchasedFlagsResolvable = BitFieldResolvable<PurchasedFlagsString, number>;

export class PurchasedFlags extends BitField<PurchasedFlagsString, number> {
  public static override FLAGS: Record<PurchasedFlagsString, number> = {
    NITRO_CLASSIC: 1 << 0,
    NITRO: 1 << 1,
    GUILD_BOOST: 1 << 2,
    NITRO_BASIC: 1 << 3,
  };

  public static override defaultBit = 0;
}

export default PurchasedFlags;
