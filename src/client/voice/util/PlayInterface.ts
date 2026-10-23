import { Readable } from 'node:stream';
import prism from 'prism-media';
import { DiscordError as Error } from '../../../errors/index.js';
import type { AudioDispatcher } from '../dispatcher/AudioDispatcher.js';
import type { VideoDispatcher } from '../dispatcher/VideoDispatcher.js';

export type StreamType = 'unknown' | 'converted' | 'opus' | 'ogg/opus' | 'webm/opus';

export interface StreamOptions {
  type?: StreamType;
  seek?: number;
  volume?: number | boolean;
  plp?: number;
  fec?: boolean;
  bitrate?: number | string;
  highWaterMark?: number;
  [key: string]: unknown;
}

export interface VideoOptions {
  seek?: number;
  fps?: number;
  highWaterMark?: number;
  presetH26x?: 'ultrafast' | 'superfast' | 'veryfast' | 'faster' | 'fast' | 'medium' | 'slow' | 'slower' | 'veryslow';
  hwAccel?: boolean;
  inputFFmpegArgs?: string[];
  outputFFmpegArgs?: string[];
  bitrate?: number | 'auto';
  [key: string]: unknown;
}

export interface VoicePlayer {
  playUnknown(resource: Readable | string, options: StreamOptions): AudioDispatcher;
  playPCMStream(resource: Readable | string, options: StreamOptions): AudioDispatcher;
  playOpusStream(resource: Readable | string, options: StreamOptions): AudioDispatcher;
  playUnknownVideo(resource: Readable | string, options: VideoOptions): VideoDispatcher;
}

export class PlayInterface {
  public player: VoicePlayer;

  public constructor(player: VoicePlayer) {
    this.player = player;
  }

  public playAudio(resource: Readable | string, options: StreamOptions = {}): AudioDispatcher {
    if (resource instanceof Readable || typeof resource === 'string') {
      const type = options.type || 'unknown';
      if (type === 'unknown') {
        return this.player.playUnknown(resource, options);
      } else if (type === 'converted') {
        return this.player.playPCMStream(resource, options);
      } else if (type === 'opus') {
        return this.player.playOpusStream(resource, options);
      } else if (type === 'ogg/opus') {
        if (!(resource instanceof Readable)) throw new Error('VOICE_PRISM_DEMUXERS_NEED_STREAM');
        return this.player.playOpusStream(resource.pipe(new prism.opus.OggDemuxer()), options);
      } else if (type === 'webm/opus') {
        if (!(resource instanceof Readable)) throw new Error('VOICE_PRISM_DEMUXERS_NEED_STREAM');
        return this.player.playOpusStream(resource.pipe(new prism.opus.WebmDemuxer()), options);
      }
    }
    throw new Error('VOICE_PLAY_INTERFACE_BAD_TYPE');
  }

  public playVideo(resource: Readable | string, options: VideoOptions = {}): VideoDispatcher {
    if (resource instanceof Readable || typeof resource === 'string') {
      return this.player.playUnknownVideo(resource, options);
    }
    throw new Error('VOICE_PLAY_INTERFACE_BAD_TYPE');
  }

  public static applyToClass(structure: { prototype: unknown }): void {
    for (const prop of ['playAudio', 'playVideo']) {
      Object.defineProperty(structure.prototype, prop, Object.getOwnPropertyDescriptor(PlayInterface.prototype, prop)!);
    }
  }
}

export default PlayInterface;
