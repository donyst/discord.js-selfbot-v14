import { Collection } from '@discordjs/collection';
import type { Snowflake } from 'discord-api-types/v10';
import Base from './Base.js';
import GuildPreviewEmoji, { type RawGuildPreviewEmojiData } from './GuildPreviewEmoji.js';
import { Sticker, type APIStickerData } from './Sticker.js';
import SnowflakeUtil from '../util/SnowflakeUtil.js';
import type { Client } from '../client/Client.js';
import type { ImageURLOptions } from '../types/index.js';

export interface RawGuildPreviewData {
  id: Snowflake;
  name?: string;
  icon?: string | null;
  splash?: string | null;
  discovery_splash?: string | null;
  features?: string[];
  approximate_member_count?: number;
  approximate_presence_count?: number;
  description?: string | null;
  emojis?: RawGuildPreviewEmojiData[];
  stickers?: APIStickerData[];
}

/**
 * Represents the data about the guild any bot/user can preview.
 * @extends {Base}
 */
export class GuildPreview extends Base {
  public declare id: Snowflake;

  /**
   * The name of this guild
   */
  public name!: string;

  /**
   * The icon of this guild
   */
  public icon!: string | null;

  /**
   * The splash icon of this guild
   */
  public splash!: string | null;

  /**
   * The discovery splash icon of this guild
   */
  public discoverySplash!: string | null;

  /**
   * An array of enabled guild features
   */
  public features!: string[];

  /**
   * The approximate count of members in this guild
   */
  public approximateMemberCount!: number;

  /**
   * The approximate count of online members in this guild
   */
  public approximatePresenceCount!: number;

  /**
   * The description for this guild
   */
  public description!: string | null;

  /**
   * Collection of emojis belonging to this guild
   */
  public emojis!: Collection<Snowflake, GuildPreviewEmoji>;

  /**
   * Collection of stickers belonging to this guild
   */
  public stickers!: Collection<Snowflake, Sticker>;

  public constructor(client: Client, data?: RawGuildPreviewData) {
    super(client);
    if (!data) return;
    this._patch(data);
  }

  public _patch(data: RawGuildPreviewData): void {
    this.id = data.id;

    if ('name' in data && data.name !== undefined) {
      this.name = data.name;
    }

    if ('icon' in data) {
      this.icon = data.icon ?? null;
    }

    if ('splash' in data) {
      this.splash = data.splash ?? null;
    }

    if ('discovery_splash' in data) {
      this.discoverySplash = data.discovery_splash ?? null;
    }

    if ('features' in data && data.features !== undefined) {
      this.features = data.features;
    }

    if ('approximate_member_count' in data && data.approximate_member_count !== undefined) {
      this.approximateMemberCount = data.approximate_member_count;
    }

    if ('approximate_presence_count' in data && data.approximate_presence_count !== undefined) {
      this.approximatePresenceCount = data.approximate_presence_count;
    }

    if ('description' in data) {
      this.description = data.description ?? null;
    } else {
      this.description ??= null;
    }

    if (!this.emojis) {
      this.emojis = new Collection();
    } else {
      this.emojis.clear();
    }

    if (data.emojis) {
      for (const emoji of data.emojis) {
        if (emoji.id) {
          this.emojis.set(emoji.id, new GuildPreviewEmoji(this.client as unknown as Client, emoji, this));
        }
      }
    }

    this.stickers = (data.stickers ?? []).reduce(
      (stickers, sticker) => {
        if (sticker.id) {
          stickers.set(sticker.id, new Sticker(this.client as unknown as Client, sticker));
        }
        return stickers;
      },
      new Collection<Snowflake, Sticker>(),
    );
  }

  /**
   * The timestamp this guild was created at
   */
  public get createdTimestamp(): number {
    return SnowflakeUtil.timestampFrom(this.id);
  }

  /**
   * The time this guild was created at
   */
  public get createdAt(): Date {
    return new Date(this.createdTimestamp);
  }

  /**
   * The URL to this guild's splash.
   */
  public splashURL({ format, size }: { format?: string; size?: number } = {}): string | null {
    if (!this.splash) return null;
    return (this.client as unknown as { rest: { cdn: { Splash: (id: Snowflake, splash: string, f?: string, s?: number) => string } } })
      .rest.cdn.Splash(this.id, this.splash, format, size);
  }

  /**
   * The URL to this guild's discovery splash.
   */
  public discoverySplashURL({ format, size }: { format?: string; size?: number } = {}): string | null {
    if (!this.discoverySplash) return null;
    return (this.client as unknown as { rest: { cdn: { DiscoverySplash: (id: Snowflake, ds: string, f?: string, s?: number) => string } } })
      .rest.cdn.DiscoverySplash(this.id, this.discoverySplash, format, size);
  }

  /**
   * The URL to this guild's icon.
   */
  public iconURL(options: ImageURLOptions = {}): string | null {
    if (!this.icon) return null;
    return (this.client as unknown as { rest: { cdn: { Icon: (id: Snowflake, icon: string, f?: string, s?: number, d?: boolean) => string } } })
      .rest.cdn.Icon(this.id, this.icon, options.format, options.size, options.dynamic);
  }

  /**
   * Fetches this guild.
   */
  public async fetch(): Promise<this> {
    const api = (this.client as unknown as { api: { guilds: (id: Snowflake) => { preview: { get: () => Promise<RawGuildPreviewData> } } } }).api;
    const data = await api.guilds(this.id).preview.get();
    this._patch(data);
    return this;
  }

  public override toString(): string {
    return this.name;
  }

  public override toJSON(): Record<string, unknown> {
    const json = (super.toJSON() as Record<string, unknown>) ?? {};
    json.iconURL = this.iconURL();
    json.splashURL = this.splashURL();
    return json;
  }
}

export default GuildPreview;
