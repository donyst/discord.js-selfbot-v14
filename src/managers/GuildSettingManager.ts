import { BaseManager } from './BaseManager.js';
import type { Snowflake } from '../types/index.js';
import type { Guild } from '../structures/Guild.js';

export interface MuteConfig {
  endTime: Date;
  selectedTimeWindow: number;
}

export interface RawGuildSettingData {
  guild_id?: Snowflake;
  suppress_everyone?: boolean;
  suppress_roles?: boolean;
  mute_scheduled_events?: boolean;
  message_notifications?: number;
  flags?: number;
  mobile_push?: boolean;
  muted?: boolean;
  mute_config?: {
    end_time: string | number;
    selected_time_window: number;
  } | null;
  hide_muted_channels?: boolean;
  channel_overrides?: unknown[];
  notify_highlights?: number;
  version?: number;
  [key: string]: unknown;
}

/**
 * Manages API methods for users and stores their cache.
 * @extends {BaseManager}
 * @see {@link https://luna.gitlab.io/discord-unofficial-docs/user_settings.html}
 */
export class GuildSettingManager extends BaseManager {
  #rawSetting: Record<string, unknown> = {};

  /**
   * Guild Id
   */
  public guildId: Snowflake;

  public suppressEveryone?: boolean;
  public suppressRoles?: boolean;
  public muteScheduledEvents?: boolean;
  public messageNotifications?: number;
  public flags?: number;
  public mobilePush?: boolean;
  public muted?: boolean;
  public muteConfig?: MuteConfig | null;
  public hideMutedChannels?: boolean;
  public channelOverrides?: unknown[];
  public notifyHighlights?: number;
  public version?: number;

  public constructor(guild: Guild) {
    super(guild.client);
    this.guildId = guild.id;
  }

  /**
   * Raw data
   */
  public get raw(): Record<string, unknown> {
    return this.#rawSetting;
  }

  /**
   * Get the guild
   */
  public get guild(): Guild | null {
    return (this.client.guilds.cache.get(this.guildId) as unknown as Guild) ?? null;
  }

  /**
   * Patch data file
   * @private
   */
  public _patch(data: RawGuildSettingData = {}): void {
    this.#rawSetting = Object.assign(this.#rawSetting, data);
    this.client.emit('debug', `[SETTING > Guild ${this.guildId}] Sync setting`);

    if ('suppress_everyone' in data) {
      this.suppressEveryone = data.suppress_everyone;
    }
    if ('suppress_roles' in data) {
      this.suppressRoles = data.suppress_roles;
    }
    if ('mute_scheduled_events' in data) {
      this.muteScheduledEvents = data.mute_scheduled_events;
    }
    if ('message_notifications' in data) {
      this.messageNotifications = data.message_notifications;
    }
    if ('flags' in data) {
      this.flags = data.flags;
    }
    if ('mobile_push' in data) {
      this.mobilePush = data.mobile_push;
    }
    if ('muted' in data) {
      this.muted = data.muted;
    }
    if ('mute_config' in data && data.mute_config !== null && data.mute_config !== undefined) {
      this.muteConfig = {
        endTime: new Date(data.mute_config.end_time),
        selectedTimeWindow: data.mute_config.selected_time_window,
      };
    } else if ('mute_config' in data) {
      this.muteConfig = null;
    }
    if ('hide_muted_channels' in data) {
      this.hideMutedChannels = data.hide_muted_channels;
    }
    if ('channel_overrides' in data) {
      this.channelOverrides = data.channel_overrides;
    }
    if ('notify_highlights' in data) {
      this.notifyHighlights = data.notify_highlights;
    }
    if ('version' in data) {
      this.version = data.version;
    }
  }

  /**
   * Edit guild settings
   */
  public async edit(data: Record<string, unknown>): Promise<this> {
    const api = this.client.api as unknown as {
      users(userId: string): {
        settings: {
          patch(opts: { data: unknown }): Promise<RawGuildSettingData>;
        };
      };
    };

    const data_ = await api.users('@me').settings.patch({ data });
    this._patch(data_);
    return this;
  }
}

export default GuildSettingManager;
