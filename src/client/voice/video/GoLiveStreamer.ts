import EventEmitter from 'node:events';
import type { Readable } from 'node:stream';
import type { VoiceConnection, StreamConnection } from '../VoiceConnection.js';
import type { VideoDispatcher } from '../dispatcher/VideoDispatcher.js';
import type { AudioDispatcher } from '../dispatcher/AudioDispatcher.js';

export interface GoLiveStreamOptions {
  /**
   * Target frame rate (e.g. 30 or 60). Defaults to 30.
   */
  fps?: number;
  /**
   * Video bitrate in kbps. Defaults to 3500.
   */
  bitrate?: number;
  /**
   * Video width. Defaults to 1280.
   */
  width?: number;
  /**
   * Video height. Defaults to 720.
   */
  height?: number;
  /**
   * Video codec. Defaults to 'H264'.
   */
  videoCodec?: 'H264' | 'VP8';
  /**
   * Whether to also stream audio from the same media source. Defaults to true.
   */
  includeAudio?: boolean;
  /**
   * Audio volume (0.0 to 1.0). Defaults to 1.
   */
  volume?: number;
}

/**
 * High-level coordinator for Go-Live / Screen Share streaming into Discord Voice channels.
 * Manages dual video + audio dispatchers, synchronization, pause/resume, and lifecycle events.
 */
export class GoLiveStreamer extends EventEmitter {
  public connection: VoiceConnection;
  public streamConnection: StreamConnection | null = null;
  public videoDispatcher: VideoDispatcher | null = null;
  public audioDispatcher: AudioDispatcher | null = null;
  public isStreaming: boolean = false;
  public isPaused: boolean = false;

  public constructor(connection: VoiceConnection) {
    super();
    this.connection = connection;
  }

  /**
   * Begins streaming a video (and optional audio) resource into the Discord voice channel.
   * @param source File path, URL, or Readable stream
   * @param options Streaming configuration (fps, bitrate, codec, audio)
   */
  public async start(source: string | Readable, options: GoLiveStreamOptions = {}): Promise<void> {
    const {
      fps = 30,
      bitrate = 3500,
      videoCodec = 'H264',
      includeAudio = true,
      volume = 1,
    } = options;

    if (this.isStreaming) {
      this.stop();
    }

    // Set connection codec
    this.connection.setVideoCodec(videoCodec);

    // Initialize stream connection
    this.streamConnection = await this.connection.createStreamConnection();
    this.isStreaming = true;
    this.isPaused = false;

    // Start video dispatcher
    this.videoDispatcher = this.streamConnection.playVideo(source, {
      fps,
      bitrate,
    });

    this.videoDispatcher.on('start', () => {
      this.emit('videoStart');
      this.emit('start');
    });

    this.videoDispatcher.on('finish', () => {
      this.emit('videoFinish');
      if (!this.audioDispatcher || this.audioDispatcher.destroyed) {
        this.emit('finish');
        this.isStreaming = false;
      }
    });

    this.videoDispatcher.on('error', (err: Error) => {
      this.emit('error', err);
    });

    // Start audio dispatcher if requested
    if (includeAudio) {
      try {
        this.audioDispatcher = this.streamConnection.playAudio(source, {
          volume,
        });

        this.audioDispatcher.on('start', () => {
          this.emit('audioStart');
        });

        this.audioDispatcher.on('finish', () => {
          this.emit('audioFinish');
          if (!this.videoDispatcher || this.videoDispatcher.destroyed) {
            this.emit('finish');
            this.isStreaming = false;
          }
        });

        this.audioDispatcher.on('error', (err: Error) => {
          this.emit('error', err);
        });
      } catch (err) {
        this.emit('warning', `Failed to start synchronized audio stream: ${err}`);
      }
    }
  }

  /**
   * Pauses both video and audio streams.
   */
  public pause(): void {
    if (!this.isStreaming || this.isPaused) return;
    this.videoDispatcher?.pause();
    this.audioDispatcher?.pause();
    this.isPaused = true;
    this.emit('pause');
  }

  /**
   * Resumes paused video and audio streams.
   */
  public resume(): void {
    if (!this.isStreaming || !this.isPaused) return;
    this.videoDispatcher?.resume();
    this.audioDispatcher?.resume();
    this.isPaused = false;
    this.emit('resume');
  }

  /**
   * Stops streaming and destroys active dispatchers.
   */
  public stop(): void {
    if (this.videoDispatcher) {
      try {
        this.videoDispatcher.destroy();
      } catch {}
      this.videoDispatcher = null;
    }

    if (this.audioDispatcher) {
      try {
        this.audioDispatcher.destroy();
      } catch {}
      this.audioDispatcher = null;
    }

    this.isStreaming = false;
    this.isPaused = false;
    this.emit('stop');
  }

  /**
   * Adjusts the volume of the audio stream.
   * @param volume Value between 0.0 and 1.0 (or higher)
   */
  public setVolume(volume: number): void {
    if (this.audioDispatcher && typeof this.audioDispatcher.setVolume === 'function') {
      this.audioDispatcher.setVolume(volume);
    }
  }
}

export default GoLiveStreamer;
