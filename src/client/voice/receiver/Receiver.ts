import { EventEmitter } from 'node:events';
import { Readable, type Writable } from 'node:stream';
import prism from 'prism-media';
import PacketHandler from './PacketHandler.js';
import { DiscordError as Error } from '../../../errors/index.js';
import { PCMInsertSilence } from '../player/processing/PCMInsertSilence.js';
import type VoiceConnection from '../VoiceConnection.js';
import type Recorder from './Recorder.js';
import type { UserResolvable } from '../../../types/index.js';

export interface ReceiveStreamOptions {
  mode?: 'opus' | 'pcm';
  end?: 'silence' | 'manual';
  paddingSilence?: boolean;
}

/**
 * Receives audio packets from a voice connection.
 */
export class VoiceReceiver extends EventEmitter {
  public connection: VoiceConnection;
  public packets: PacketHandler;

  public constructor(connection: VoiceConnection) {
    super();
    this.connection = connection;
    this.packets = new PacketHandler(this);
    this.packets.on('error', (err: Error | string) => this.emit('debug', err));
  }

  public createStream(user: UserResolvable, options: ReceiveStreamOptions = {}): Readable {
    const resolvedUser = this.connection.client.users.resolve(user);
    const mode = options.mode ?? 'opus';
    const end = options.end ?? 'silence';
    let paddingSilence = options.paddingSilence ?? false;
    if (end === 'silence') paddingSilence = false;
    if (!resolvedUser) throw new Error('VOICE_USER_MISSING');
    const stream = this.packets.makeStream(resolvedUser.id, end);
    if (paddingSilence) {
      const decoder = new prism.opus.Decoder({ channels: 2, rate: 48000, frameSize: 960 });
      const pcmTransformer = new PCMInsertSilence();
      stream.pipe(decoder).pipe(pcmTransformer);
      if (mode === 'opus') {
        const encoder = new prism.opus.Encoder({ channels: 2, rate: 48000, frameSize: 960 });
        pcmTransformer.pipe(encoder);
        return encoder;
      }
      return pcmTransformer;
    } else {
      if (mode === 'pcm') {
        const decoder = new prism.opus.Decoder({ channels: 2, rate: 48000, frameSize: 960 });
        stream.pipe(decoder);
        return decoder;
      }
      return stream;
    }
  }

  public createVideoStream(user: UserResolvable, output?: string | Writable): Recorder {
    const resolvedUser = this.connection.client.users.resolve(user);
    if (!resolvedUser) throw new Error('VOICE_USER_MISSING');
    const stream = this.packets.makeVideoStream(resolvedUser.id, output);
    return stream;
  }
}

export default VoiceReceiver;
