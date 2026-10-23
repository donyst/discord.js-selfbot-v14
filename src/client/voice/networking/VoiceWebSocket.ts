import EventEmitter from 'node:events';
import { setTimeout, setInterval, clearInterval } from 'node:timers';
import type { MessageEvent as WSMessageEvent } from 'ws';
import WebSocket from '../../../WebSocket.js';
import { DiscordError as Error } from '../../../errors/index.js';
import { Opcodes, VoiceOpcodes } from '../../../util/Constants.js';
import type { VoiceConnection } from '../VoiceConnection.js';
import type { Client } from '../../Client.js';

export interface VoiceGatewayPacket {
  op: number;
  d: unknown;
  seq?: number;
  [key: string]: unknown;
}

/**
 * Represents a Voice Connection's WebSocket.
 * @extends {EventEmitter}
 * @private
 */
export class VoiceWebSocket extends EventEmitter {
  public connection: VoiceConnection;
  public attempts: number;
  private _sequenceNumber: number;
  public dead: boolean;
  public ws: import('ws').WebSocket | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  public constructor(connection: VoiceConnection) {
    super();

    this.connection = connection;
    this.attempts = 0;
    this._sequenceNumber = -1;
    this.dead = false;

    this.connection.on('closing', this.shutdown.bind(this));
  }

  public get client(): Client {
    return (this.connection as unknown as { client: Client }).client;
  }

  public shutdown(): void {
    this.emit('debug', '[WS] shutdown requested');
    this.dead = true;
    this.reset();
  }

  public reset(): void {
    this.emit('debug', '[WS] reset requested');
    if (this.ws) {
      if (this.ws.readyState !== WebSocket.CLOSED) this.ws.close();
      this.ws = null;
    }
    this.clearHeartbeat();
  }

  public connect(): void {
    this.emit('debug', '[WS] connect requested');
    if (this.dead) return;
    if (this.ws) this.reset();
    if (this.attempts >= 5) {
      this.emit('debug', new Error('VOICE_CONNECTION_ATTEMPTS_EXCEEDED', this.attempts));
      return;
    }

    this.attempts++;

    const auth = (this.connection as unknown as { authentication: { endpoint: string } }).authentication;
    this.ws = WebSocket.create(`wss://${auth.endpoint}/`, { v: 8 });
    this.emit('debug', `[WS] connecting, ${this.attempts} attempts, ${this.ws.url}`);
    this.ws.onopen = this.onOpen.bind(this);
    this.ws.onmessage = this.onMessage.bind(this);
    this.ws.onclose = this.onClose.bind(this);
    this.ws.onerror = this.onError.bind(this);
  }

  public send(data: string): Promise<string> {
    this.emit('debug', `[WS] >> ${data}`);
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) throw new Error('WS_NOT_OPEN', data);
      this.ws.send(data, (error?: globalThis.Error) => {
        if (error) reject(error);
        else resolve(data);
      });
    });
  }

  public async sendPacket(packet: unknown): Promise<string> {
    const json = JSON.stringify(packet);
    return this.send(json);
  }

  private onOpen(): void {
    const conn = this.connection as unknown as {
      authentication: { endpoint: string; token: string; sessionId: string };
      serverId?: string;
      channel: { guild?: { id: string }; id: string };
    };

    this.emit('debug', `[WS] opened at gateway ${conn.authentication.endpoint}`);
    this.sendPacket({
      op: Opcodes.DISPATCH,
      d: {
        server_id: conn.serverId || conn.channel.guild?.id || conn.channel.id,
        user_id: this.client.user?.id,
        token: conn.authentication.token,
        session_id: conn.authentication.sessionId,
        streams: [{ type: 'screen', rid: '100', quality: 100 }],
        video: true,
      },
    }).catch(() => {
      this.emit('error', new Error('VOICE_JOIN_SOCKET_CLOSED'));
    });
  }

  private onMessage(event: WSMessageEvent): void {
    try {
      const data = Array.isArray(event.data) ? Buffer.concat(event.data) : event.data;
      return this.onPacket(WebSocket.unpack(data, 'json') as VoiceGatewayPacket);
    } catch (error) {
      return this.onError(error);
    }
  }

  private onClose(event: { code: number; reason: string }): void {
    this.emit('debug', `[WS] closed with code ${event.code} and reason: ${event.reason}`);
    if (!this.dead) setTimeout(this.connect.bind(this), this.attempts * 1000).unref();
  }

  private onError(error: unknown): void {
    this.emit('debug', `[WS] Error: ${error}`);
    this.emit('error', error);
  }

  private onPacket(packet: VoiceGatewayPacket): void {
    this.emit('debug', `[WS] << ${JSON.stringify(packet)}`);
    if (packet.seq) this._sequenceNumber = packet.seq;
    switch (packet.op) {
      case VoiceOpcodes.HELLO: {
        const d = packet.d as { heartbeat_interval: number };
        this.setHeartbeat(d.heartbeat_interval);
        break;
      }
      case VoiceOpcodes.READY:
        this.emit('ready', packet.d);
        (this.connection as unknown as { setVideoStatus(v: boolean): void }).setVideoStatus(false);
        break;
      case VoiceOpcodes.SESSION_DESCRIPTION: {
        const d = packet.d as {
          secret_key: Uint8Array | number[];
          dave_protocol_version?: number;
          mls_external_sender_package?: string;
        };
        d.secret_key = new Uint8Array(d.secret_key);
        if (d.dave_protocol_version && this.connection.dave) {
          this.connection.dave.init({
            protocolVersion: d.dave_protocol_version,
            mlsExternalSenderPackage: d.mls_external_sender_package,
          });
        }
        this.emit('sessionDescription', d);
        break;
      }
      case VoiceOpcodes.DAVE_PREPARE_EPOCH: {
        const d = packet.d as { epoch: number; epoch_authenticator?: string };
        this.connection.dave?.prepareEpoch(d.epoch, d.epoch_authenticator);
        break;
      }
      case VoiceOpcodes.CLIENT_CONNECT: {
        const d = packet.d as { audio_ssrc: number; user_id: string; video_ssrc?: number };
        (this.connection as unknown as { ssrcMap: Map<number, unknown> }).ssrcMap.set(+d.audio_ssrc, {
          userId: d.user_id,
          speaking: 0,
          hasVideo: Boolean(d.video_ssrc),
        });
        break;
      }
      case VoiceOpcodes.CLIENT_DISCONNECT: {
        const d = packet.d as { user_id: string };
        const receiver = (this.connection as unknown as { receiver?: { packets: { streams: Map<string, { stream: { push(n: null): void } }> } } }).receiver;
        const streamInfo = receiver?.packets.streams.get(d.user_id);
        if (streamInfo) {
          receiver?.packets.streams.delete(d.user_id);
          streamInfo.stream.push(null);
        }
        break;
      }
      case VoiceOpcodes.SPEAKING:
        this.emit('startSpeaking', packet.d);
        break;
      case VoiceOpcodes.SOURCES:
        this.emit('startStreaming', packet.d);
        break;
      default:
        this.emit('unknownPacket', packet);
        break;
    }
  }

  public setHeartbeat(interval: number): void {
    if (!interval || Number.isNaN(interval)) {
      this.onError(new Error('VOICE_INVALID_HEARTBEAT'));
      return;
    }
    if (this.heartbeatInterval) {
      this.emit('warn', 'A voice heartbeat interval is being overwritten');
      clearInterval(this.heartbeatInterval);
    }
    this.heartbeatInterval = setInterval(this.sendHeartbeat.bind(this), interval).unref();
  }

  public clearHeartbeat(): void {
    if (!this.heartbeatInterval) {
      this.emit('warn', 'Tried to clear a heartbeat interval that does not exist');
      return;
    }
    clearInterval(this.heartbeatInterval);
    this.heartbeatInterval = null;
  }

  public sendHeartbeat(): void {
    this.sendPacket({
      op: VoiceOpcodes.HEARTBEAT,
      d: {
        t: Date.now(),
        seq_ack: this._sequenceNumber,
      },
    }).catch(() => {
      this.emit('warn', 'Tried to send heartbeat, but connection is not open');
      this.clearHeartbeat();
    });
  }
}

export default VoiceWebSocket;
