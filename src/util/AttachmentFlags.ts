import { BitField } from './BitField.js';
import type { BitFieldResolvable } from '../types/index.js';

export type AttachmentFlagsString = 'IS_REMIX';

export type AttachmentFlagsResolvable = BitFieldResolvable<AttachmentFlagsString, number>;

export class AttachmentFlags extends BitField<AttachmentFlagsString, number> {
  public static override FLAGS: Record<AttachmentFlagsString, number> = {
    IS_REMIX: 1 << 2,
  };

  public static override defaultBit = 0;
}

export default AttachmentFlags;
