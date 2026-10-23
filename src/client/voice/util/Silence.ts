import { Buffer } from 'node:buffer';
import { Readable } from 'node:stream';

export const SILENCE_FRAME = Buffer.from([0xf8, 0xff, 0xfe]);

export class Silence extends Readable {
  public static SILENCE_FRAME = SILENCE_FRAME;

  public override _read(): void {
    this.push(SILENCE_FRAME);
  }
}

export default Silence;
