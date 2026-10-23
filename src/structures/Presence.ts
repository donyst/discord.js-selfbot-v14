import { randomUUID } from 'node:crypto';
import type { Snowflake } from 'discord-api-types/v10';
import Base from './Base.js';
import ActivityFlags from '../util/ActivityFlags.js';
import { ActivityTypes } from '../util/Constants.js';
import Util from '../util/Util.js';
import { DiscordjsError as DiscordError } from '../errors/index.js';
import type { Guild } from './Guild.js';
import type { GuildMember } from './GuildMember.js';
import type User from './User.js';
import type { Client } from '../client/Client.js';
import type { EmojiIdentifierResolvable } from '../types/index.js';

export type PresenceStatus = 'online' | 'idle' | 'offline' | 'dnd' | 'invisible';
export type ClientPresenceStatus = 'online' | 'idle' | 'dnd';
export type ActivityPlatform =
  | 'desktop'
  | 'samsung'
  | 'xbox'
  | 'ios'
  | 'android'
  | 'embedded'
  | 'ps4'
  | 'ps5'
  | string;

export interface ClientStatus {
  web?: ClientPresenceStatus | null;
  mobile?: ClientPresenceStatus | null;
  desktop?: ClientPresenceStatus | null;
}

export interface ActivityTimestamps {
  start: number | null;
  end: number | null;
}

export interface ActivityParty {
  id?: string | null;
  size: [number, number];
}

export interface RichButton {
  name: string;
  url: string;
}

export interface RichParty {
  id?: string;
  max: number;
  current: number;
}

export interface SpotifyMetadata {
  album_id: string | null;
  artist_ids: string[];
  context_uri: string | null;
  [key: string]: unknown;
}

export interface ExternalAssets {
  url: string | null;
  external_asset_path: string | null;
}

export interface RawActivityData {
  id?: string;
  name?: string;
  type?: number | string;
  url?: string | null;
  created_at?: number;
  createdTimestamp?: number;
  session_id?: string | null;
  platform?: ActivityPlatform | null;
  timestamps?: { start?: number | string | Date; end?: number | string | Date } | null;
  application_id?: Snowflake | null;
  applicationId?: Snowflake | null;
  details?: string | null;
  state?: string | null;
  sync_id?: string | null;
  syncId?: string | null;
  flags?: number;
  buttons?: string[];
  emoji?: Record<string, unknown> | null;
  party?: ActivityParty | null;
  assets?: RawRichPresenceAssetsData | null;
  secrets?: Record<string, string | undefined>;
  metadata?: Record<string, unknown>;
}

export interface RawPresenceData {
  user?: { id?: Snowflake | null };
  guild?: Guild | null;
  status?: PresenceStatus;
  activities?: RawActivityData[];
  client_status?: ClientStatus | null;
  last_modified?: number;
  afk?: boolean;
  since?: number;
}

/**
 * Represents a user's presence.
 * @extends {Base}
 */
export class Presence extends Base {
  /**
   * The presence's user id
   */
  public userId: Snowflake;

  /**
   * The guild this presence is in
   */
  public guild: Guild | null;

  /**
   * The status of this presence
   */
  public status!: PresenceStatus;

  /**
   * The activities of this presence
   */
  public activities!: (CustomStatus | RichPresence | SpotifyRPC | Activity)[];

  /**
   * The devices this presence is on
   */
  public clientStatus!: ClientStatus | null;

  /**
   * The timestamp this presence was last updated
   */
  public lastModified?: number;

  public afk!: boolean;

  public since!: number;

  public constructor(client: Client | unknown, data: RawPresenceData = {}) {
    super(client as Client);
    this.userId = data.user?.id ?? ('' as Snowflake);
    this.guild = data.guild ?? null;
    this._patch(data);
  }

  /**
   * The user of this presence
   */
  public get user(): User | null {
    return (this.client as unknown as { users: { resolve: (id: Snowflake) => User | null } }).users.resolve(this.userId);
  }

  /**
   * The member of this presence
   */
  public get member(): GuildMember | null {
    return this.guild?.members.resolve(this.userId) ?? null;
  }

  public _patch(data: RawPresenceData): this {
    if ('status' in data && data.status !== undefined) {
      this.status = data.status;
    } else {
      this.status ??= 'offline';
    }

    if ('activities' in data && data.activities !== undefined) {
      const clientUser = (this.client as unknown as { user?: { id?: Snowflake } }).user;
      this.activities = data.activities.map(activity => {
        if (this.userId && clientUser?.id && this.userId === clientUser.id) {
          if (
            activity.type === ActivityTypes.CUSTOM ||
            activity.type === 'CUSTOM' ||
            activity.type === 4
          ) {
            return new CustomStatus(this.client as unknown as Client, activity);
          } else if (activity.id === 'spotify:1') {
            return new SpotifyRPC(this.client as unknown as Client, activity);
          } else {
            return new RichPresence(this.client as unknown as Client, activity);
          }
        } else {
          return new Activity(this, activity);
        }
      });
    } else {
      this.activities ??= [];
    }

    if ('client_status' in data) {
      this.clientStatus = data.client_status ?? null;
    } else {
      this.clientStatus ??= null;
    }

    if ('last_modified' in data && data.last_modified !== undefined) {
      this.lastModified = data.last_modified;
    }

    if ('afk' in data && data.afk !== undefined) {
      this.afk = data.afk;
    } else {
      this.afk ??= false;
    }

    if ('since' in data && data.since !== undefined) {
      this.since = data.since;
    } else {
      this.since ??= 0;
    }

    return this;
  }

  public override _clone(): this {
    const clone = Object.assign(Object.create(this), this) as this;
    clone.activities = this.activities.map(activity => activity._clone());
    return clone;
  }

  /**
   * Whether this presence is equal to another.
   */
  public equals(presence?: Presence | null): boolean {
    return (
      this === presence ||
      Boolean(
        presence &&
          this.status === presence.status &&
          this.clientStatus?.web === presence.clientStatus?.web &&
          this.clientStatus?.mobile === presence.clientStatus?.mobile &&
          this.clientStatus?.desktop === presence.clientStatus?.desktop &&
          this.activities.length === presence.activities.length &&
          this.activities.every((activity, index) => activity.equals(presence.activities[index])),
      )
    );
  }

  public override toJSON(): Record<string, unknown> {
    return Util.flatten(this) as Record<string, unknown>;
  }
}

/**
 * Represents an activity that is part of a user's presence.
 */
export class Activity {
  public readonly presence: Presence;
  public id?: string;
  public name!: string;
  public type!: number | string;
  public url!: string | null;
  public createdTimestamp!: number;
  public sessionId?: string | null;
  public platform!: ActivityPlatform | null;
  public timestamps!: ActivityTimestamps | null;
  public applicationId!: Snowflake | null;
  public details!: string | null;
  public state!: string | null;
  public syncId!: string | null;
  public flags!: Readonly<ActivityFlags>;
  public buttons!: string[];
  public emoji!: Record<string, unknown> | null;
  public party!: ActivityParty | null;
  public assets!: RichPresenceAssets;

  public constructor(presence: Presence, data: RawActivityData = {}) {
    if (!(presence instanceof Presence)) {
      throw new DiscordError('INVALID_TYPE');
    }
    Object.defineProperty(this, 'presence', { value: presence });
    this._patch(data);
  }

  public _patch(data: RawActivityData = {}): void {
    if ('id' in data) {
      this.id = data.id;
    }

    if ('name' in data && data.name !== undefined) {
      this.name = data.name;
    }

    if ('type' in data && data.type !== undefined) {
      this.type = typeof data.type === 'number' ? (ActivityTypes as unknown as Record<number, string>)[data.type] ?? data.type : data.type;
    }

    if ('url' in data) {
      this.url = data.url ?? null;
    } else {
      this.url = null;
    }

    if ('created_at' in data || 'createdTimestamp' in data) {
      this.createdTimestamp = (data.created_at || data.createdTimestamp)!;
    }

    if ('session_id' in data) {
      this.sessionId = data.session_id;
    } else {
      this.sessionId = (this.presence.client as unknown as { sessionId?: string }).sessionId;
    }

    if ('platform' in data) {
      this.platform = data.platform ?? null;
    } else {
      this.platform = null;
    }

    if ('timestamps' in data && data.timestamps) {
      this.timestamps = {
        start: data.timestamps.start ? new Date(data.timestamps.start).getTime() : null,
        end: data.timestamps.end ? new Date(data.timestamps.end).getTime() : null,
      };
    } else {
      this.timestamps = null;
    }

    if ('application_id' in data || 'applicationId' in data) {
      this.applicationId = data.application_id || data.applicationId || null;
    } else {
      this.applicationId = null;
    }

    if ('details' in data) {
      this.details = data.details ?? null;
    } else {
      this.details = null;
    }

    if ('state' in data) {
      this.state = data.state ?? null;
    } else {
      this.state = null;
    }

    if ('sync_id' in data || 'syncId' in data) {
      this.syncId = data.sync_id || data.syncId || null;
    } else {
      this.syncId = null;
    }

    if ('flags' in data && data.flags !== undefined) {
      this.flags = new ActivityFlags(data.flags).freeze();
    } else {
      this.flags = new ActivityFlags().freeze();
    }

    if ('buttons' in data && Array.isArray(data.buttons)) {
      this.buttons = data.buttons;
    } else {
      this.buttons = [];
    }

    if ('emoji' in data && data.emoji) {
      this.emoji = Util.resolvePartialEmoji(data.emoji);
    } else {
      this.emoji = null;
    }

    if ('party' in data) {
      this.party = data.party ?? null;
    } else {
      this.party = null;
    }

    this.assets = new RichPresenceAssets(this, data.assets);
  }

  public equals(activity?: Activity | null): boolean {
    return (
      this === activity ||
      Boolean(
        activity &&
          this.name === activity.name &&
          this.type === activity.type &&
          this.url === activity.url &&
          this.state === activity.state &&
          this.details === activity.details &&
          this.emoji?.id === activity.emoji?.id &&
          this.emoji?.name === activity.emoji?.name,
      )
    );
  }

  public get createdAt(): Date {
    return new Date(this.createdTimestamp);
  }

  public toString(): string {
    return this.name;
  }

  public _clone(): Activity {
    return Object.assign(Object.create(this), this) as Activity;
  }

  public toJSON(...props: Record<string, boolean | string>[]): Record<string, unknown> {
    const rawType = typeof this.type === 'number' ? this.type : (ActivityTypes as unknown as Record<string, number>)[this.type];
    return Util.clearNullOrUndefinedObject({
      ...((Util.flatten(this, ...props) as Record<string, unknown>) ?? {}),
      type: rawType,
    }) as Record<string, unknown>;
  }
}

export interface RawRichPresenceAssetsData {
  large_text?: string | null;
  largeText?: string | null;
  small_text?: string | null;
  smallText?: string | null;
  large_image?: string | null;
  largeImage?: string | null;
  small_image?: string | null;
  smallImage?: string | null;
}

/**
 * Assets for a rich presence
 */
export class RichPresenceAssets {
  public readonly activity: Activity;
  public largeText!: string | null;
  public smallText!: string | null;
  public largeImage!: string | null;
  public smallImage!: string | null;

  public constructor(activity: Activity, assets?: RawRichPresenceAssetsData | null) {
    Object.defineProperty(this, 'activity', { value: activity });
    this._patch(assets ?? undefined);
  }

  public _patch(assets: RawRichPresenceAssetsData = {}): void {
    if ('large_text' in assets || 'largeText' in assets) {
      this.largeText = assets.large_text || assets.largeText || null;
    } else {
      this.largeText = null;
    }

    if ('small_text' in assets || 'smallText' in assets) {
      this.smallText = assets.small_text || assets.smallText || null;
    } else {
      this.smallText = null;
    }

    if ('large_image' in assets || 'largeImage' in assets) {
      this.largeImage = assets.large_image || assets.largeImage || null;
    } else {
      this.largeImage = null;
    }

    if ('small_image' in assets || 'smallImage' in assets) {
      this.smallImage = assets.small_image || assets.smallImage || null;
    } else {
      this.smallImage = null;
    }
  }

  public smallImageURL(options: { format?: string; size?: number } = {}): string | null {
    if (!this.smallImage) return null;
    if (this.smallImage.includes(':')) {
      const [platform, id] = this.smallImage.split(':');
      switch (platform) {
        case 'mp':
          return `https://media.discordapp.net/${id}`;
        case 'spotify':
          return `https://i.scdn.co/image/${id}`;
        case 'youtube':
          return `https://i.ytimg.com/vi/${id}/hqdefault_live.jpg`;
        case 'twitch':
          return `https://static-cdn.jtvnw.net/previews-ttv/live_user_${id}.png`;
        default:
          return null;
      }
    }

    return (this.activity.presence.client as unknown as { rest: { cdn: { AppAsset: (appId: Snowflake | null, image: string, opts: unknown) => string } } })
      .rest.cdn.AppAsset(this.activity.applicationId, this.smallImage, options);
  }

  public largeImageURL(options: { format?: string; size?: number } = {}): string | null {
    if (!this.largeImage) return null;
    if (this.largeImage.includes(':')) {
      const [platform, id] = this.largeImage.split(':');
      switch (platform) {
        case 'mp':
          return `https://media.discordapp.net/${id}`;
        case 'spotify':
          return `https://i.scdn.co/image/${id}`;
        case 'youtube':
          return `https://i.ytimg.com/vi/${id}/hqdefault_live.jpg`;
        case 'twitch':
          return `https://static-cdn.jtvnw.net/previews-ttv/live_user_${id}.png`;
        default:
          return null;
      }
    }

    return (this.activity.presence.client as unknown as { rest: { cdn: { AppAsset: (appId: Snowflake | null, image: string, opts: unknown) => string } } })
      .rest.cdn.AppAsset(this.activity.applicationId, this.largeImage, options);
  }

  public static parseImage(image: unknown): string | null {
    if (typeof image !== 'string') {
      return null;
    }
    if (URL.canParse(image) && ['http:', 'https:'].includes(new URL(image).protocol)) {
      let parsed = image
        .replace('https://cdn.discordapp.com/', 'mp:')
        .replace('http://cdn.discordapp.com/', 'mp:')
        .replace('https://media.discordapp.net/', 'mp:')
        .replace('http://media.discordapp.net/', 'mp:');
      if (!parsed.startsWith('mp:')) {
        throw new DiscordError('INVALID_TYPE');
      }
      return parsed;
    } else if (/^[0-9]{17,19}$/.test(image)) {
      return image;
    } else if (['mp:', 'youtube:', 'spotify:', 'twitch:'].some(v => image.startsWith(v))) {
      return image;
    } else if (image.startsWith('external/')) {
      return `mp:${image}`;
    }
    return image;
  }

  public toJSON(): Record<string, unknown> | null {
    if (!this.largeImage && !this.largeText && !this.smallImage && !this.smallText) return null;
    return {
      large_image: RichPresenceAssets.parseImage(this.largeImage),
      large_text: this.largeText,
      small_image: RichPresenceAssets.parseImage(this.smallImage),
      small_text: this.smallText,
    };
  }

  public setLargeImage(image: string | null): this {
    this.largeImage = RichPresenceAssets.parseImage(image);
    return this;
  }

  public setSmallImage(image: string | null): this {
    this.smallImage = RichPresenceAssets.parseImage(image);
    return this;
  }

  public setLargeText(text: string | null): this {
    this.largeText = text;
    return this;
  }

  public setSmallText(text: string | null): this {
    this.smallText = text;
    return this;
  }
}

export interface CustomStatusOptions {
  state?: string | null;
  emoji?: EmojiIdentifierResolvable | null;
}

export class CustomStatus extends Activity {
  public constructor(client: Client | Presence, data: RawActivityData | CustomStatusOptions = {}) {
    if (!client) throw new DiscordError('INVALID_TYPE');
    const targetPresence = 'presence' in client ? client.presence : client;
    super(targetPresence as Presence, {
      name: ' ',
      type: ActivityTypes.CUSTOM,
      ...data,
    } as RawActivityData);
  }

  public setEmoji(emoji: EmojiIdentifierResolvable): this {
    this.emoji = Util.resolvePartialEmoji(emoji);
    return this;
  }

  public setState(state: string | null): this {
    if (typeof state === 'string' && state.length > 128) {
      throw new DiscordError('INVALID_TYPE');
    }
    this.state = state;
    return this;
  }

  public override toJSON(): Record<string, unknown> {
    if (!this.emoji && !this.state) {
      throw new DiscordError('INVALID_TYPE');
    }
    return {
      name: this.name,
      emoji: this.emoji,
      type: ActivityTypes.CUSTOM,
      state: this.state,
    };
  }
}

export class RichPresence extends Activity {
  public secrets: Record<string, string | undefined> = {};
  public metadata: Record<string, unknown> = {};

  public constructor(client: Client | Presence, data: RawActivityData = {}) {
    if (!client) throw new DiscordError('INVALID_TYPE');
    const targetPresence = 'presence' in client ? client.presence : client;
    super(targetPresence as Presence, { type: 0, ...data });
    this.setup(data);
  }

  public setup(data: RawActivityData = {}): void {
    this.secrets = 'secrets' in data && data.secrets ? data.secrets : {};
    this.metadata = 'metadata' in data && data.metadata ? data.metadata : {};
  }

  public setAssetsLargeImage(image: string | null): this {
    this.assets.setLargeImage(image);
    return this;
  }

  public setAssetsSmallImage(image: string | null): this {
    this.assets.setSmallImage(image);
    return this;
  }

  public setAssetsLargeText(text: string | null): this {
    this.assets.setLargeText(text);
    return this;
  }

  public setAssetsSmallText(text: string | null): this {
    this.assets.setSmallText(text);
    return this;
  }

  public setName(name: string): this {
    this.name = name;
    return this;
  }

  public setURL(url: string | null): this {
    if (typeof url === 'string' && !URL.canParse(url)) {
      throw new DiscordError('INVALID_TYPE');
    }
    this.url = url;
    return this;
  }

  public setType(type: number | string): this {
    this.type = typeof type === 'number' ? type : (ActivityTypes as unknown as Record<string, number>)[type];
    return this;
  }

  public setApplicationId(id: Snowflake | null): this {
    this.applicationId = id;
    return this;
  }

  public setState(state: string | null): this {
    this.state = state;
    return this;
  }

  public setDetails(details: string | null): this {
    this.details = details;
    return this;
  }

  public setParty(party: RichParty | null): this {
    if (typeof party === 'object' && party !== null) {
      if (!party.max || typeof party.max !== 'number') throw new DiscordError('INVALID_TYPE');
      if (!party.current || typeof party.current !== 'number') throw new DiscordError('INVALID_TYPE');
      if (party.current > party.max) throw new DiscordError('INVALID_TYPE');
      if (!party.id || typeof party.id !== 'string') party.id = randomUUID();
      this.party = {
        size: [party.current, party.max],
        id: party.id,
      };
    } else {
      this.party = null;
    }
    return this;
  }

  public setStartTimestamp(timestamp: Date | number | null): this {
    if (!this.timestamps) this.timestamps = { start: null, end: null };
    const ts = timestamp instanceof Date ? timestamp.getTime() : timestamp;
    this.timestamps.start = ts;
    return this;
  }

  public setEndTimestamp(timestamp: Date | number | null): this {
    if (!this.timestamps) this.timestamps = { start: null, end: null };
    const ts = timestamp instanceof Date ? timestamp.getTime() : timestamp;
    this.timestamps.end = ts;
    return this;
  }

  public setButtons(...button: (RichButton | RichButton[])[]): this {
    if (button.length === 0) {
      this.buttons = [];
      delete this.metadata.button_urls;
      return this;
    } else if (button.length > 2) {
      throw new DiscordError('INVALID_TYPE');
    }

    this.buttons = [];
    this.metadata.button_urls = [];

    const flatButtons = button.flat(2) as RichButton[];
    for (const b of flatButtons) {
      if (b.name && b.url) {
        this.buttons.push(b.name);
        if (!URL.canParse(b.url)) throw new DiscordError('INVALID_TYPE');
        (this.metadata.button_urls as string[]).push(b.url);
      } else {
        throw new DiscordError('INVALID_TYPE');
      }
    }
    return this;
  }

  public setPlatform(platform: ActivityPlatform | null): this {
    this.platform = platform;
    return this;
  }

  public setJoinSecret(join: string | null): this {
    this.secrets.join = join ?? undefined;
    return this;
  }

  public addButton(name: string, url: string): this {
    if (!name || !url) throw new DiscordError('INVALID_TYPE');
    if (typeof name !== 'string') throw new DiscordError('INVALID_TYPE');
    if (!URL.canParse(url)) throw new DiscordError('INVALID_TYPE');
    this.buttons.push(name);
    if (Array.isArray(this.metadata.button_urls)) {
      this.metadata.button_urls.push(url);
    } else {
      this.metadata.button_urls = [url];
    }
    return this;
  }

  public override toJSON(...props: Record<string, boolean | string>[]): Record<string, unknown> {
    return super.toJSON(
      {
        applicationId: 'application_id',
        sessionId: 'session_id',
        syncId: 'sync_id',
        createdTimestamp: 'created_at',
      },
      ...props,
    );
  }

  public static async getExternal(
    client: Client,
    applicationId: Snowflake,
    ...images: string[]
  ): Promise<ExternalAssets[]> {
    if (!client || !client.token) throw new DiscordError('INVALID_TYPE');
    if (!/^[0-9]{17,19}$/.test(applicationId)) {
      throw new DiscordError('INVALID_TYPE');
    }
    if (images.length > 2) {
      throw new DiscordError('INVALID_TYPE');
    }
    if (images.some(image => !URL.canParse(image))) {
      throw new DiscordError('INVALID_TYPE');
    }
    const api = (client as unknown as { api: { applications: Record<string, { 'external-assets': { post: (opts: { data: { urls: string[] } }) => Promise<ExternalAssets[]> } }> } }).api;
    const res = await api.applications[applicationId]['external-assets'].post({
      data: {
        urls: images,
      },
    });
    return res;
  }

  public override toString(): string {
    return this.name;
  }

  public override _clone(): RichPresence {
    return Object.assign(Object.create(this), this) as RichPresence;
  }
}

/**
 * SpotifyRPC
 * @extends {RichPresence}
 */
export class SpotifyRPC extends RichPresence {
  public declare metadata: SpotifyMetadata;

  public constructor(client: Client | Presence, options: RawActivityData = {}) {
    if (!client) throw new DiscordError('INVALID_TYPE');
    const clientUser = (client as unknown as { user?: { id?: Snowflake } }).user;
    super(client, {
      name: 'Spotify',
      type: ActivityTypes.LISTENING,
      party: {
        id: `spotify:${clientUser?.id ?? ''}`,
        size: [0, 0],
      },
      id: 'spotify:1',
      flags: 48,
      ...options,
    });
    this.setupSpotify(options);
  }

  public setupSpotify(options: RawActivityData): void {
    const rawMeta = options.metadata as Partial<SpotifyMetadata> | undefined;
    this.metadata = {
      album_id: rawMeta?.album_id || null,
      artist_ids: rawMeta?.artist_ids || [],
      context_uri: rawMeta?.context_uri || null,
    };
  }

  public setSongId(id: string): this {
    this.syncId = id;
    return this;
  }

  public addArtistId(id: string): this {
    if (!this.metadata.artist_ids) this.metadata.artist_ids = [];
    this.metadata.artist_ids.push(id);
    return this;
  }

  public setArtistIds(...ids: (string | string[])[]): this {
    if (!ids.length) {
      this.metadata.artist_ids = [];
      return this;
    }
    if (!this.metadata.artist_ids) this.metadata.artist_ids = [];
    const flatIds = ids.flat(2) as string[];
    for (const id of flatIds) {
      this.metadata.artist_ids.push(id);
    }
    return this;
  }

  public setAlbumId(id: string): this {
    this.metadata.album_id = id;
    this.metadata.context_uri = `spotify:album:${id}`;
    return this;
  }

  public override toJSON(): Record<string, unknown> {
    return super.toJSON({ id: false, emoji: false, platform: false, buttons: false });
  }
}

export default Presence;
