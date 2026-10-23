import { Buffer } from 'node:buffer';
import crypto from 'node:crypto';
import { Writable, type WritableOptions } from 'node:stream';
import { setTimeout } from 'node:timers';
import secretbox from '../util/Secretbox.js';
import type { MediaPlayer } from '../player/MediaPlayer.js';

const MAX_UINT_16 = 2 ** 16 - 1;
const MAX_UINT_32 = 2 ** 32 - 1;

export interface Extension {
  id: number;
  length: number;
  value: number;
}

const extensions: Extension[] = [{ id: 5, length: 2, value: 0 }];

export interface DispatcherStreams {
  input?: import('node:stream').Readable & { destroy?(): void };
  ffmpeg?: import('prism-media').FFmpeg & { destroy?(): void; pause?(): void; resume?(): void };
  opus?: (import('node:stream').Readable & import('node:stream').Writable & { destroy?(): void; setBitrate?(b: number): void; setPLP?(p: number): void; setFEC?(f: boolean): void });
  volume?: (import('node:stream').Transform & { volume: number; setVolume(v: number): void });
  silence?: (import('node:stream').Readable & { unpipe(d: unknown): void });
  video?: (import('node:stream').Transform & { unpipe(d: unknown): void });
  [key: string]: unknown;
}

/**
 * @extends {Writable}
 */
export abstract class BaseDispatcher extends Writable {
  public streams: DispatcherStreams;
  public player: MediaPlayer;
  public payloadType: number;
  public extensionEnabled: boolean;
  public _nonce: number;
  public _nonceBuffer: Buffer | null;
  public pausedSince: number | null;
  public _writeCallback: (() => void) | null;
  public _pausedTime: number;
  public _silentPausedTime: number;
  public count: number;
  public sequence: number;
  public timestamp: number;
  public startTime!: number;
  public _silence?: boolean;
  public _syncDispatcher?: BaseDispatcher;

  public abstract get TIMESTAMP_INC(): number;
  public abstract get FRAME_LENGTH(): number;
  public abstract getTypeDispatcher(): string;

  public constructor(
    player: MediaPlayer,
    highWaterMark = 12,
    payloadType: number,
    extensionEnabled: boolean,
    streams: DispatcherStreams = {},
  ) {
    super({
      highWaterMark,
    } as WritableOptions);
    this.streams = streams;
    this.player = player;
    this.payloadType = payloadType;
    this.extensionEnabled = extensionEnabled;

    this._nonce = 0;
    this._nonceBuffer = null;
    this.pausedSince = null;
    this._writeCallback = null;
    this._pausedTime = 0;
    this._silentPausedTime = 0;
    this.count = 0;
    this.sequence = 0;
    this.timestamp = 0;

    const streamError = (type?: string, err?: Error): void => {
      if (type && err) {
        err.message = `${type} stream: ${err.message}`;
        this.emit(this.player.dispatcher === (this as unknown) ? 'error' : 'debug', err);
      }
      this.destroy();
    };

    this.on('error', () => streamError());
    if (this.streams.input) this.streams.input.on('error', (err: Error) => streamError('input', err));
    if (this.streams.ffmpeg) this.streams.ffmpeg.on('error', (err: Error) => streamError('ffmpeg', err));
    if (this.streams.opus) this.streams.opus.on('error', (err: Error) => streamError('opus', err));
    if (this.streams.volume) this.streams.volume.on('error', (err: Error) => streamError('volume', err));

    this.on('finish', () => {
      this._cleanup();
      this._setSpeaking(0);
      this._setVideoStatus(false);
      this._setStreamStatus(true);
    });
  }

  public resetNonceBuffer(): void {
    const mode = (this.player.voiceConnection as unknown as { authentication: { mode: string } }).authentication.mode;
    this._nonceBuffer =
      mode === 'aead_aes256_gcm_rtpsize'
        ? Buffer.alloc(12)
        : Buffer.alloc(24);
  }

  public getNewSequence(): number {
    const currentSeq = this.sequence;
    this.sequence++;
    if (this.sequence > MAX_UINT_16) this.sequence = 0;
    return currentSeq;
  }

  public override _write(chunk: Buffer, _enc: BufferEncoding, done: (error?: Error | null) => void): void {
    if (!this.startTime) {
      this.emit('start');
      this.startTime = performance.now();
    }
    if (this._syncDispatcher && !this._syncDispatcher.startTime) {
      this.pause();
      const cb = (): void => {
        this.resume();
        clearTimeout(timeout);
      };
      this._syncDispatcher.once('start', cb);
      const timeout = setTimeout(() => {
        this.removeListener('start', cb);
        this.resume();
      }, 10_000).unref();
    }
    if (this.getTypeDispatcher() === 'video') {
      this._codecCallback(chunk);
    } else {
      this._playChunk(chunk);
    }
    this._step(done);
  }

  public _codecCallback(_chunk: Buffer): void {
    // Implemented in subclasses if video
  }

  public override _destroy(err: Error | null, cb: (error?: Error | null) => void): void {
    this._cleanup();
    super._destroy(err, cb);
  }

  public _cleanup(): void {
    if (this.player.dispatcher === (this as unknown)) {
      this.player.dispatcher?.destroy();
      this.player.dispatcher = null;
    }
    if (this.player.videoDispatcher === (this as unknown)) {
      this.player.videoDispatcher?.destroy();
      this.player.videoDispatcher = null;
    }
    const { streams } = this;
    if (streams.opus) streams.opus.destroy?.();
    streams.ffmpeg?.destroy?.();
  }

  public pause(silence = false): void {
    if (this.paused) return;
    if (this.streams.opus) this.streams.opus.unpipe(this);
    if (this.streams.video) {
      this.streams.ffmpeg?.pause?.();
      this.streams.video.unpipe(this);
    }
    if (this.getTypeDispatcher() === 'audio') {
      if (silence && this.streams.silence) {
        this.streams.silence.pipe(this);
        this._silence = true;
      } else {
        this._setSpeaking(0);
      }
    }
    this.pausedSince = performance.now();
  }

  public get paused(): boolean {
    return Boolean(this.pausedSince);
  }

  public get pausedTime(): number {
    return this._silentPausedTime + this._pausedTime + (this.paused ? performance.now() - this.pausedSince! : 0);
  }

  public resume(): void {
    if (!this.pausedSince) return;
    if (this.getTypeDispatcher() === 'audio' && this.streams.silence) this.streams.silence.unpipe(this);
    if (this.streams.opus) this.streams.opus.pipe(this);
    if (this.streams.video) {
      this.streams.ffmpeg?.resume?.();
      this.streams.video.pipe(this);
    }
    if (this._silence) {
      this._silentPausedTime += performance.now() - this.pausedSince;
      this._silence = false;
    } else {
      this._pausedTime += performance.now() - this.pausedSince;
    }
    this.pausedSince = null;
    if (typeof this._writeCallback === 'function') this._writeCallback();
  }

  public get totalStreamTime(): number {
    return performance.now() - this.startTime;
  }

  public _step(done: (error?: Error | null) => void): void {
    this._writeCallback = (): void => {
      this._writeCallback = null;
      done();
    };
    const next = (this.count + 1) * this.FRAME_LENGTH - (performance.now() - this.startTime - this._pausedTime);
    setTimeout(() => {
      if ((!this.pausedSince || this._silence) && this._writeCallback) this._writeCallback();
    }, next).unref();
    this.timestamp += this.TIMESTAMP_INC;
    if (this.timestamp > MAX_UINT_32) this.timestamp = 0;
    this.count++;
    if (this.count > MAX_UINT_16) this.count = 0;
  }

  public override _final(callback: (error?: Error | null) => void): void {
    this._writeCallback = null;
    callback();
  }

  public _playChunk(chunk: Buffer, isLastPacket = false): void {
    if (
      (this.player.dispatcher !== (this as unknown) && this.player.videoDispatcher !== (this as unknown)) ||
      !(this.player.voiceConnection as unknown as { authentication: { secret_key?: Uint8Array } }).authentication?.secret_key
    ) {
      return;
    }
    const packet = this._createPacket(chunk, isLastPacket);
    if (packet) this._sendPacket(packet);
  }

  public createHeaderExtension(): Buffer {
    const profile = Buffer.alloc(4);
    profile[0] = 0xbe;
    profile[1] = 0xde;
    profile.writeInt16BE(extensions.length, 2);
    return profile;
  }

  public createPayloadExtension(): Buffer {
    const extensionsData: Buffer[] = [];
    for (const ext of extensions) {
      const data = Buffer.alloc(4);
      if (ext.id === 5) {
        data[0] = ((ext.id & 0b00001111) << 4) | ((ext.length - 1) & 0b00001111);
        data.writeUIntBE(ext.value, 1, 2);
      }
      extensionsData.push(data);
    }
    return Buffer.concat(extensionsData);
  }

  public _encrypt(buffer: Buffer, additionalData: Buffer): [Buffer, Buffer] {
    const { secret_key, mode } = (this.player.voiceConnection as unknown as { authentication: { secret_key: Uint8Array; mode: string } }).authentication;
    this._nonce++;
    if (this._nonce > MAX_UINT_32) this._nonce = 0;
    if (!this._nonceBuffer) {
      this.resetNonceBuffer();
    }
    this._nonceBuffer!.writeUInt32BE(this._nonce, 0);

    const noncePadding = this._nonceBuffer!.subarray(0, 4);

    let encrypted: Buffer;

    switch (mode) {
      case 'aead_aes256_gcm_rtpsize': {
        const cipher = crypto.createCipheriv('aes-256-gcm', secret_key, this._nonceBuffer!);
        cipher.setAAD(additionalData);

        encrypted = Buffer.concat([cipher.update(buffer), cipher.final(), cipher.getAuthTag()]);

        return [encrypted, noncePadding];
      }
      case 'aead_xchacha20_poly1305_rtpsize': {
        const res = secretbox.methods.crypto_aead_xchacha20poly1305_ietf_encrypt(
          buffer,
          additionalData,
          this._nonceBuffer!,
          secret_key,
        );
        encrypted = Buffer.from(res);

        return [encrypted, noncePadding];
      }
      default: {
        throw new RangeError(`Unsupported encryption method: ${mode}`);
      }
    }
  }

  public _createPacket(buffer: Buffer, isLastPacket: boolean): Buffer {
    let rtpHeader = Buffer.alloc(12);
    rtpHeader[0] = 0x80;
    rtpHeader[1] = this.payloadType;
    if (this.extensionEnabled) {
      rtpHeader = Buffer.concat([rtpHeader, this.createHeaderExtension()]);
      rtpHeader[0] = (rtpHeader[0] ?? 0) | (1 << 4);
    }
    if (this.getTypeDispatcher() === 'video' && isLastPacket) {
      rtpHeader[1] = (rtpHeader[1] ?? 0) | (1 << 7);
    }

    const auth = (this.player.voiceConnection as unknown as { authentication: { ssrc: number } }).authentication;
    rtpHeader.writeUIntBE(this.getNewSequence(), 2, 2);
    rtpHeader.writeUIntBE(this.timestamp, 4, 4);
    rtpHeader.writeUIntBE(
      auth.ssrc + Number(this.getTypeDispatcher() === 'video'),
      8,
      4,
    );
    return Buffer.concat([rtpHeader, ...this._encrypt(buffer, rtpHeader)]);
  }

  public _sendPacket(packet: Buffer): void {
    if (this.getTypeDispatcher() === 'audio') {
      this._setSpeaking(this.player.isScreenSharing ? 1 << 1 : 1 << 0);
    } else if (this.getTypeDispatcher() === 'video') {
      this._setVideoStatus(true);
      this._setStreamStatus(false);
    }

    const conn = this.player.voiceConnection as unknown as { sockets: { udp?: { send(p: Buffer): Promise<Buffer> } } };
    if (!conn.sockets.udp) {
      this.emit('debug', 'Failed to send a packet - no UDP socket');
      return;
    }
    conn.sockets.udp.send(packet).catch(e => {
      if (this.getTypeDispatcher() === 'audio') {
        this._setSpeaking(0);
      } else if (this.getTypeDispatcher() === 'video') {
        this._setVideoStatus(false);
        this._setStreamStatus(true);
      }
      this.emit('debug', `Failed to send a packet - ${e}`);
    });
  }

  public _setSpeaking(value: number): void {
    const conn = this.player.voiceConnection as unknown as { setSpeaking?(v: number): void };
    if (typeof conn.setSpeaking === 'function') {
      conn.setSpeaking(value);
    }
    this.emit('speaking', value);
  }

  public _setVideoStatus(value: boolean): void {
    const conn = this.player.voiceConnection as unknown as { setVideoStatus?(v: boolean): void };
    if (typeof conn.setVideoStatus === 'function') {
      conn.setVideoStatus(value);
    }
    this.emit('videoStatus', value);
  }

  public _setStreamStatus(value: boolean): void {
    const conn = this.player.voiceConnection as unknown as { sendScreenshareState?(v: boolean): void };
    if (typeof conn.sendScreenshareState === 'function') {
      conn.sendScreenshareState(value);
    }
    this.emit('streamStatus', value);
  }
}

export default BaseDispatcher;
