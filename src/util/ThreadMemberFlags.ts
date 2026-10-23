import { BitField } from './BitField.js';
import type { BitFieldResolvable } from '../types/index.js';

export type ThreadMemberFlagsString = string;

export type ThreadMemberFlagsResolvable = BitFieldResolvable<ThreadMemberFlagsString, number>;

export class ThreadMemberFlags extends BitField<ThreadMemberFlagsString, number> {
  public static override FLAGS: Record<string, number> = {};
  public static override defaultBit = 0;
}

export default ThreadMemberFlags;
