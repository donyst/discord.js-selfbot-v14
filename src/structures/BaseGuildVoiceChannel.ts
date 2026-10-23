import { Collection } from '@discordjs/collection';
import GuildChannel, { type ChannelData } from './GuildChannel.js';
import TextBasedChannel from './interfaces/TextBasedChannel.js';
import MessageManager from '../managers/MessageManager.js';
import { VideoQualityModes } from '../util/Constants.js';
import Permissions from '../util/Permissions.js';
import type { Snowflake } from '../types/index.js';
import type { Guild } from './Guild.js';
import type { GuildMember } from './GuildMember.js';
import type { Client } from '../client/Client.js';
import type { Invite, CreateInviteOptions } from './Invite.js';

export type VideoQualityModeString = 'AUTO' | 'FULL';

export interface BaseGuildVoiceChannelData {
  bitrate?: number;
  rtc_region?: string | null;
  user_limit?: number;
  video_quality_mode?: number;
  last_message_id?: Snowflake | null;
  rate_limit_per_user?: number;
  nsfw?: boolean;
  status?: string | null;
  messages?: unknown[];
  [key: string]: unknown;
}

export interface BaseGuildVoiceChannel extends GuildChannel, TextBasedChannel {}

/**
 * Represents a voice-based guild channel on Discord.
 */
export class BaseGuildVoiceChannel extends GuildChannel {
  public messages: MessageManager;
  public nsfw: boolean;
  public bitrate: number = 64_000;
  public rtcRegion: string | null = null;
  public userLimit: number = 0;
  public videoQualityMode: VideoQualityModeString | null = null;
  public lastMessageId: Snowflake | null = null;
  public rateLimitPerUser: number = 0;
  public status: string | null = null;

  public constructor(guild: Guild, data: BaseGuildVoiceChannelData, client?: Client) {
    super(guild, data as ChannelData, client, false);

    this.messages = new MessageManager(this);
    this.nsfw = Boolean(data.nsfw);

    this._patch(data);
  }

  public override _patch(data: BaseGuildVoiceChannelData): this {
    super._patch(data as ChannelData);

    if ('bitrate' in data && data.bitrate != null) {
      this.bitrate = data.bitrate;
    }

    if ('rtc_region' in data) {
      this.rtcRegion = data.rtc_region ?? null;
    }

    if ('user_limit' in data && data.user_limit != null) {
      this.userLimit = data.user_limit;
    }

    if ('video_quality_mode' in data && data.video_quality_mode != null) {
      this.videoQualityMode = (VideoQualityModes as Record<number, VideoQualityModeString>)[data.video_quality_mode] ?? null;
    } else {
      this.videoQualityMode ??= null;
    }

    if ('last_message_id' in data) {
      this.lastMessageId = data.last_message_id ?? null;
    }

    if ('messages' in data && Array.isArray(data.messages)) {
      for (const message of data.messages) {
        (this.messages as unknown as { _add(m: unknown): void })._add(message);
      }
    }

    if ('rate_limit_per_user' in data && data.rate_limit_per_user != null) {
      this.rateLimitPerUser = data.rate_limit_per_user;
    }

    if ('nsfw' in data && data.nsfw != null) {
      this.nsfw = data.nsfw;
    }

    if ('status' in data) {
      this.status = data.status ?? null;
    }

    return this;
  }

  public get members(): Collection<Snowflake, GuildMember> {
    const coll = new Collection<Snowflake, GuildMember>();
    const voiceStates = (this.guild as unknown as { voiceStates?: { cache: Collection<Snowflake, { channelId?: Snowflake | null; member?: GuildMember | null; id: Snowflake }> } }).voiceStates;
    if (voiceStates?.cache) {
      for (const state of voiceStates.cache.values()) {
        if (state.channelId === this.id && state.member) {
          coll.set(state.id, state.member);
        }
      }
    }
    return coll;
  }

  public get full(): boolean {
    return this.userLimit > 0 && this.members.size >= this.userLimit;
  }

  public get joinable(): boolean {
    if (!this.viewable) return false;
    if (!this.client.user) return false;
    const permissions = this.permissionsFor(this.client.user.id);
    if (!permissions) return false;

    if (permissions.has(Permissions.FLAGS.ADMINISTRATOR, false)) return true;

    const me = this.guild.members.me;
    const commDisabled = me ? (me.communicationDisabledUntilTimestamp ?? 0) : 0;
    return commDisabled < Date.now() && permissions.has(Permissions.FLAGS.CONNECT, false);
  }

  public createInvite(options?: CreateInviteOptions): Promise<Invite> {
    return (this.guild.invites as unknown as { create(id: Snowflake, opts?: CreateInviteOptions): Promise<Invite> }).create(
      this.id,
      options,
    );
  }

  public fetchInvites(cache = true): Promise<Collection<string, Invite>> {
    return (this.guild.invites as unknown as { fetch(opts: { channelId: Snowflake; cache?: boolean }): Promise<Collection<string, Invite>> }).fetch({
      channelId: this.id,
      cache,
    });
  }

  public setBitrate(bitrate: number, reason?: string): Promise<this> {
    return this.edit({ bitrate }, reason) as Promise<this>;
  }

  public setRTCRegion(rtcRegion: string | null, reason?: string): Promise<this> {
    return this.edit({ rtcRegion }, reason) as Promise<this>;
  }

  public setUserLimit(userLimit: number, reason?: string): Promise<this> {
    return this.edit({ userLimit }, reason) as Promise<this>;
  }

  public setVideoQualityMode(videoQualityMode: VideoQualityModeString | number, reason?: string): Promise<this> {
    return this.edit({ videoQualityMode }, reason) as Promise<this>;
  }
}

TextBasedChannel.applyToClass(BaseGuildVoiceChannel, true, ['lastPinAt']);

export default BaseGuildVoiceChannel;
