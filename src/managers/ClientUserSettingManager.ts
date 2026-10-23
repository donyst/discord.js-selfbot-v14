import { Collection } from '@discordjs/collection';
import { BaseManager } from './BaseManager.js';
import { DiscordjsTypeError as DJSTypeError, DiscordjsRangeError as DJSRangeError } from '../errors/index.js';
import { CustomStatus } from '../structures/Presence.js';
import { ActivityTypes } from '../util/Constants.js';
import type { Snowflake, EmojiIdentifierResolvable } from '../types/index.js';
import type { Client } from '../client/Client.js';
import type { Guild } from '../structures/Guild.js';

export interface FriendSourceFlags {
  all: boolean | null;
  mutual_friends: boolean | null;
  mutual_guilds: boolean | null;
}

export interface CustomStatusOption {
  text?: string | null;
  status?: 'online' | 'idle' | 'dnd' | 'invisible' | null;
  emoji?: EmojiIdentifierResolvable | null;
  expires?: number | null;
}

export interface RawClientUserSettingData {
  locale?: string;
  show_current_game?: boolean;
  default_guilds_restricted?: boolean;
  inline_attachment_media?: boolean;
  inline_embed_media?: boolean;
  gif_auto_play?: boolean;
  render_embeds?: boolean;
  animate_emoji?: boolean;
  enable_tts_command?: boolean;
  message_display_compact?: boolean;
  convert_emoticons?: boolean;
  explicit_content_filter?: number;
  theme?: string;
  developer_mode?: boolean;
  afk_timeout?: number;
  animate_stickers?: number;
  render_reactions?: boolean;
  status?: string;
  custom_status?: {
    text?: string | null;
    emoji_id?: Snowflake | null;
    emoji_name?: string | null;
    expires_at?: string | null;
  } | null;
  friend_source_flags?: FriendSourceFlags;
  restricted_guilds?: Snowflake[];
  [key: string]: unknown;
}

/**
 * Manages API methods for users and stores their cache.
 * @extends {BaseManager}
 * @see {@link https://luna.gitlab.io/discord-unofficial-docs/user_settings.html}
 */
export class ClientUserSettingManager extends BaseManager {
  #rawSetting: Record<string, unknown> = {};

  /**
   * WHO CAN ADD YOU AS A FRIEND ?
   */
  public addFriendFrom: FriendSourceFlags = {
    all: null,
    mutual_friends: null,
    mutual_guilds: null,
  };

  public locale?: string;
  public activityDisplay?: boolean;
  public allowDMsFromGuild?: boolean;
  public displayImage?: boolean;
  public linkedImageDisplay?: boolean;
  public autoplayGIF?: boolean;
  public previewLink?: boolean;
  public animatedEmoji?: boolean;
  public allowTTS?: boolean;
  public compactMode?: boolean;
  public convertEmoticons?: boolean;
  public DMScanLevel?: number;
  public theme?: string;
  public developerMode?: boolean;
  public afkTimeout?: number;
  public stickerAnimationMode?: number;
  public showEmojiReactions?: boolean;
  public customStatus?: RawClientUserSettingData['custom_status'];
  public disableDMfromGuilds: Collection<Snowflake, Guild | undefined> = new Collection();

  public constructor(client: Client) {
    super(client);
  }

  /**
   * Patch data file
   * @private
   */
  public _patch(data: RawClientUserSettingData = {}): void {
    this.#rawSetting = Object.assign(this.#rawSetting, data);
    this.client.emit('debug', `[SETTING > ClientUser] Sync setting`);

    if ('locale' in data) {
      this.locale = data.locale;
    }
    if ('show_current_game' in data) {
      this.activityDisplay = data.show_current_game;
    }
    if ('default_guilds_restricted' in data) {
      this.allowDMsFromGuild = data.default_guilds_restricted;
    }
    if ('inline_attachment_media' in data) {
      this.displayImage = data.inline_attachment_media;
    }
    if ('inline_embed_media' in data) {
      this.linkedImageDisplay = data.inline_embed_media;
    }
    if ('gif_auto_play' in data) {
      this.autoplayGIF = data.gif_auto_play;
    }
    if ('render_embeds' in data) {
      this.previewLink = data.render_embeds;
    }
    if ('animate_emoji' in data) {
      this.animatedEmoji = data.animate_emoji;
    }
    if ('enable_tts_command' in data) {
      this.allowTTS = data.enable_tts_command;
    }
    if ('message_display_compact' in data) {
      this.compactMode = data.message_display_compact;
    }
    if ('convert_emoticons' in data) {
      this.convertEmoticons = data.convert_emoticons;
    }
    if ('explicit_content_filter' in data) {
      this.DMScanLevel = data.explicit_content_filter;
    }
    if ('theme' in data) {
      this.theme = data.theme;
    }
    if ('developer_mode' in data) {
      this.developerMode = data.developer_mode;
    }
    if ('afk_timeout' in data) {
      this.afkTimeout = data.afk_timeout;
    }
    if ('animate_stickers' in data) {
      this.stickerAnimationMode = data.animate_stickers;
    }
    if ('render_reactions' in data) {
      this.showEmojiReactions = data.render_reactions;
    }
    if ('status' in data && data.status) {
      const presence = (this.client as unknown as { presence?: { status?: string } }).presence;
      if (presence) presence.status = data.status;
      if (!('custom_status' in data)) {
        this.client.emit('debug', '[SETTING > ClientUser] Sync status');
        const user = this.client.user as unknown as { setStatus?(s: string): void };
        user?.setStatus?.(data.status);
      }
    }
    if ('custom_status' in data) {
      this.customStatus = data.custom_status;
      const presence = (this.client as unknown as { presence?: { activities?: { type: number | string }[] } }).presence;
      const activities = (presence?.activities ?? []).filter(
        a => ![ActivityTypes.CUSTOM, 'CUSTOM'].includes(a.type as string),
      );
      if (data.custom_status) {
        const custom = new CustomStatus(this.client);
        if (data.custom_status.text) custom.setState(data.custom_status.text);
        let emoji: unknown;
        if (data.custom_status.emoji_id) {
          emoji = this.client.emojis.cache.get(data.custom_status.emoji_id);
        } else if (data.custom_status.emoji_name) {
          emoji = `:${data.custom_status.emoji_name}:`;
        }
        if (emoji) custom.setEmoji(emoji as Parameters<typeof custom.setEmoji>[0]);
        activities.push(custom as unknown as { type: number | string });
      }
      this.client.emit('debug', '[SETTING > ClientUser] Sync activities & status');
      const user = this.client.user as unknown as { setPresence?(opts: unknown): void };
      user?.setPresence?.({ activities });
    }
    if ('restricted_guilds' in data && data.restricted_guilds) {
      this.disableDMfromGuilds = new Collection(
        data.restricted_guilds.map(guildId => [guildId, this.client.guilds.cache.get(guildId) as Guild | undefined]),
      );
    }
  }

  /**
   * Raw data
   */
  public get raw(): Record<string, unknown> {
    return this.#rawSetting;
  }

  public async fetch(): Promise<this> {
    const api = this.client.api as unknown as {
      users(userId: string): {
        settings: {
          get(): Promise<RawClientUserSettingData>;
        };
      };
    };

    const data = await api.users('@me').settings.get();
    this._patch(data);
    return this;
  }

  /**
   * Edit data
   */
  public async edit(data: Record<string, unknown>): Promise<this> {
    const api = this.client.api as unknown as {
      users(userId: string): {
        settings: {
          patch(opts: { data: unknown }): Promise<RawClientUserSettingData>;
        };
      };
    };

    const res = await api.users('@me').settings.patch({ data });
    this._patch(res);
    return this;
  }

  /**
   * Fetches binary user settings protobuf (Type 1: PreloadedUserSettings, Type 2: FrecencyUserSettings).
   * @param type Protobuf setting type (1 = PreloadedUserSettings, 2 = FrecencyUserSettings)
   * @returns Base64 encoded protobuf string
   */
  public async fetchProto(type: 1 | 2 = 1): Promise<string> {
    const route = (this.client.api as unknown as {
      users(id: string): {
        ['settings-proto'](t: number): {
          get(): Promise<{ settings: string }>;
        };
      };
    }).users('@me')['settings-proto'](type);
    const res = await route.get();
    return res.settings;
  }

  /**
   * Updates binary user settings protobuf with official desktop endpoint.
   * @param type Protobuf setting type (1 = PreloadedUserSettings, 2 = FrecencyUserSettings)
   * @param protoBase64 Base64 encoded protobuf string
   */
  public async editProto(type: 1 | 2, protoBase64: string): Promise<string> {
    const route = (this.client.api as unknown as {
      users(id: string): {
        ['settings-proto'](t: number): {
          patch(opts: { data: { settings: string } }): Promise<{ settings: string }>;
        };
      };
    }).users('@me')['settings-proto'](type);
    const res = await route.patch({ data: { settings: protoBase64 } });
    return res.settings;
  }

  /**
   * Toggle compact mode
   */
  public toggleCompactMode(): Promise<this> {
    return this.edit({ message_display_compact: !this.compactMode });
  }

  /**
   * Discord Theme
   */
  public setTheme(value: 'dark' | 'light'): Promise<this> {
    const validValues = ['dark', 'light'];
    if (!validValues.includes(value)) {
      throw new DJSTypeError('INVALID_TYPE', 'value', 'dark | light', true);
    }
    return this.edit({ theme: value });
  }

  /**
   * Set custom status
   */
  public setCustomStatus(options: CustomStatus | CustomStatusOption | null): Promise<this> {
    if (typeof options !== 'object' || options === null) {
      return this.edit({ custom_status: null });
    } else if (options instanceof CustomStatus) {
      const json = options.toJSON() as {
        state?: string | null;
        emoji?: { id?: string | null; name?: string | null } | null;
      };
      const data: {
        emoji_name: string | null;
        emoji_id?: string;
        expires_at: string | null;
        text: string | null;
      } = {
        emoji_name: null,
        expires_at: null,
        text: null,
      };
      if (typeof json.state === 'string') {
        data.text = json.state;
      }
      if (json.emoji) {
        if (json.emoji.id) {
          data.emoji_name = json.emoji.name ?? null;
          data.emoji_id = json.emoji.id;
        } else {
          data.emoji_name = typeof json.emoji.name === 'string' ? json.emoji.name : null;
        }
      }
      return this.edit({ custom_status: data });
    } else {
      const data: {
        emoji_name: string | null;
        emoji_id?: string;
        expires_at: string | null;
        text: string | null;
      } = {
        emoji_name: null,
        expires_at: null,
        text: null,
      };
      if (typeof options.text === 'string') {
        if (options.text.length > 128) {
          throw new DJSRangeError('[INVALID_VALUE] Custom status text must be less than 128 characters');
        }
        data.text = options.text;
      }
      if (options.emoji) {
        const emojiResolvable = (this.client.emojis as unknown as { resolve(e: unknown): { name: string; id: Snowflake } | null }).resolve(options.emoji);
        if (emojiResolvable) {
          data.emoji_name = emojiResolvable.name;
          data.emoji_id = emojiResolvable.id;
        } else {
          data.emoji_name = typeof options.emoji === 'string' ? options.emoji : null;
        }
      }
      if (typeof options.expires === 'number') {
        if (options.expires < Date.now()) {
          throw new DJSRangeError(`[INVALID_VALUE] Custom status expiration must be greater than ${Date.now()}`);
        }
        data.expires_at = new Date(options.expires).toISOString();
      }
      if (options.status && ['online', 'idle', 'dnd', 'invisible'].includes(options.status)) {
        this.edit({ status: options.status });
      }
      return this.edit({ custom_status: data });
    }
  }

  /**
   * Restricted guilds setting
   */
  public restrictedGuilds(status: boolean): Promise<this> {
    if (typeof status !== 'boolean') {
      throw new DJSTypeError('INVALID_TYPE', 'status', 'boolean', true);
    }
    return this.edit({
      default_guilds_restricted: status,
      restricted_guilds: status ? this.client.guilds.cache.map(v => v.id) : [],
    });
  }

  /**
   * Add a guild to the list of restricted guilds.
   */
  public addRestrictedGuild(guildId: Snowflake): Promise<this> {
    const temp = [...this.disableDMfromGuilds.keys()];
    if (temp.includes(guildId)) throw new Error('Guild is already restricted');
    temp.push(guildId);
    return this.edit({ restricted_guilds: temp });
  }

  /**
   * Remove a guild from the list of restricted guilds.
   */
  public removeRestrictedGuild(guildId: Snowflake): Promise<this> {
    if (!this.disableDMfromGuilds.delete(guildId)) throw new Error('Guild is already restricted');
    return this.edit({ restricted_guilds: [...this.disableDMfromGuilds.keys()] });
  }
}

export default ClientUserSettingManager;
