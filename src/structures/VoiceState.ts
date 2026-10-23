import type { Snowflake } from 'discord-api-types/v10';
import Base from './Base.js';
import { DiscordError, TypeError } from '../errors/index.js';
import type { Guild } from './Guild.js';
import type { GuildMember } from './GuildMember.js';
import type User from './User.js';
import type VoiceChannel from './VoiceChannel.js';
import type StageChannel from './StageChannel.js';
import type DMChannel from './DMChannel.js';
import type GroupDMChannel from './GroupDMChannel.js';
import type { GuildVoiceChannelResolvable } from '../types/index.js';

export interface RawVoiceStateData {
  user_id: Snowflake;
  deaf?: boolean;
  mute?: boolean;
  self_deaf?: boolean;
  self_mute?: boolean;
  self_video?: boolean;
  session_id?: string | null;
  self_stream?: boolean;
  channel_id?: Snowflake | null;
  suppress?: boolean;
  request_to_speak_timestamp?: string | null;
}

/**
 * Represents the voice state for a Guild Member.
 * @extends {Base}
 */
export class VoiceState extends Base {
  /**
   * The guild of this voice state
   */
  public guild: Guild;

  /**
   * Whether this member is deafened server-wide
   */
  public serverDeaf!: boolean | null;

  /**
   * Whether this member is muted server-wide
   */
  public serverMute!: boolean | null;

  /**
   * Whether this member is self-deafened
   */
  public selfDeaf!: boolean | null;

  /**
   * Whether this member is self-muted
   */
  public selfMute!: boolean | null;

  /**
   * Whether this member's camera is enabled
   */
  public selfVideo!: boolean | null;

  /**
   * The session id for this member's connection
   */
  public sessionId!: string | null;

  /**
   * Whether this member is streaming using "Screen Share"
   */
  public streaming!: boolean | null;

  /**
   * The VoiceChannel or StageChannel id the member is in
   */
  public channelId!: Snowflake | null;

  /**
   * Whether this member is suppressed from speaking. This property is specific to stage channels only.
   */
  public suppress!: boolean;

  /**
   * The time at which the member requested to speak. This property is specific to stage channels only.
   */
  public requestToSpeakTimestamp!: number | null;

  public constructor(guild: Guild, data: RawVoiceStateData) {
    super(guild.client);
    this.guild = guild;
    this.id = data.user_id;
    this._patch(data);
  }

  public _patch(data: Partial<RawVoiceStateData>): this {
    if ('deaf' in data) {
      this.serverDeaf = data.deaf ?? null;
    } else {
      this.serverDeaf ??= null;
    }

    if ('mute' in data) {
      this.serverMute = data.mute ?? null;
    } else {
      this.serverMute ??= null;
    }

    if ('self_deaf' in data) {
      this.selfDeaf = data.self_deaf ?? null;
    } else {
      this.selfDeaf ??= null;
    }

    if ('self_mute' in data) {
      this.selfMute = data.self_mute ?? null;
    } else {
      this.selfMute ??= null;
    }

    if ('self_video' in data) {
      this.selfVideo = data.self_video ?? null;
    } else {
      this.selfVideo ??= null;
    }

    if ('session_id' in data) {
      this.sessionId = data.session_id ?? null;
    } else {
      this.sessionId ??= null;
    }

    // The self_stream property is omitted if false, check for self_video
    // here to avoid incorrectly clearing this when partial data is specified
    if ('self_video' in data) {
      this.streaming = data.self_stream ?? false;
    } else {
      this.streaming ??= null;
    }

    if ('channel_id' in data) {
      this.channelId = data.channel_id ?? null;
    } else {
      this.channelId ??= null;
    }

    if ('suppress' in data && data.suppress !== undefined) {
      this.suppress = data.suppress;
    }

    if ('request_to_speak_timestamp' in data) {
      this.requestToSpeakTimestamp =
        data.request_to_speak_timestamp ? Date.parse(data.request_to_speak_timestamp) : null;
    } else {
      this.requestToSpeakTimestamp ??= null;
    }

    return this;
  }

  /**
   * The member that this voice state belongs to
   */
  public get member(): GuildMember | null {
    if (!this.guild?.id) return null;
    return this.guild.members.cache.get(this.id) ?? null;
  }

  /**
   * The user that this voice state belongs to
   */
  public get user(): User | null {
    return (this.guild.client as unknown as { users: { cache: { get: (id: Snowflake) => User | undefined } } }).users.cache.get(this.id) ?? null;
  }

  /**
   * The channel that the member is connected to
   */
  public get channel(): VoiceChannel | StageChannel | DMChannel | GroupDMChannel | null {
    const manager = this.guild?.id ? this.guild.channels : (this.client as unknown as { channels?: { cache: { get: (id: Snowflake) => unknown } } }).channels;
    return (manager?.cache.get(this.channelId as Snowflake) as VoiceChannel | StageChannel | DMChannel | GroupDMChannel | undefined) ?? null;
  }

  /**
   * Whether this member is either self-deafened or server-deafened
   */
  public get deaf(): boolean | null {
    return this.serverDeaf || this.selfDeaf;
  }

  /**
   * Whether this member is either self-muted or server-muted
   */
  public get mute(): boolean | null {
    return this.serverMute || this.selfMute;
  }

  /**
   * Mutes/unmutes the member of this voice state.
   * @param mute Whether or not the member should be muted
   * @param reason Reason for muting or unmuting
   */
  public setMute(mute = true, reason?: string): Promise<GuildMember> | null {
    if (!this.guild?.id) return null;
    return this.guild.members.edit(this.id, { mute }, reason);
  }

  /**
   * Deafens/undeafens the member of this voice state.
   * @param deaf Whether or not the member should be deafened
   * @param reason Reason for deafening or undeafening
   */
  public setDeaf(deaf = true, reason?: string): Promise<GuildMember> | null {
    if (!this.guild?.id) return null;
    return this.guild.members.edit(this.id, { deaf }, reason);
  }

  /**
   * Disconnects the member from the channel.
   * @param reason Reason for disconnecting the member from the channel
   */
  public disconnect(reason?: string): Promise<GuildMember> | null {
    return this.setChannel(null, reason);
  }

  /**
   * Moves the member to a different channel, or disconnects them from the one they're in.
   * @param channel Channel to move the member to, or `null` if you want to disconnect them from voice.
   * @param reason Reason for moving member to another channel or disconnecting
   */
  public setChannel(channel: GuildVoiceChannelResolvable | null, reason?: string): Promise<GuildMember> | null {
    if (!this.guild?.id) return null;
    return this.guild.members.edit(this.id, { channel }, reason);
  }

  /**
   * Toggles the request to speak in the channel.
   * Only applicable for stage channels and for the client's own voice state.
   * @param request Whether or not the client is requesting to become a speaker.
   */
  public async setRequestToSpeak(request = true): Promise<void> {
    if ((this.channel as { type?: string } | null)?.type !== 'GUILD_STAGE_VOICE') {
      throw new DiscordError('VOICE_NOT_STAGE_CHANNEL');
    }

    const clientUser = (this.client as unknown as { user?: { id: Snowflake } }).user;
    if (clientUser?.id !== this.id) throw new DiscordError('VOICE_STATE_NOT_OWN');

    const api = (this.client as unknown as { api: { guilds: (guildId: Snowflake, sub: string, target: string) => { patch: (opts: { data: Record<string, unknown> }) => Promise<void> } } }).api;
    await api.guilds(this.guild.id, 'voice-states', '@me').patch({
      data: {
        channel_id: this.channelId,
        request_to_speak_timestamp: request ? new Date().toISOString() : null,
      },
    });
  }

  /**
   * Suppress/unsuppress the user. Only applicable for stage channels.
   * @param suppressed Whether or not the user should be suppressed.
   */
  public async setSuppressed(suppressed = true): Promise<void> {
    if (typeof suppressed !== 'boolean') {
      throw new TypeError('VOICE_STATE_INVALID_TYPE', 'suppressed');
    }

    if ((this.channel as { type?: string } | null)?.type !== 'GUILD_STAGE_VOICE') {
      throw new DiscordError('VOICE_NOT_STAGE_CHANNEL');
    }

    const clientUser = (this.client as unknown as { user?: { id: Snowflake } }).user;
    const target = clientUser?.id === this.id ? '@me' : this.id;

    const api = (this.client as unknown as { api: { guilds: (guildId: Snowflake, sub: string, target: string) => { patch: (opts: { data: Record<string, unknown> }) => Promise<void> } } }).api;
    await api.guilds(this.guild.id, 'voice-states', target).patch({
      data: {
        channel_id: this.channelId,
        suppress: suppressed,
        request_to_speak_timestamp: null,
      },
    });
  }

  /**
   * Sets the status of the voice channel
   * @param status The message to set the channel status to
   */
  public setStatus(status = ''): Promise<unknown> {
    const channel = this.channel;
    if (!channel?.id) return Promise.resolve();
    const api = (this.client as unknown as { api: { channels: (channelId: Snowflake, sub: string) => { put: (opts: { data: { status: string } }) => Promise<unknown> } } }).api;
    return api.channels(channel.id, 'voice-status').put({
      data: {
        status,
      },
    });
  }

  /**
   * Get URL Image of the user's streaming video
   */
  public async getPreview(): Promise<string> {
    if (!this.streaming) throw new DiscordError('USER_NOT_STREAMING');
    const streamKey = this.guild?.id
      ? `guild:${this.guild.id}:${this.channelId}:${this.id}`
      : `call:${this.channelId}:${this.id}`;
    const api = (this.client as unknown as { api: { streams: Record<string, { preview: { get: () => Promise<{ url: string }> } }> } }).api;
    const data = await api.streams[encodeURIComponent(streamKey)].preview.get();
    return data.url;
  }

  /**
   * Post Preview Image to the client user's streaming video
   * @param base64Image Base64 URI (data:image/jpeg;base64,data)
   */
  public postPreview(base64Image: string): Promise<unknown> {
    const clientUser = (this.client as unknown as { user?: { id: Snowflake } }).user;
    if (clientUser?.id !== this.id || !this.streaming) throw new DiscordError('USER_NOT_STREAMING');
    const streamKey = this.guild?.id
      ? `guild:${this.guild.id}:${this.channelId}:${this.id}`
      : `call:${this.channelId}:${this.id}`;
    const api = (this.client as unknown as { api: { streams: Record<string, { preview: { post: (opts: { data: { thumbnail: string } }) => Promise<unknown> } }> } }).api;
    return api.streams[encodeURIComponent(streamKey)].preview.post({
      data: {
        thumbnail: base64Image,
      },
    });
  }

  /**
   * Fetches this voice state.
   * @param force Whether to skip the cache check and request the API
   */
  public fetch(force = true): Promise<VoiceState> | null {
    const voiceStates = (this.guild as unknown as { voiceStates?: { fetch: (id: Snowflake, opts: { force: boolean }) => Promise<VoiceState> } }).voiceStates;
    return voiceStates ? voiceStates.fetch(this.id, { force }) : null;
  }

  public override toJSON(): Record<string, unknown> {
    return super.toJSON({
      id: true,
      serverDeaf: true,
      serverMute: true,
      selfDeaf: true,
      selfMute: true,
      selfVideo: true,
      sessionId: true,
      channelId: 'channel',
    }) as Record<string, unknown>;
  }
}

export default VoiceState;
