import { BitField } from './BitField.js';
import type { BitFieldResolvable } from '../types/index.js';

export type RoleFlagsString = 'IN_PROMPT';

export type RoleFlagsResolvable = BitFieldResolvable<RoleFlagsString, number>;

export class RoleFlags extends BitField<RoleFlagsString, number> {
  public static override FLAGS: Record<RoleFlagsString, number> = {
    IN_PROMPT: 1 << 0,
  };

  public static override defaultBit = 0;
}

export default RoleFlags;
