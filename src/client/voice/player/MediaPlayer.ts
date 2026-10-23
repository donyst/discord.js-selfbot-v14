import EventEmitter from 'node:events';
import { Readable as ReadableStream, type Readable } from 'node:stream';
import prism from 'prism-media';
import { H264NalSplitter, H265NalSplitter } from './processing/AnnexBNalSplitter.js';
import { IvfTransformer } from './processing/IvfSplitter.js';
import { H264Dispatcher } from '../dispatcher/AnnexBDispatcher.js';
import AudioDispatcher, { type AudioDispatcherOptions } from '../dispatcher/AudioDispatcher.js';
import { VP8Dispatcher } from '../dispatcher/VPxDispatcher.js';
import type { VideoDispatcher } from '../dispatcher/VideoDispatcher.js';
import type { VoiceConnection } from '../VoiceConnection.js';
import type { DispatcherStreams } from '../dispatcher/BaseDispatcher.js';
import type { StreamOptions, VideoOptions } from '../util/PlayInterface.js';

const FFMPEG_OUTPUT_PREFIX = ['-use_wallclock_as_timestamps', '1', '-copyts', '-analyzeduration', '0'];
const FFMPEG_INPUT_PREFIX = [
  '-reconnect',
  '1',
  '-reconnect_at_eof',
  '1',
  '-reconnect_streamed',
  '1',
  '-reconnect_delay_max',
  '4294',
];
const FFMPEG_PCM_ARGUMENTS = ['-f', 's16le', '-ar', '48000', '-ac', '2'];
const FFMPEG_VP8_ARGUMENTS = ['-f', 'ivf', '-deadline', 'realtime', '-c:v', 'libvpx'];
const FFMPEG_H264_ARGUMENTS = (options?: VideoOptions): string[] => [
  '-c:v',
  'libx264',
  '-f',
  'h264',
  '-tune',
  'zerolatency',
  '-preset',
  options?.presetH26x || 'faster',
  '-profile:v',
  'baseline',
  '-bf',
  '0',
  '-bsf:v',
  'h264_metadata=aud=insert',
];

const FFMPEG_H265_ARGUMENTS = (options?: VideoOptions & { presetH265?: string }): string[] => [
  '-c:v',
  'libx265',
  '-f',
  'hevc',
  '-preset',
  options?.presetH265 || 'faster',
  '-profile:v',
  'main',
  '-bf',
  '0',
];

/**
 * Player for a Voice Connection.
 * @private
 * @extends {EventEmitter}
 */
export class MediaPlayer extends EventEmitter {
  public dispatcher: AudioDispatcher | null;
  public videoDispatcher: VideoDispatcher | null;
  public voiceConnection: VoiceConnection;
  public isScreenSharing?: boolean;

  public constructor(voiceConnection: VoiceConnection, isScreenSharing?: boolean) {
    super();

    this.dispatcher = null;
    this.videoDispatcher = null;
    this.voiceConnection = voiceConnection;
    this.isScreenSharing = isScreenSharing;
  }

  public destroy(): void {
    this.destroyDispatcher();
    this.destroyVideoDispatcher();
  }

  public destroyDispatcher(): void {
    if (this.dispatcher) {
      this.dispatcher.destroy();
      this.dispatcher = null;
    }
  }

  public destroyVideoDispatcher(): void {
    if (this.videoDispatcher) {
      this.videoDispatcher.destroy();
      this.videoDispatcher = null;
    }
  }

  public playUnknown(input: Readable | string, options: StreamOptions, streams: DispatcherStreams = {}): AudioDispatcher {
    this.destroyDispatcher();
    const isStream = input instanceof ReadableStream;
    const args = [...FFMPEG_OUTPUT_PREFIX, ...FFMPEG_PCM_ARGUMENTS];
    if (!isStream) args.unshift('-i', input);
    if (options.seek) args.unshift('-ss', String(options.seek));
    if (typeof input === 'string' && input.startsWith('http')) {
      args.unshift(...FFMPEG_INPUT_PREFIX);
    }

    const ffmpeg = new prism.FFmpeg({ args });
    this.emit('debug', `[ffmpeg-audio_process] Spawn process with args:\n${args.join(' ')}`);

    ffmpeg.process.stderr?.on('data', (data: Buffer) => {
      this.emit('debug', `[ffmpeg-audio_process]: ${data.toString()}`);
    });

    streams.ffmpeg = ffmpeg;
    if (isStream) {
      streams.input = input;
      input.pipe(ffmpeg);
    }
    return this.playPCMStream(ffmpeg, options, streams);
  }

  public playPCMStream(stream: Readable, options: StreamOptions, streams: DispatcherStreams = {}): AudioDispatcher {
    this.destroyDispatcher();
    const opus = (streams.opus = new prism.opus.Encoder({ channels: 2, rate: 48000, frameSize: 960 }));
    if (options && options.volume === false) {
      stream.pipe(opus);
      return this.playOpusStream(opus, options, streams);
    }
    streams.volume = new prism.VolumeTransformer({ type: 's16le', volume: typeof options?.volume === 'number' ? options.volume : 1 });
    stream.pipe(streams.volume).pipe(opus);
    return this.playOpusStream(opus, options, streams);
  }

  public playOpusStream(stream: Readable, options: StreamOptions, streams: DispatcherStreams = {}): AudioDispatcher {
    this.destroyDispatcher();
    streams.opus = stream as unknown as DispatcherStreams['opus'];
    if (options.volume !== false && !streams.input) {
      streams.input = stream;
      const decoder = new prism.opus.Decoder({ channels: 2, rate: 48000, frameSize: 960 });
      streams.volume = new prism.VolumeTransformer({ type: 's16le', volume: typeof options?.volume === 'number' ? options.volume : 1 });
      streams.opus = stream
        .pipe(decoder)
        .pipe(streams.volume)
        .pipe(new prism.opus.Encoder({ channels: 2, rate: 48000, frameSize: 960 })) as unknown as DispatcherStreams['opus'];
    }
    const dispatcher = this.createDispatcher(options as AudioDispatcherOptions, streams);
    (streams.opus as unknown as Readable).pipe(dispatcher);
    return dispatcher;
  }

  public playUnknownVideo(input: Readable | string, options: VideoOptions = {}): VideoDispatcher {
    this.destroyVideoDispatcher();
    const isStream = input instanceof ReadableStream;
    if (!options?.fps) options.fps = 30;

    const args = [
      '-i',
      isStream ? '-' : input,
      ...FFMPEG_OUTPUT_PREFIX,
      '-flags',
      'low_delay',
      '-r',
      `${options?.fps}`,
    ];

    if (options?.bitrate && typeof options?.bitrate === 'number') {
      args.push('-b:v', `${options.bitrate}K`);
    }

    if (options?.hwAccel === true) {
      args.unshift('-hwaccel', 'auto');
    }

    if (options.seek) args.unshift('-ss', String(options.seek));

    if (typeof input === 'string' && input.startsWith('http')) {
      args.unshift(...FFMPEG_INPUT_PREFIX);
    }

    const videoCodec = (this.voiceConnection as unknown as { videoCodec?: string }).videoCodec;
    if (videoCodec === 'VP8') {
      args.push(...FFMPEG_VP8_ARGUMENTS);
    }

    if (videoCodec === 'H264') {
      args.push(...FFMPEG_H264_ARGUMENTS(options));
    }

    if (videoCodec === 'H265') {
      args.push(...FFMPEG_H265_ARGUMENTS(options));
    }

    args.push('-force_key_frames', '00:02');

    if (options?.inputFFmpegArgs) {
      args.unshift(...options.inputFFmpegArgs);
    }

    if (options?.outputFFmpegArgs) {
      args.push(...options.outputFFmpegArgs);
    }

    const ffmpeg = new prism.FFmpeg({ args });
    const streams: DispatcherStreams = { ffmpeg };

    if (isStream) {
      streams.input = input;
      input.pipe(ffmpeg);
    }

    this.emit('debug', `[ffmpeg-video_process] Spawn process with args:\n${args.join(' ')}`);

    ffmpeg.process.stderr?.on('data', (data: Buffer) => {
      this.emit('debug', `[ffmpeg-video_process]: ${data.toString()}`);
    });

    switch (videoCodec) {
      case 'VP8': {
        return this.playIvfVideo(ffmpeg, options, streams);
      }
      case 'H264': {
        return this.playAnnexBVideo(ffmpeg, options, streams, 'H264');
      }
      default: {
        throw new Error('Invalid codec (Supported: VP8, H264)');
      }
    }
  }

  public playIvfVideo(stream: Readable, options: VideoOptions, streams: DispatcherStreams): VideoDispatcher {
    this.destroyVideoDispatcher();
    const videoStream = new IvfTransformer();
    stream.pipe(videoStream);
    streams.video = videoStream;
    const dispatcher = this.createVideoDispatcher(options, streams);
    videoStream.pipe(dispatcher);
    return dispatcher;
  }

  public playAnnexBVideo(stream: Readable, options: VideoOptions, streams: DispatcherStreams, type: string): VideoDispatcher {
    this.destroyVideoDispatcher();
    let videoStream: import('node:stream').Transform;
    if (type === 'H264') {
      videoStream = new H264NalSplitter();
    } else if (type === 'H265') {
      videoStream = new H265NalSplitter();
    } else {
      videoStream = new H264NalSplitter();
    }
    stream.pipe(videoStream);
    streams.video = videoStream;
    const dispatcher = this.createVideoDispatcher(options, streams);
    videoStream.pipe(dispatcher);
    return dispatcher;
  }

  public createDispatcher(options: AudioDispatcherOptions, streams: DispatcherStreams): AudioDispatcher {
    this.destroyDispatcher();
    const dispatcher = (this.dispatcher = new AudioDispatcher(this, options, streams));
    return dispatcher;
  }

  public createVideoDispatcher(options: VideoOptions, streams: DispatcherStreams): VideoDispatcher {
    this.destroyVideoDispatcher();
    const videoCodec = (this.voiceConnection as unknown as { videoCodec?: string }).videoCodec;
    switch (videoCodec) {
      case 'VP8': {
        const dispatcher = (this.videoDispatcher = new VP8Dispatcher(
          this,
          options?.highWaterMark,
          streams,
          options?.fps,
        ));
        return dispatcher;
      }
      case 'H264': {
        const dispatcher = (this.videoDispatcher = new H264Dispatcher(
          this,
          options?.highWaterMark,
          streams,
          options?.fps,
        ));
        return dispatcher;
      }
      default: {
        throw new Error('Invalid codec');
      }
    }
  }
}

export default MediaPlayer;
