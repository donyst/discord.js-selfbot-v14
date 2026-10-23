import udp, { type Socket } from 'node:dgram';
import EventEmitter from 'node:events';
import { isIP } from 'node:net';
import { Buffer } from 'node:buffer';
import { DiscordError as Error } from '../../../errors/index.js';
import { VoiceOpcodes } from '../../../util/Constants.js';
import Util from '../../../util/Util.js';
import type { VoiceConnection } from '../VoiceConnection.js';

export interface LocalPacketResult {
  address?: string;
  port?: number;
  error?: unknown;
}

export function parseLocalPacket(message: Buffer | Uint8Array): LocalPacketResult {
  try {
    const packet = Buffer.from(message);
    const address = packet.subarray(8, packet.indexOf(0, 8)).toString('utf8');
    if (!isIP(address)) {
      throw new Error('UDP_ADDRESS_MALFORMED');
    }
    const port = packet.readUInt16BE(packet.length - 2);
    return { address, port };
  } catch (error) {
    return { error };
  }
}

/**
 * Represents a UDP client for a Voice Connection.
 * @extends {EventEmitter}
 */
export class VoiceConnectionUDPClient extends EventEmitter {
  public voiceConnection: VoiceConnection;
  public socket: Socket | null;
  public discordAddress: string | null;
  public localAddress: string | null;
  public localPort: number | null;

  public constructor(voiceConnection: VoiceConnection) {
    super();

    this.voiceConnection = voiceConnection;
    this.socket = null;
    this.discordAddress = null;
    this.localAddress = null;
    this.localPort = null;

    this.voiceConnection.on('closing', this.shutdown.bind(this));
  }

  public shutdown(): void {
    this.emit('debug', '[UDP] shutdown requested');
    if (this.socket) {
      this.socket.removeAllListeners('message');
      try {
        this.socket.close();
      } finally {
        this.socket = null;
      }
    }
  }

  public get discordPort(): number | undefined {
    return (this.voiceConnection as unknown as { authentication: { port?: number } }).authentication?.port;
  }

  public send(packet: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      if (!this.socket) throw new Error('UDP_SEND_FAIL');
      if (!this.discordAddress || !this.discordPort) throw new Error('UDP_ADDRESS_MALFORMED');
      this.socket.send(packet, 0, packet.length, this.discordPort, this.discordAddress, error => {
        if (error) {
          this.emit('debug', `[UDP] >> ERROR: ${error}`);
          reject(error);
        } else {
          resolve(packet);
        }
      });
    });
  }

  public async createUDPSocket(address: string): Promise<void> {
    this.discordAddress = address;
    const socket = (this.socket = udp.createSocket('udp4'));
    socket.on('error', e => {
      this.emit('debug', `[UDP] Error: ${e}`);
      this.emit('error', e);
    });
    socket.on('close', () => {
      this.emit('debug', '[UDP] socket closed');
    });
    this.emit('debug', '[UDP] created socket');

    socket.once('message', message => {
      this.emit('debug', `[UDP] message: [${[...message]}] (${message})`);
      if (message.readUInt16BE(0) !== 2) {
        throw new Error('UDP_WRONG_HANDSHAKE');
      }

      const vc = this.voiceConnection as unknown as {
        sockets: { ws?: { sendPacket(p: unknown): void } };
        authentication: { mode: string; ssrc: number };
        videoCodec?: string;
        receiver: { packets: { push(b: Buffer): void } };
      };

      if (!vc.sockets.ws) return;

      const packet = parseLocalPacket(message);
      if (packet.error) {
        this.emit('debug', `[UDP] ERROR: ${packet.error}`);
        this.emit('error', packet.error);
        return;
      }

      this.emit('debug', `[UDP] Parse local packet: ${packet.address}:${packet.port}`);

      this.localAddress = packet.address ?? null;
      this.localPort = packet.port ?? null;

      vc.sockets.ws.sendPacket({
        op: VoiceOpcodes.SELECT_PROTOCOL,
        d: {
          protocol: 'udp',
          codecs: Util.getAllPayloadType(),
          data: {
            address: packet.address,
            port: packet.port,
            mode: vc.authentication.mode,
          },
        },
      });

      Object.defineProperty(this.voiceConnection, 'videoCodec', {
        value: vc.videoCodec,
        writable: false,
      });

      this.emit('debug', `[UDP] << ${JSON.stringify(packet)}`);

      socket.on('message', buffer => vc.receiver.packets.push(buffer));
    });

    const vcAuth = (this.voiceConnection as unknown as { authentication: { ssrc: number } }).authentication;
    const blankMessage = Buffer.alloc(74);
    blankMessage.writeUInt16BE(1, 0);
    blankMessage.writeUInt16BE(70, 2);
    blankMessage.writeUInt32BE(vcAuth.ssrc, 4);
    this.emit('debug', `Sending IP discovery packet: [${[...blankMessage]}]`);
    await this.send(blankMessage);
    this.emit('debug', 'Successfully sent IP discovery packet');
  }
}

export default VoiceConnectionUDPClient;
