import { BitField } from './BitField.js';
import type { BitFieldResolvable } from '../types/index.js';

export type SpeakingString = 'SPEAKING' | 'SOUNDSHARE' | 'PRIORITY_SPEAKING';

export type SpeakingResolvable = BitFieldResolvable<SpeakingString, number>;

export class Speaking extends BitField<SpeakingString, number> {
  public static override FLAGS: Record<SpeakingString, number> = {
    SPEAKING: 1 << 0,
    SOUNDSHARE: 1 << 1,
    PRIORITY_SPEAKING: 1 << 2,
  };

  public static override defaultBit = 0;
}

export default Speaking;
