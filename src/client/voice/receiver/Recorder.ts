import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createSocket, type Socket } from 'node:dgram';
import { EventEmitter } from 'node:events';
import { Buffer } from 'node:buffer';
import { Writable } from 'node:stream';
import find from 'find-process';
import kill from 'tree-kill';
import { RtpPacket } from 'werift-rtp';
import Util from '../../../util/Util.js';
import { randomPorts } from '../util/Function.js';
import { StreamOutput } from '../util/Socket.js';
import type PacketHandler from './PacketHandler.js';
import type { Snowflake } from '../../../types/index.js';

export interface RecorderOptions {
  userId?: Snowflake;
  portUdpH264?: number;
  portUdpOpus?: number;
  output?: string | Writable;
}

/**
 * Represents a FFmpeg handler
 */
export class Recorder extends EventEmitter {
  public readonly receiver: PacketHandler;
  public userId?: Snowflake;
  public portUdpH264?: number;
  public portUdpH265: number | null = null;
  public portUdpOpus?: number;
  public promise: Promise<void> | null = null;
  public output?: string | Writable;
  public ready = false;
  public socket: Socket;
  public outputStream?: ReturnType<typeof StreamOutput>;
  public stream!: ChildProcessWithoutNullStreams;

  public constructor(receiver: PacketHandler, options: RecorderOptions = {}) {
    super();

    Object.defineProperty(this, 'receiver', { value: receiver });

    this.userId = options.userId;
    this.portUdpH264 = options.portUdpH264;
    this.portUdpH265 = null;
    this.portUdpOpus = options.portUdpOpus;
    this.output = options.output;
    this.ready = false;
    this.socket = createSocket('udp4');

    if (!options.portUdpH264 || !options.portUdpOpus) {
      this.promise = randomPorts(6, 'udp4').then(ports => {
        const filteredPorts = ports.filter(port => port % 2 === 0);
        this.portUdpH264 ??= filteredPorts[0];
        this.portUdpOpus ??= filteredPorts[1];
      });
    }

    void this.init(options.output);
  }

  public async init(output?: string | Writable): Promise<void> {
    await this.promise;
    const sdpData = Util.getSDPCodecName(this.portUdpH264 ?? 0, this.portUdpH265 ?? 0, this.portUdpOpus ?? 0);
    const isStream = output instanceof Writable;
    if (isStream) {
      this.outputStream = StreamOutput(output);
    }
    const stream = spawn('ffmpeg', [
      '-reorder_queue_size',
      '500',
      '-thread_queue_size',
      '500',
      '-err_detect',
      'ignore_err',
      '-flags2',
      '+export_mvs',
      '-fflags',
      '+genpts+discardcorrupt',
      '-use_wallclock_as_timestamps',
      '1',
      '-f',
      'sdp',
      '-analyzeduration',
      '1M',
      '-probesize',
      '1M',
      '-protocol_whitelist',
      'file,udp,rtp,pipe,fd',
      '-i',
      '-', // Read from stdin
      '-buffer_size',
      '4M',
      '-max_delay',
      '500000', // 500ms
      '-rtbufsize',
      '4M',
      '-c',
      'copy',
      '-y',
      '-f',
      'matroska',
      isStream ? this.outputStream!.url : (output as string),
    ]);

    this.stream = stream;
    this.stream.stdin.write(sdpData);
    this.stream.stdin.end();
    this.stream.stderr.once('data', (data: Buffer | string) => {
      this.emit('debug', `stderr: ${String(data)}`);
      this.ready = true;
      this.emit('ready');
    });
  }

  /**
   * Send a payload to FFmpeg via UDP
   */
  public feed(
    payload: RtpPacket | string | Buffer,
    callback: (e?: Error | null) => void = e => {
      if (e) {
        console.error('Error sending packet:', e);
      }
    },
  ): void {
    let packet: RtpPacket;
    if (!(payload instanceof RtpPacket)) {
      packet = RtpPacket.deSerialize(Buffer.isBuffer(payload) ? payload : Buffer.from(payload));
    } else {
      packet = payload;
    }
    const message = packet.serialize();
    let port: number | undefined | null;
    if (packet.header.payloadType === Util.getPayloadType('opus')) {
      port = this.portUdpOpus;
    } else if (packet.header.payloadType === Util.getPayloadType('H264')) {
      port = this.portUdpH264;
    } else if (packet.header.payloadType === Util.getPayloadType('H265')) {
      port = this.portUdpH265;
    } else {
      return;
    }
    if (!port) return;
    this.socket.send(message, 0, message.length, port, '127.0.0.1', callback);
  }

  public destroy(): void {
    if (!this.stream) return;
    const ffmpegPid = this.stream.pid;
    const args = this.stream.spawnargs.slice(1).join(' ');
    void find('name', 'ffmpeg', true).then(list => {
      const proc = list.find(o => o.pid === ffmpegPid || o.ppid === ffmpegPid || o.cmd.includes(args));
      if (proc) {
        kill(proc.pid);
        if (this.userId) {
          this.receiver?.videoStreams?.delete(this.userId);
        }
        this.emit('closed');
      }
    });
  }
}

export default Recorder;
