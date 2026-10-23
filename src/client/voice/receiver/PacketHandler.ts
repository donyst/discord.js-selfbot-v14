import { EventEmitter } from 'node:events';
import { Buffer } from 'node:buffer';
import crypto from 'node:crypto';
import { setTimeout, clearTimeout } from 'node:timers';
import { Readable, type Writable } from 'node:stream';
import { RtpPacket } from 'werift-rtp';
import Recorder from './Recorder.js';
import Speaking from '../../../util/Speaking.js';
import Util from '../../../util/Util.js';
import secretbox from '../util/Secretbox.js';
import { SILENCE_FRAME } from '../util/Silence.js';
import type VoiceReceiver from './Receiver.js';
import type VoiceConnection from '../VoiceConnection.js';
import type { Snowflake } from '../../../types/index.js';

const DISCORD_SPEAKING_DELAY = 250;
const UNPADDED_NONCE_LENGTH = 4;
const AUTH_TAG_LENGTH = 16;

class StreamReadable extends Readable {
  public override _read(): void {}
}

export interface StreamInfo {
  stream: Readable;
  end: string;
}

export interface UserSpeakingStat {
  userId: Snowflake;
  hasVideo?: boolean;
  speaking?: number | boolean;
}

export class PacketHandler extends EventEmitter {
  public receiver: VoiceReceiver;
  public streams: Map<Snowflake, StreamInfo>;
  public videoStreams: Map<Snowflake, Recorder>;
  public speakingTimeouts: Map<number, NodeJS.Timeout>;

  public constructor(receiver: VoiceReceiver) {
    super();
    this.receiver = receiver;
    this.streams = new Map();
    this.videoStreams = new Map();
    this.speakingTimeouts = new Map();
  }

  public getNonceBuffer(): Buffer {
    return this.receiver.connection.authentication.mode === 'aead_aes256_gcm_rtpsize'
      ? Buffer.alloc(12)
      : Buffer.alloc(24);
  }

  public get connection(): VoiceConnection {
    return this.receiver.connection;
  }

  public _stoppedSpeaking(userId: Snowflake): void {
    const streamInfo = this.streams.get(userId);
    if (streamInfo && streamInfo.end === 'silence') {
      this.streams.delete(userId);
      streamInfo.stream.push(null);
    }
  }

  public makeStream(user: Snowflake, end: string): Readable {
    const existing = this.streams.get(user);
    if (existing) return existing.stream;
    const stream = new StreamReadable();
    stream.on('end', () => this.streams.delete(user));
    this.streams.set(user, { stream, end });
    return stream;
  }

  public makeVideoStream(user: Snowflake, output?: string | Writable): Recorder {
    const existing = this.videoStreams.get(user);
    if (existing) return existing;
    const stream = new Recorder(this, {
      userId: user,
      output,
      portUdpH264: 65506,
      portUdpOpus: 65510,
    });
    stream.on('ready', () => {
      this.videoStreams.set(user, stream);
    });
    return stream;
  }

  public parseBuffer(buffer: Buffer): RtpPacket | Error {
    const { secret_key, mode } = this.receiver.connection.authentication;
    if (!secret_key) return new Error('secret_key cannot be null or undefined');
    const nonce = this.getNonceBuffer();
    buffer.copy(nonce, 0, buffer.length - UNPADDED_NONCE_LENGTH);

    let headerSize = 12;
    const first = buffer.readUInt8();
    if ((first >> 4) & 0x01) headerSize += 4;

    const header = buffer.subarray(0, headerSize);
    const encrypted = buffer.subarray(headerSize, buffer.length - AUTH_TAG_LENGTH - UNPADDED_NONCE_LENGTH);
    const authTag = buffer.subarray(
      buffer.length - AUTH_TAG_LENGTH - UNPADDED_NONCE_LENGTH,
      buffer.length - UNPADDED_NONCE_LENGTH,
    );

    let packet: Buffer;
    switch (mode) {
      case 'aead_aes256_gcm_rtpsize': {
        const decipheriv = crypto.createDecipheriv('aes-256-gcm', secret_key as crypto.CipherKey, nonce);
        decipheriv.setAAD(header);
        decipheriv.setAuthTag(authTag);

        packet = Buffer.concat([decipheriv.update(encrypted), decipheriv.final()]);
        break;
      }
      case 'aead_xchacha20_poly1305_rtpsize': {
        const decrypted = secretbox.methods.crypto_aead_xchacha20poly1305_ietf_decrypt(
          Buffer.concat([encrypted, authTag]),
          header,
          nonce,
          secret_key as Uint8Array,
        );

        packet = Buffer.from(decrypted);
        break;
      }
      default: {
        return new RangeError(`Unsupported decryption method: ${String(mode)}`);
      }
    }

    return RtpPacket.deSerialize(Buffer.concat([header, packet]));
  }

  public audioReceiver(ssrc: number, userStat: UserSpeakingStat, opusPacket: RtpPacket | Error): void {
    const streamInfo = this.streams.get(userStat.userId);
    if (userStat.hasVideo) {
      if (opusPacket instanceof Error) {
        if (streamInfo) {
          this.emit('error', opusPacket);
        }
        return;
      }
      if (opusPacket.header.payloadType !== Util.getPayloadType('opus')) {
        return;
      }
      if (!opusPacket.payload) {
        return;
      }
      if (SILENCE_FRAME.equals(opusPacket.payload)) {
        return;
      }
    }

    const speakingTimeout = this.speakingTimeouts.get(ssrc);
    if (typeof speakingTimeout === 'undefined') {
      if (userStat.speaking === 0) {
        userStat.speaking = Speaking.FLAGS.SPEAKING;
      }
      const speakingVal = typeof userStat.speaking === 'number' ? userStat.speaking : (userStat.speaking ? Speaking.FLAGS.SPEAKING : 0);
      this.connection.onSpeaking({ user_id: userStat.userId, ssrc, speaking: speakingVal });
      const timeout = setTimeout(() => {
        try {
          this.connection.onSpeaking({ user_id: userStat.userId, ssrc, speaking: 0 });
          clearTimeout(timeout);
          this.speakingTimeouts.delete(ssrc);
        } catch {
          // Connection already closed, ignore
        }
      }, DISCORD_SPEAKING_DELAY).unref();
      this.speakingTimeouts.set(ssrc, timeout);
    } else {
      speakingTimeout.refresh();
    }

    if (streamInfo) {
      const { stream } = streamInfo;
      if (opusPacket instanceof Error) {
        this.emit('error', opusPacket);
        return;
      }
      if (opusPacket.header.payloadType !== Util.getPayloadType('opus')) {
        return;
      }
      stream.push(opusPacket.payload);
    }
  }

  public audioReceiverForStream(_ssrc: number, userStat: UserSpeakingStat, packet: RtpPacket | Error): void {
    const streamInfo = this.videoStreams.get(userStat.userId);
    if (!streamInfo) return;
    if (packet instanceof Error) {
      return;
    }
    if (packet.header.payloadType !== Util.getPayloadType('opus')) {
      return;
    }
    streamInfo.feed(packet);
  }

  public videoReceiver(_ssrc: number, userStat: UserSpeakingStat, packet: RtpPacket | Error): void {
    const streamInfo = this.videoStreams.get(userStat.userId);
    if (userStat.hasVideo) {
      if (packet instanceof Error) {
        return;
      }

      if (packet.header.payloadType === Util.getPayloadType('opus')) {
        return;
      }

      if (streamInfo) {
        streamInfo.feed(packet);
      }
    }
  }

  public push(buffer: Buffer): void {
    const ssrc = buffer.readUInt32BE(8);
    let userStat: UserSpeakingStat | undefined;
    let packet: RtpPacket | Error | undefined;
    if (this.connection.ssrcMap.has(ssrc)) {
      userStat = this.connection.ssrcMap.get(ssrc);
      packet = this.parseBuffer(buffer);
      this.audioReceiver(ssrc, userStat!, packet);
      this.audioReceiverForStream(ssrc, userStat!, packet);
    } else if (this.connection.ssrcMap.has(ssrc - 1)) {
      userStat = this.connection.ssrcMap.get(ssrc - 1);
      packet = this.parseBuffer(buffer);
      this.videoReceiver(ssrc, userStat!, packet);
    }
    if (userStat && !(packet instanceof Error) && packet) {
      this.receiver.emit('receiverData', userStat, packet);
    }
  }

  public destroyAllStream(): void {
    for (const stream of this.streams.values()) {
      stream.stream.destroy();
    }
    this.streams.clear();
    for (const stream of this.videoStreams.values()) {
      stream.destroy();
    }
    this.videoStreams.clear();
  }
}

export default PacketHandler;
