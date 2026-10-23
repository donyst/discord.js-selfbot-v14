import { Buffer } from 'node:buffer';
import BaseDispatcher, { type DispatcherStreams } from './BaseDispatcher.js';
import type { MediaPlayer } from '../player/MediaPlayer.js';

export abstract class VideoDispatcher extends BaseDispatcher {
  public fps: number;
  public mtu: number;

  public constructor(player: MediaPlayer, highWaterMark = 12, streams: DispatcherStreams = {}, fps = 30, payloadType = 101) {
    super(player, highWaterMark, payloadType, true, streams);
    this.fps = fps;
    this.mtu = 1200;
  }

  public get TIMESTAMP_INC(): number {
    return 90000 / this.fps;
  }

  public get FRAME_LENGTH(): number {
    return 1000 / this.fps;
  }

  public getTypeDispatcher(): string {
    return 'video';
  }

  public partitionMtu(data: Buffer): Buffer[] {
    const out: Buffer[] = [];
    const dataLength = data.length;

    for (let i = 0; i < dataLength; i += this.mtu) {
      out.push(data.subarray(i, i + this.mtu));
    }

    return out;
  }

  public setFPSSource(value: number): void {
    this.fps = value;
  }

  public abstract override _codecCallback(frame: Buffer): void;
}

export default VideoDispatcher;
