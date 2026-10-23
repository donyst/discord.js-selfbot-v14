import { Buffer } from 'node:buffer';
import { Transform, type TransformOptions, type TransformCallback } from 'node:stream';

export class PCMInsertSilence extends Transform {
  public sampleRate: number;
  public channels: number;
  public bytesPerFrame: number;
  public lastChunkTime: number;
  public silenceThresholdMs: number;

  public constructor(options?: TransformOptions) {
    super(options);
    this.sampleRate = 48000;
    this.channels = 2;
    this.bytesPerFrame = this.channels * 2;
    this.lastChunkTime = Date.now();
    this.silenceThresholdMs = 50;
  }

  public override _transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback): void {
    const now = Date.now();
    const gap = now - this.lastChunkTime;

    if (gap >= this.silenceThresholdMs) {
      const missingFrames = Math.floor((gap / 1000) * this.sampleRate);
      const silenceBuffer = Buffer.alloc(missingFrames * this.bytesPerFrame, 0);
      this.push(silenceBuffer);
    }

    this.lastChunkTime = now;
    this.push(chunk);
    callback();
  }
}

export default { PCMInsertSilence };
