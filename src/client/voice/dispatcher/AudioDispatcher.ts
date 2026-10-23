import BaseDispatcher, { type DispatcherStreams } from './BaseDispatcher.js';
import Util from '../../../util/Util.js';
import Silence from '../util/Silence.js';
import VolumeInterface, { type IVolumeInterface } from '../util/VolumeInterface.js';
import type { MediaPlayer } from '../player/MediaPlayer.js';
import type { VideoDispatcher } from './VideoDispatcher.js';

const CHANNELS = 2;

export interface AudioDispatcherOptions {
  seek?: number;
  volume?: number | boolean;
  fec?: boolean;
  plp?: number;
  bitrate?: number | string;
  highWaterMark?: number;
  [key: string]: unknown;
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface AudioDispatcher extends IVolumeInterface {}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class AudioDispatcher extends BaseDispatcher {
  public streamOptions: AudioDispatcherOptions;

  public constructor(
    player: MediaPlayer,
    { seek = 0, volume = 1, fec, plp, bitrate = 96, highWaterMark = 12 }: AudioDispatcherOptions = {},
    streams: DispatcherStreams = {},
  ) {
    const streamOptions = { seek, volume, fec, plp, bitrate, highWaterMark };
    super(player, highWaterMark, Util.getPayloadType('opus'), false, streams);

    this.streamOptions = streamOptions;
    this.streams.silence = new Silence();

    this.setVolume(typeof volume === 'number' ? volume : 1);
    this.setBitrate(bitrate);
    if (typeof fec !== 'undefined') this.setFEC(fec);
    if (typeof plp !== 'undefined') this.setPLP(plp);
  }

  public get TIMESTAMP_INC(): number {
    return 480 * CHANNELS;
  }

  public get FRAME_LENGTH(): number {
    return 20;
  }

  public getTypeDispatcher(): string {
    return 'audio';
  }

  public setBitrate(value?: number | string): boolean {
    if (!value || !this.bitrateEditable) return false;
    const channelBitrate = (this.player.voiceConnection as unknown as { channel?: { bitrate?: number } }).channel?.bitrate ?? 64;
    const bitrate = value === 'auto' ? channelBitrate : (typeof value === 'number' ? value : Number(value));
    this.streams.opus?.setBitrate?.(bitrate * 1000);
    return true;
  }

  public setPLP(value: number): boolean {
    if (!this.bitrateEditable) return false;
    this.streams.opus?.setPLP?.(value);
    return true;
  }

  public setFEC(enabled: boolean): boolean {
    if (!this.bitrateEditable) return false;
    this.streams.opus?.setFEC?.(enabled);
    return true;
  }

  public get volumeEditable(): boolean {
    return Boolean(this.streams.volume);
  }

  public get bitrateEditable(): boolean {
    return Boolean(this.streams.opus && typeof this.streams.opus.setBitrate === 'function');
  }

  public get volume(): number {
    return this.streams.volume ? this.streams.volume.volume : 1;
  }

  public setVolume(value: number): void {
    if (!this.streams.volume) return;
    this.emit('volumeChange', this.volume, value);
    this.streams.volume.setVolume(value);
  }

  public setSyncVideoDispatcher(otherDispatcher: VideoDispatcher): void {
    if (otherDispatcher.getTypeDispatcher() !== 'video') {
      throw new Error('Dispatcher must be a video dispatcher');
    }
    this._syncDispatcher = otherDispatcher;
  }
}

VolumeInterface.applyToClass(AudioDispatcher);

export default AudioDispatcher;
