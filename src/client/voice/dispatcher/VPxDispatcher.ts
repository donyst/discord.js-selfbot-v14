import { Buffer } from 'node:buffer';
import VideoDispatcher from './VideoDispatcher.js';
import Util from '../../../util/Util.js';
import type { MediaPlayer } from '../player/MediaPlayer.js';
import type { DispatcherStreams } from './BaseDispatcher.js';

export class VP8Dispatcher extends VideoDispatcher {
  public constructor(player: MediaPlayer, highWaterMark = 12, streams: DispatcherStreams = {}, fps = 30) {
    super(player, highWaterMark, streams, fps, Util.getPayloadType('VP8'));
  }

  public makeChunk(buffer: Buffer, isFirstPacket: boolean): Buffer {
    const payloadDescriptorBuf = Buffer.alloc(2);
    payloadDescriptorBuf[0] = 0x80;
    payloadDescriptorBuf[1] = 0x80;
    if (isFirstPacket) {
      payloadDescriptorBuf[0] = (payloadDescriptorBuf[0] ?? 0) | (1 << 4);
    }
    const pictureIdBuf = Buffer.alloc(2);
    pictureIdBuf.writeUIntBE(this.count, 0, 2);
    pictureIdBuf[0] = (pictureIdBuf[0] ?? 0) | 0x80;
    return Buffer.concat([this.createPayloadExtension(), payloadDescriptorBuf, pictureIdBuf, buffer]);
  }

  public _codecCallback(chunk: Buffer): void {
    const chunkSplit = this.partitionMtu(chunk).map((c, i) => this.makeChunk(c, i === 0));
    for (let i = 0; i < chunkSplit.length; i++) {
      this._playChunk(chunkSplit[i]!, i + 1 === chunkSplit.length);
    }
  }
}

export default {
  VP8Dispatcher,
};
