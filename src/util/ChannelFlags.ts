import { BitField } from './BitField.js';
import type { BitFieldResolvable } from '../types/index.js';

export type ChannelFlagsString = 'PINNED' | 'REQUIRE_TAG';

export type ChannelFlagsResolvable = BitFieldResolvable<ChannelFlagsString, number>;

export class ChannelFlags extends BitField<ChannelFlagsString, number> {
  public static override FLAGS: Record<ChannelFlagsString, number> = {
    PINNED: 1 << 1,
    REQUIRE_TAG: 1 << 4,
  };

  public static override defaultBit = 0;
}

export default ChannelFlags;
