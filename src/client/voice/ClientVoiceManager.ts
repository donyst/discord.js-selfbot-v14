import VoiceConnection, { type VideoCodec, type VoiceBasedChannel } from './VoiceConnection.js';
import { DiscordError as Error } from '../../errors/index.js';
import { Events } from '../../util/Constants.js';
import type { Client } from '../Client.js';
import type { Snowflake } from '../../types/index.js';

export interface VoiceAdapter {
  destroy(): void;
  onVoiceServerUpdate(payload: VoiceServerPayload): void;
  onVoiceStateUpdate(payload: VoiceStateUpdatePayload): void;
}

export interface VoiceServerPayload {
  guild_id?: Snowflake;
  channel_id?: Snowflake;
  token: string;
  endpoint: string;
  [key: string]: unknown;
}

export interface VoiceStateUpdatePayload {
  guild_id?: Snowflake;
  channel_id?: Snowflake;
  session_id: string;
  user_id: Snowflake;
  [key: string]: unknown;
}

export interface JoinChannelConfig {
  selfMute?: boolean;
  selfDeaf?: boolean;
  selfVideo?: boolean;
  videoCodec?: VideoCodec;
}

/**
 * Manages voice connections for the client
 * Feat: Support both lib & djs/voice
 */
export class ClientVoiceManager {
  public readonly client: Client;
  public connection: VoiceConnection | null = null;
  public adapters: Map<Snowflake, VoiceAdapter> = new Map();

  public constructor(client: Client) {
    Object.defineProperty(this, 'client', { value: client });

    client.on(Events.SHARD_DISCONNECT, (_: unknown, shardId: number) => {
      for (const [guildId, adapter] of this.adapters.entries()) {
        if (client.guilds.cache.get(guildId)?.shardId === shardId) {
          // Because it has 1 shard => adapter.destroy();
        }
        adapter.destroy();
      }
    });
  }

  public onVoiceServer(payload: VoiceServerPayload): void {
    const { guild_id, channel_id, token, endpoint } = payload;
    this.client.emit(
      'debug',
      `[VOICE] voiceServer ${channel_id ? 'channel' : 'guild'}: ${
        channel_id || guild_id
      } token: ${token} endpoint: ${endpoint}`,
    );
    const connection = this.connection;
    if (connection) connection.setTokenAndEndpoint(token, endpoint);
    // Djs / voice
    if (payload.guild_id) {
      this.adapters.get(payload.guild_id)?.onVoiceServerUpdate(payload);
    } else if (payload.channel_id) {
      this.adapters.get(payload.channel_id)?.onVoiceServerUpdate(payload);
    }
  }

  public onVoiceStateUpdate(payload: VoiceStateUpdatePayload): void {
    const { guild_id, session_id, channel_id } = payload;
    // @discordjs/voice
    if (payload.guild_id && payload.session_id && payload.user_id === this.client.user?.id) {
      this.adapters.get(payload.guild_id)?.onVoiceStateUpdate(payload);
    } else if (payload.channel_id && payload.session_id && payload.user_id === this.client.user?.id) {
      this.adapters.get(payload.channel_id)?.onVoiceStateUpdate(payload);
    }
    // Main lib
    const connection = this.connection;
    this.client.emit('debug', `[VOICE] connection? ${Boolean(connection)}, ${guild_id} ${session_id} ${channel_id}`);
    if (!connection) return;
    if (!channel_id) {
      connection._disconnect();
      this.connection = null;
      return;
    }
    const channel = this.client.channels.cache.get(channel_id) as VoiceBasedChannel | undefined;
    if (channel) {
      connection.channel = channel;
      connection.setSessionId(session_id);
    } else {
      this.client.emit('debug', `[VOICE] disconnecting from guild ${guild_id} as channel ${channel_id} is uncached`);
      connection.disconnect();
    }
  }

  public joinChannel(
    channel: VoiceBasedChannel | Snowflake,
    config: JoinChannelConfig = {},
  ): Promise<VoiceConnection> {
    return new Promise<VoiceConnection>((resolve, reject) => {
      const resolvedChannel = this.client.channels.resolve(channel) as VoiceBasedChannel | null;
      if (!resolvedChannel) {
        throw new Error('VOICE_CHANNEL_MISSING');
      }
      if (!['DM', 'GROUP_DM'].includes(resolvedChannel.type) && !(resolvedChannel as { joinable?: boolean }).joinable) {
        throw new Error('VOICE_JOIN_CHANNEL', (resolvedChannel as { full?: string }).full);
      }

      let connection = this.connection;

      if (connection) {
        if (connection.channel.id !== resolvedChannel.id) {
          this.connection!.updateChannel(resolvedChannel);
        }
        resolve(connection);
        return;
      } else {
        connection = new VoiceConnection(this, resolvedChannel);
        if (config.videoCodec) connection.setVideoCodec(config.videoCodec);
        const channelId =
          'guild' in resolvedChannel && resolvedChannel.guild ? resolvedChannel.guild.id : resolvedChannel.id;
        connection.on('debug', (msg: string) =>
          this.client.emit('debug', `[VOICE (${channelId}:${connection!.status})]: ${msg}`),
        );
        connection.authenticate({
          self_mute: Boolean(config.selfMute),
          self_deaf: Boolean(config.selfDeaf),
          self_video: Boolean(config.selfVideo),
        });
        this.connection = connection;
      }

      connection.once('failed', (reason: unknown) => {
        this.connection = null;
        reject(reason);
      });

      connection.on('error', reject);

      connection.once('authenticated', () => {
        connection!.once('ready', () => {
          resolve(connection!);
          connection!.removeListener('error', reject);
        });
        connection!.once('disconnect', () => {
          this.connection = null;
        });
      });
    });
  }
}

export default ClientVoiceManager;
