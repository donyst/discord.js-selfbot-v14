import { Buffer } from 'node:buffer';
import { Transform, type TransformOptions, type TransformCallback } from 'node:stream';

export interface IvfTransformerOptions extends TransformOptions {
  fullframe?: boolean;
}

export interface IvfHeader {
  signature: string;
  version: number;
  headerLength: number;
  codec: string;
  width: number;
  height: number;
  timeDenominator: number;
  timeNumerator: number;
  frameCount: number;
}

export class IvfTransformer extends Transform {
  public headerSize: number;
  public frameHeaderSize: number;
  public header: IvfHeader | null;
  public buf: Buffer | null;
  public retFullFrame: boolean;

  public constructor(options?: IvfTransformerOptions) {
    super(options);
    this.headerSize = 32;
    this.frameHeaderSize = 12;

    this.header = null;
    this.buf = null;
    this.retFullFrame = options?.fullframe ?? false;
  }

  public _parseHeader(header: Buffer): void {
    this.header = {
      signature: header.subarray(0, 4).toString(),
      version: header.readUIntLE(4, 2),
      headerLength: header.readUIntLE(6, 2),
      codec: header.subarray(8, 12).toString(),
      width: header.readUIntLE(12, 2),
      height: header.readUIntLE(14, 2),
      timeDenominator: header.readUIntLE(16, 4),
      timeNumerator: header.readUIntLE(20, 4),
      frameCount: header.readUIntLE(24, 4),
    };
  }

  public _getFrameSize(buf: Buffer): number {
    return buf.readUIntLE(0, 4);
  }

  public _parseFrame(frame: Buffer): boolean {
    const size = this._getFrameSize(frame);

    if (this.retFullFrame) return this.push(frame.subarray(0, 12 + size));

    const out = {
      size,
      timestamp: frame.readBigUInt64LE(4),
      data: frame.subarray(12, 12 + size),
    };

    return this.push(out.data);
  }

  public _appendChunkToBuf(chunk: Buffer): void {
    if (this.buf) this.buf = Buffer.concat([this.buf, chunk]);
    else this.buf = chunk;
  }

  public _updateBufLen(size: number): void {
    if (this.buf && this.buf.length > size) this.buf = this.buf.subarray(size, this.buf.length);
    else this.buf = null;
  }

  public override _transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback): void {
    this._appendChunkToBuf(chunk);

    if (!this.header) {
      if (this.buf && this.buf.length >= this.headerSize) {
        this._parseHeader(this.buf.subarray(0, this.headerSize));
        this._updateBufLen(this.headerSize);
      } else {
        callback();
        return;
      }
    }

    while (this.buf && this.buf.length >= this.frameHeaderSize) {
      const size = this._getFrameSize(this.buf) + this.frameHeaderSize;

      if (this.buf.length >= size) {
        this._parseFrame(this.buf.subarray(0, size));
        this._updateBufLen(size);
      } else {
        break;
      }
    }

    callback();
  }
}

export default { IvfTransformer };
