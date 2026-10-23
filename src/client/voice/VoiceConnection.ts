import { EventEmitter } from 'node:events';
import { getCiphers } from 'node:crypto';
import { setTimeout, clearTimeout } from 'node:timers';
import type { Readable } from 'node:stream';
import { Collection } from '@discordjs/collection';
import { VoiceConnectionUDPClient as VoiceUDP } from './networking/VoiceUDPClient.js';
import { VoiceWebSocket } from './networking/VoiceWebSocket.js';
import MediaPlayer from './player/MediaPlayer.js';
import VoiceReceiver from './receiver/Receiver.js';
import { parseStreamKey } from './util/Function.js';
import PlayInterface, { type StreamOptions, type VideoOptions } from './util/PlayInterface.js';
import Silence from './util/Silence.js';
import { DiscordError as Error } from '../../errors/index.js';
import { Opcodes, VoiceOpcodes, VoiceStatus, Events } from '../../util/Constants.js';
import Speaking from '../../util/Speaking.js';
import Util from '../../util/Util.js';
import type { Client } from '../Client.js';
import type ClientVoiceManager from './ClientVoiceManager.js';
import type AudioDispatcher from './dispatcher/AudioDispatcher.js';
import type { VideoDispatcher } from './dispatcher/VideoDispatcher.js';
import type { BitFieldResolvable, Snowflake, UserResolvable } from '../../types/index.js';
import type { VoiceState } from '../../structures/VoiceState.js';
import type { VoiceChannel } from '../../structures/VoiceChannel.js';
import type { StageChannel } from '../../structures/StageChannel.js';
import type { DMChannel } from '../../structures/DMChannel.js';
import type { GroupDMChannel } from '../../structures/GroupDMChannel.js';
import type { SpeakingString } from '../../util/Speaking.js';

// Workaround for Discord now requiring silence to be sent before being able to receive audio
class SingleSilence extends Silence {
  public override _read(): void {
    super._read();
    this.push(null);
  }
}

const SUPPORTED_MODES: string[] = ['aead_xchacha20_poly1305_rtpsize'];

// Just in case there's some system that doesn't come with aes-256-gcm, conditionally add it as supported
if (getCiphers().includes('aes-256-gcm')) {
  SUPPORTED_MODES.unshift('aead_aes256_gcm_rtpsize');
}

const SUPPORTED_CODECS: readonly string[] = ['VP8', 'H264'] as const;

export type VideoCodec = 'VP8' | 'H264' | 'VP9' | 'H265' | 'AV1' | string;

export type VoiceBasedChannel = VoiceChannel | StageChannel | DMChannel | GroupDMChannel;

export interface VoiceAuthentication {
  token?: string;
  endpoint?: string;
  sessionId?: string;
  ssrc?: number;
  ip?: string;
  port?: number;
  modes?: string[];
  mode?: string;
  secret_key?: Buffer | Uint8Array;
  [key: string]: unknown;
}

export interface VoiceSockets {
  ws?: VoiceWebSocket | null;
  udp?: VoiceUDP | null;
}

export interface SSRCData {
  userId: Snowflake;
  speaking?: number | boolean;
  hasVideo?: boolean;
}

export interface VoiceStateUpdateOptions {
  guild_id?: Snowflake | null;
  channel_id?: Snowflake | null;
  self_mute?: boolean;
  self_deaf?: boolean;
  self_video?: boolean;
  flags?: number;
}

export interface StreamState {
  isPaused: boolean | null;
  region: string | null;
  viewerIds: Snowflake[];
}

export interface StreamUpdateData {
  paused: boolean;
  region: string | null;
  viewer_ids: Snowflake[];
}

interface RawGatewayPacket {
  t?: string;
  d?: {
    stream_key?: string;
    rtc_server_id?: string;
    token?: string;
    endpoint?: string;
    paused?: boolean;
    region?: string | null;
    viewer_ids?: Snowflake[];
    [key: string]: unknown;
  };
}

/**
 * Represents a connection to a guild's voice server.
 */
export class VoiceConnection extends EventEmitter {
  public voiceManager: ClientVoiceManager;
  public channel: VoiceBasedChannel;
  public status: number;
  public speaking: Readonly<Speaking>;
  public videoStatus: boolean | null;
  public authentication: VoiceAuthentication;
  public player: MediaPlayer;
  public ssrcMap: Map<number, SSRCData>;
  public _speaking: Map<Snowflake, Readonly<Speaking>>;
  public sockets: VoiceSockets;
  public receiver: VoiceReceiver;
  public videoCodec: VideoCodec;
  public connectTimeout?: NodeJS.Timeout;
  protected _streamConnection: StreamConnection | null = null;
  protected _streamWatchConnection: Collection<Snowflake, StreamConnectionReadonly> = new Collection();

  public get streamConnection(): StreamConnection | null {
    return this._streamConnection;
  }

  public set streamConnection(val: StreamConnection | null) {
    this._streamConnection = val;
  }

  public get streamWatchConnection(): Collection<Snowflake, StreamConnectionReadonly> {
    return this._streamWatchConnection;
  }

  public set streamWatchConnection(val: Collection<Snowflake, StreamConnectionReadonly>) {
    this._streamWatchConnection = val;
  }
  protected eventHook = false;

  public constructor(voiceManager: ClientVoiceManager, channel: VoiceBasedChannel) {
    super();

    this.voiceManager = voiceManager;
    this.channel = channel;
    this.status = VoiceStatus.AUTHENTICATING;
    this.speaking = new Speaking().freeze();
    this.videoStatus = null;
    this.authentication = {};
    this.player = new MediaPlayer(this, this.constructor.name === 'StreamConnection');

    this.player.on('debug', (m: string) => {
      this.emit('debug', `media player - ${m}`);
    });

    this.player.on('error', (e: unknown) => {
      this.emit('warn', e);
    });

    this.once('closing', () => this.player.destroy());

    this.ssrcMap = new Map();
    this._speaking = new Map();
    this.sockets = {};
    this.receiver = new VoiceReceiver(this);
    this.videoCodec = 'H264';
    this.streamConnection = null;
    this.streamWatchConnection = new Collection();
  }

  public get client(): Client {
    return this.voiceManager.client;
  }

  public get dispatcher(): AudioDispatcher | null {
    return this.player.dispatcher;
  }

  public get videoDispatcher(): VideoDispatcher | null {
    return this.player.videoDispatcher;
  }

  public setSpeaking(value: BitFieldResolvable<SpeakingString, number>): void {
    if (this.speaking.equals(value)) return;
    if (this.status !== VoiceStatus.CONNECTED) return;
    this.speaking = new Speaking(value).freeze();
    this.sockets.ws
      ?.sendPacket({
        op: VoiceOpcodes.SPEAKING,
        d: {
          speaking: this.speaking.bitfield,
          delay: 0,
          ssrc: this.authentication.ssrc,
        },
      })
      .catch((e: unknown) => {
        this.emit('debug', e);
      });
  }

  public setVideoCodec(value: VideoCodec): this {
    if (!SUPPORTED_CODECS.includes(value)) throw new Error('INVALID_VIDEO_CODEC', SUPPORTED_CODECS.slice());
    this.videoCodec = value;
    return this;
  }

  public setVideoStatus(value: boolean): void {
    if (value === this.videoStatus) return;
    if (this.status !== VoiceStatus.CONNECTED) return;
    this.videoStatus = value;
    if (!value) {
      this.sockets.ws
        ?.sendPacket({
          op: VoiceOpcodes.SOURCES,
          d: {
            audio_ssrc: this.authentication.ssrc,
            video_ssrc: 0,
            rtx_ssrc: 0,
            streams: [],
          },
        })
        .catch((e: unknown) => {
          this.emit('debug', e);
        });
    } else {
      this.sockets.ws
        ?.sendPacket({
          op: VoiceOpcodes.SOURCES,
          d: {
            audio_ssrc: this.authentication.ssrc,
            video_ssrc: (this.authentication.ssrc ?? 0) + 1,
            rtx_ssrc: (this.authentication.ssrc ?? 0) + 2,
            streams: [
              {
                type: 'video',
                rid: '100',
                ssrc: (this.authentication.ssrc ?? 0) + 1,
                active: true,
                quality: 100,
                rtx_ssrc: (this.authentication.ssrc ?? 0) + 2,
                max_bitrate: 8000000,
                max_framerate: 60,
                max_resolution: {
                  type: 'source',
                  width: 0,
                  height: 0,
                },
              },
            ],
          },
        })
        .catch((e: unknown) => {
          this.emit('debug', e);
        });
    }
  }

  public get voice(): VoiceState | null {
    return this.client.user?.voice ?? null;
  }

  public sendVoiceStateUpdate(options: VoiceStateUpdateOptions = {}): unknown {
    const guildId = 'guild' in this.channel && this.channel.guild ? this.channel.guild.id : null;
    const finalOptions = Util.mergeDefault(
      {
        guild_id: guildId,
        channel_id: this.channel.id,
        self_mute: this.voice ? this.voice.selfMute : false,
        self_deaf: this.voice ? this.voice.selfDeaf : false,
        self_video: this.voice ? this.voice.selfVideo : false,
        flags: 2,
      },
      options as unknown as Record<string, unknown>,
    );

    this.emit('debug', `Sending voice state update: ${JSON.stringify(finalOptions)}`);

    return this.channel.client.ws.broadcast({
      op: Opcodes.VOICE_STATE_UPDATE,
      d: finalOptions,
    });
  }

  public setTokenAndEndpoint(token: string, endpoint: string): void {
    this.emit('debug', `Token "${token}" and endpoint "${endpoint}"`);
    if (!endpoint) {
      return;
    }

    if (!token) {
      this.authenticateFailed('VOICE_TOKEN_ABSENT');
      return;
    }

    const match = endpoint.match(/([^:]*)/);
    const resolvedEndpoint = match ? match[0] : '';
    this.emit('debug', `Endpoint resolved as ${resolvedEndpoint}`);

    if (!resolvedEndpoint) {
      this.authenticateFailed('VOICE_INVALID_ENDPOINT');
      return;
    }

    if (this.status === VoiceStatus.AUTHENTICATING) {
      this.authentication.token = token;
      this.authentication.endpoint = resolvedEndpoint;
      this.checkAuthenticated();
    } else if (token !== this.authentication.token || resolvedEndpoint !== this.authentication.endpoint) {
      this.reconnect(token, resolvedEndpoint);
    }
  }

  public setSessionId(sessionId: string): void {
    this.emit('debug', `Setting sessionId ${sessionId} (stored as "${String(this.authentication.sessionId)}")`);
    if (!sessionId) {
      this.authenticateFailed('VOICE_SESSION_ABSENT');
      return;
    }

    if (this.status === VoiceStatus.AUTHENTICATING) {
      this.authentication.sessionId = sessionId;
      this.checkAuthenticated();
    } else if (sessionId !== this.authentication.sessionId) {
      this.authentication.sessionId = sessionId;
      this.emit('newSession', sessionId);
    }
  }

  public checkAuthenticated(): void {
    const { token, endpoint, sessionId } = this.authentication;
    this.emit('debug', `Authenticated with sessionId ${String(sessionId)}`);
    if (token && endpoint && sessionId) {
      this.status = VoiceStatus.CONNECTING;
      this.emit('authenticated');
      this.connect();
    }
  }

  public authenticateFailed(reason: string): void {
    if (this.connectTimeout) clearTimeout(this.connectTimeout);
    this.emit('debug', `Authenticate failed - ${reason}`);
    if (this.status === VoiceStatus.AUTHENTICATING) {
      this.emit('failed', new Error(reason));
    } else {
      this.emit('error', new Error(reason));
    }
    this.status = VoiceStatus.DISCONNECTED;
  }

  public updateChannel(channel: VoiceBasedChannel): void {
    this.channel = channel;
    this.sendVoiceStateUpdate();
  }

  public authenticate(options: VoiceStateUpdateOptions = {}): void {
    this.sendVoiceStateUpdate(options);
    this.connectTimeout = setTimeout(() => this.authenticateFailed('VOICE_CONNECTION_TIMEOUT'), 15_000).unref();
  }

  public reconnect(token: string, endpoint: string): void {
    this.authentication.token = token;
    this.authentication.endpoint = endpoint;
    this.speaking = new Speaking().freeze();
    this.status = VoiceStatus.RECONNECTING;
    this.emit('debug', `Reconnecting to ${endpoint}`);
    this.emit('reconnecting');
    this.connect();
  }

  public disconnect(): void {
    this.emit('closing');
    this.emit('debug', 'disconnect() triggered');
    if (this.connectTimeout) clearTimeout(this.connectTimeout);
    const conn = this.voiceManager.connection;
    if (conn === this) this.voiceManager.connection = null;
    this.sendVoiceStateUpdate({
      channel_id: null,
    });
    this._disconnect();
  }

  public _disconnect(): void {
    this.cleanup();
    this.status = VoiceStatus.DISCONNECTED;
    this.emit('disconnect');
  }

  public cleanup(): void {
    this.player.destroy();
    this.speaking = new Speaking().freeze();
    const { ws, udp } = this.sockets;

    this.emit('debug', 'Connection clean up');

    if (ws) {
      ws.removeAllListeners('error');
      ws.removeAllListeners('ready');
      ws.removeAllListeners('sessionDescription');
      ws.removeAllListeners('speaking');
      ws.shutdown();
    }

    if (udp) udp.removeAllListeners('error');

    this.sockets.ws = null;
    this.sockets.udp = null;
  }

  public connect(): void {
    this.emit('debug', 'Connect triggered');
    if (this.status !== VoiceStatus.RECONNECTING) {
      if (this.sockets.ws) throw new Error('WS_CONNECTION_EXISTS');
      if (this.sockets.udp) throw new Error('UDP_CONNECTION_EXISTS');
    }

    if (this.sockets.ws) this.sockets.ws.shutdown();
    if (this.sockets.udp) this.sockets.udp.shutdown();

    this.sockets.ws = new VoiceWebSocket(this);
    this.sockets.udp = new VoiceUDP(this);

    const { ws, udp } = this.sockets;

    ws.on('debug', (msg: string) => this.emit('debug', msg));
    udp.on('debug', (msg: string) => this.emit('debug', msg));
    ws.on('error', (err: unknown) => this.emit('error', err));
    udp.on('error', (err: unknown) => this.emit('error', err));
    ws.on('ready', this.onReady.bind(this));
    ws.on('sessionDescription', this.onSessionDescription.bind(this));
    ws.on('startSpeaking', this.onStartSpeaking.bind(this));
    ws.on('startStreaming', this.onStartStreaming.bind(this));

    this.sockets.ws.connect();
  }

  public onReady(data: VoiceAuthentication & { modes?: string[]; ip?: string }): void {
    Object.assign(this.authentication, data);
    if (data.modes) {
      for (const mode of data.modes) {
        if (SUPPORTED_MODES.includes(mode)) {
          this.authentication.mode = mode;
          this.emit('debug', `Selecting the ${mode} mode`);
          break;
        }
      }
    }
    if (data.ip && this.sockets.udp) {
      this.sockets.udp.createUDPSocket(data.ip);
    }
  }

  public onSessionDescription(data: VoiceAuthentication): void {
    Object.assign(this.authentication, data);
    this.status = VoiceStatus.CONNECTED;
    const ready = (): void => {
      if (this.connectTimeout) clearTimeout(this.connectTimeout);
      this.emit('debug', `Ready with authentication details: ${JSON.stringify(this.authentication)}`);
      this.emit('ready');
    };
    if (this.dispatcher || this.videoDispatcher) {
      ready();
    } else {
      const dispatcher = this.playAudio(new SingleSilence(), { type: 'opus', volume: false });
      dispatcher.once('finish', ready);
    }
  }

  public onStartSpeaking({
    user_id,
    ssrc,
    speaking,
  }: {
    user_id: Snowflake;
    ssrc: number | string;
    speaking?: number | boolean;
  }): void {
    const ssrcNum = Number(ssrc);
    this.ssrcMap.set(ssrcNum, {
      ...(this.ssrcMap.get(ssrcNum) ?? { userId: user_id }),
      userId: user_id,
      speaking,
    });
  }

  public onStartStreaming({
    video_ssrc,
    user_id,
    audio_ssrc,
  }: {
    video_ssrc?: number;
    user_id: Snowflake;
    audio_ssrc: number | string;
  }): void {
    const audioSsrcNum = Number(audio_ssrc);
    this.ssrcMap.set(audioSsrcNum, {
      ...(this.ssrcMap.get(audioSsrcNum) ?? { userId: user_id }),
      userId: user_id,
      hasVideo: Boolean(video_ssrc),
    });
  }

  public onSpeaking({ user_id, speaking }: { user_id: Snowflake; ssrc?: number | string; speaking?: number }): void {
    const speakingBitfield = new Speaking(speaking).freeze();
    const guild = 'guild' in this.channel ? this.channel.guild : null;
    const user = this.client.users.cache.get(user_id);
    const old = this._speaking.get(user_id) ?? new Speaking(0).freeze();
    this._speaking.set(user_id, speakingBitfield);

    if (this.status === VoiceStatus.CONNECTED) {
      this.emit('speaking', user, speakingBitfield);
      if (!speakingBitfield.has(Speaking.FLAGS.SPEAKING)) {
        this.receiver.packets._stoppedSpeaking(user_id);
      }
    }

    if (guild && user && !speakingBitfield.equals(old)) {
      const member = guild.members.cache.get(user.id);
      if (member) {
        this.client.emit(Events.GUILD_MEMBER_SPEAKING, member, speakingBitfield);
      }
    }
  }

  public playAudio(resource: Readable | string, options: StreamOptions = {}): AudioDispatcher {
    return PlayInterface.prototype.playAudio.call(this, resource, options);
  }

  public playVideo(resource: Readable | string, options: VideoOptions = {}): VideoDispatcher {
    return PlayInterface.prototype.playVideo.call(this, resource, options);
  }

  protected _setupRawStreamListener(): void {
    if (this.eventHook) return;
    this.eventHook = true;
    this.channel.client.on('raw', (packet: RawGatewayPacket) => {
      if (typeof packet !== 'object' || !packet.t || !packet.d || typeof packet.d.stream_key !== 'string') {
        return;
      }
      const event = packet.t;
      const data = packet.d;
      const StreamKey = parseStreamKey(packet.d.stream_key);
      if (
        StreamKey.userId === this.channel.client.user?.id &&
        this.channel.id === StreamKey.channelId &&
        this.streamConnection
      ) {
        switch (event) {
          case 'STREAM_CREATE': {
            if (this.authentication.sessionId) {
              this.streamConnection.setSessionId(this.authentication.sessionId);
            }
            this.streamConnection.serverId = data.rtc_server_id ?? null;
            break;
          }
          case 'STREAM_SERVER_UPDATE': {
            if (data.token && data.endpoint) {
              this.streamConnection.setTokenAndEndpoint(data.token, data.endpoint);
            }
            break;
          }
          case 'STREAM_DELETE': {
            this.streamConnection.disconnect();
            break;
          }
          case 'STREAM_UPDATE': {
            this.streamConnection.update({
              paused: Boolean(data.paused),
              region: data.region ?? null,
              viewer_ids: data.viewer_ids ?? [],
            });
            break;
          }
        }
      }
      if (this.streamWatchConnection.has(StreamKey.userId) && this.channel.id === StreamKey.channelId) {
        const streamConn = this.streamWatchConnection.get(StreamKey.userId);
        if (streamConn) {
          switch (event) {
            case 'STREAM_CREATE': {
              if (this.authentication.sessionId) {
                streamConn.setSessionId(this.authentication.sessionId);
              }
              streamConn.serverId = data.rtc_server_id ?? null;
              break;
            }
            case 'STREAM_SERVER_UPDATE': {
              if (data.token && data.endpoint) {
                streamConn.setTokenAndEndpoint(data.token, data.endpoint);
              }
              break;
            }
            case 'STREAM_DELETE': {
              streamConn.disconnect();
              streamConn.receiver.packets.destroyAllStream();
              break;
            }
            case 'STREAM_UPDATE': {
              streamConn.update({
                paused: Boolean(data.paused),
                region: data.region ?? null,
                viewer_ids: data.viewer_ids ?? [],
              });
              break;
            }
          }
        }
      }
    });
  }

  public createStreamConnection(): Promise<StreamConnection> {
    return new Promise<StreamConnection>((resolve, reject) => {
      if (this.streamConnection) {
        resolve(this.streamConnection);
        return;
      }

      const connection = (this.streamConnection = new StreamConnection(this.voiceManager, this.channel, this));
      connection.setVideoCodec(this.videoCodec);
      this._setupRawStreamListener();

      connection.sendSignalScreenshare();
      connection.sendScreenshareState(true);

      const guildId = 'guild' in this.channel && this.channel.guild ? this.channel.guild.id : this.channel.id;
      connection.on('debug', (msg: string) =>
        this.channel.client.emit('debug', `[VOICE STREAM (${guildId}:${connection.status})]: ${msg}`),
      );
      connection.once('failed', (reason: unknown) => {
        this.streamConnection = null;
        reject(reason);
      });

      connection.on('error', reject);

      connection.once('authenticated', () => {
        connection.once('ready', () => {
          resolve(connection);
          connection.removeListener('error', reject);
        });
        connection.once('disconnect', () => {
          this.streamConnection = null;
        });
      });
    });
  }

  public async joinStreamConnection(user: UserResolvable): Promise<StreamConnectionReadonly> {
    const userId = this.client.users.resolveId(user);
    if (!userId) {
      throw new Error('VOICE_USER_MISSING');
    }
    const voiceState =
      ('guild' in this.channel && this.channel.guild ? this.channel.guild.voiceStates.cache.get(userId) : undefined) ??
      this.client.voiceStates.cache.get(userId);
    if (!voiceState || !voiceState.streaming) {
      throw new Error('VOICE_USER_NOT_STREAMING');
    }

    return new Promise<StreamConnectionReadonly>((resolve, reject) => {
      const existing = this.streamWatchConnection.get(userId);
      if (existing) {
        resolve(existing);
        return;
      }

      const connection = new StreamConnectionReadonly(this.voiceManager, this.channel, this, userId);
      this.streamWatchConnection.set(userId, connection);
      connection.setVideoCodec(this.videoCodec);
      this._setupRawStreamListener();

      connection.sendSignalScreenshare();

      const guildId = 'guild' in this.channel && this.channel.guild ? this.channel.guild.id : this.channel.id;
      connection.on('debug', (msg: string) =>
        this.channel.client.emit('debug', `[VOICE STREAM WATCH (${userId}>${guildId}:${connection.status})]: ${msg}`),
      );
      connection.once('failed', (reason: unknown) => {
        this.streamWatchConnection.delete(userId);
        reject(reason);
      });

      connection.on('error', reject);

      connection.once('authenticated', () => {
        connection.once('ready', () => {
          resolve(connection);
          connection.removeListener('error', reject);
        });
        connection.once('disconnect', () => {
          this.streamWatchConnection.delete(userId);
        });
      });
    });
  }
}

/**
 * Represents a screenshare stream connection from this client.
 */
export class StreamConnection extends VoiceConnection {
  #requestDisconnect = false;
  public readonly voiceConnection: VoiceConnection;
  public serverId: string | null = null;
  public isPaused: boolean | null = null;
  public viewerIds: Snowflake[] = [];
  public region: string | null = null;

  public constructor(voiceManager: ClientVoiceManager, channel: VoiceBasedChannel, voiceConnection: VoiceConnection) {
    super(voiceManager, channel);
    this.voiceConnection = voiceConnection;
    Object.defineProperty(this, 'voiceConnection', {
      value: voiceConnection,
      writable: false,
    });
  }

  public override createStreamConnection(): Promise<StreamConnection> {
    return Promise.resolve(this);
  }

  public override joinStreamConnection(): Promise<StreamConnectionReadonly> {
    throw new Error('STREAM_CANNOT_JOIN');
  }

  public override get streamConnection(): this {
    return this;
  }

  public override set streamConnection(_value: StreamConnection | null) {}

  public override get streamWatchConnection(): Collection<Snowflake, StreamConnectionReadonly> {
    return new Collection();
  }

  public override set streamWatchConnection(_value: Collection<Snowflake, StreamConnectionReadonly>) {}

  public override disconnect(): void {
    if (this.#requestDisconnect) return;
    this.emit('closing');
    this.emit('debug', 'Stream: disconnect() triggered');
    if (this.connectTimeout) clearTimeout(this.connectTimeout);
    if (this.voiceConnection.streamConnection === this) this.voiceConnection.streamConnection = null;
    this.sendStopScreenshare();
    this._disconnect();
  }

  public sendSignalScreenshare(): unknown {
    const guildId = 'guild' in this.channel && this.channel.guild ? this.channel.guild.id : null;
    const data = {
      type: ['DM', 'GROUP_DM'].includes(this.channel.type) ? 'call' : 'guild',
      guild_id: guildId,
      channel_id: this.channel.id,
      preferred_region: null,
    };
    this.emit('debug', `Signal Stream: ${JSON.stringify(data)}`);
    return this.channel.client.ws.broadcast({
      op: Opcodes.STREAM_CREATE,
      d: data,
    });
  }

  public sendScreenshareState(isPaused = false): void {
    if (isPaused === this.isPaused) return;
    this.emit(
      'streamUpdate',
      {
        isPaused: this.isPaused,
        region: this.region,
        viewerIds: this.viewerIds,
      },
      {
        isPaused,
        region: this.region,
        viewerIds: this.viewerIds,
      },
    );
    this.isPaused = isPaused;
    this.channel.client.ws.broadcast({
      op: Opcodes.STREAM_SET_PAUSED,
      d: {
        stream_key: this.streamKey,
        paused: isPaused,
      },
    });
  }

  public sendStopScreenshare(): void {
    this.#requestDisconnect = true;
    this.channel.client.ws.broadcast({
      op: Opcodes.STREAM_DELETE,
      d: {
        stream_key: this.streamKey,
      },
    });
  }

  public update(data: StreamUpdateData): void {
    this.emit(
      'streamUpdate',
      {
        isPaused: this.isPaused,
        region: this.region,
        viewerIds: this.viewerIds.slice(),
      },
      {
        isPaused: data.paused,
        region: data.region,
        viewerIds: data.viewer_ids,
      },
    );
    this.viewerIds = data.viewer_ids;
    this.region = data.region;
  }

  public get streamKey(): string {
    const guildPart = 'guild' in this.channel && this.channel.guild ? `guild:${this.channel.guild.id}` : 'call';
    return `${['DM', 'GROUP_DM'].includes(this.channel.type) ? 'call' : guildPart}:${
      this.channel.id
    }:${this.channel.client.user!.id}`;
  }
}

/**
 * Represents a connection to watch another user's stream.
 */
export class StreamConnectionReadonly extends VoiceConnection {
  #requestDisconnect = false;
  public readonly voiceConnection: VoiceConnection;
  public userId: Snowflake;
  public serverId: string | null = null;
  public isPaused = false;
  public viewerIds: Snowflake[] = [];
  public region: string | null = null;

  public constructor(
    voiceManager: ClientVoiceManager,
    channel: VoiceBasedChannel,
    voiceConnection: VoiceConnection,
    userId: Snowflake,
  ) {
    super(voiceManager, channel);
    this.voiceConnection = voiceConnection;
    this.userId = userId;
    Object.defineProperty(this, 'voiceConnection', {
      value: voiceConnection,
      writable: false,
    });
  }

  public override createStreamConnection(): Promise<StreamConnection> {
    throw new Error('STREAM_CONNECTION_READONLY');
  }

  public override joinStreamConnection(): Promise<StreamConnectionReadonly> {
    return Promise.resolve(this);
  }

  public override get streamConnection(): null {
    return null;
  }

  public override set streamConnection(_value: StreamConnection | null) {}

  public override get streamWatchConnection(): Collection<Snowflake, StreamConnectionReadonly> {
    return new Collection();
  }

  public override set streamWatchConnection(_value: Collection<Snowflake, StreamConnectionReadonly>) {}

  public override disconnect(): void {
    if (this.#requestDisconnect) return;
    this.emit('closing');
    this.emit('debug', 'Stream: disconnect() triggered');
    if (this.connectTimeout) clearTimeout(this.connectTimeout);
    this.voiceConnection.streamWatchConnection.delete(this.userId);
    this.sendStopScreenshare();
    this._disconnect();
  }

  public sendSignalScreenshare(): unknown {
    this.emit('debug', `Signal Stream Watch: ${this.streamKey}`);
    return this.channel.client.ws.broadcast({
      op: Opcodes.STREAM_WATCH,
      d: {
        stream_key: this.streamKey,
      },
    });
  }

  public sendStopScreenshare(): void {
    this.#requestDisconnect = true;
    this.channel.client.ws.broadcast({
      op: Opcodes.STREAM_DELETE,
      d: {
        stream_key: this.streamKey,
      },
    });
  }

  public update(data: StreamUpdateData): void {
    this.emit(
      'streamUpdate',
      {
        isPaused: this.isPaused,
        region: this.region,
        viewerIds: this.viewerIds.slice(),
      },
      {
        isPaused: data.paused,
        region: data.region,
        viewerIds: data.viewer_ids,
      },
    );
    this.isPaused = data.paused;
    this.viewerIds = data.viewer_ids;
    this.region = data.region;
  }

  public get streamKey(): string {
    const guildPart = 'guild' in this.channel && this.channel.guild ? `guild:${this.channel.guild.id}` : 'call';
    return `${['DM', 'GROUP_DM'].includes(this.channel.type) ? 'call' : guildPart}:${
      this.channel.id
    }:${this.userId}`;
  }
}

PlayInterface.applyToClass(VoiceConnection);
PlayInterface.applyToClass(StreamConnection);

export default VoiceConnection;
