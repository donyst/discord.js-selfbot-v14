import process from 'node:process';
import Base from './Base.js';
import { DiscordjsError as DjsError } from '../errors/index.js';
import { StickerFormatTypes, StickerTypes } from '../util/Constants.js';
import SnowflakeUtil from '../util/SnowflakeUtil.js';
import type { Snowflake } from '../types/index.js';
import type { Client } from '../client/Client.js';
import type { Guild } from './Guild.js';
import type { User } from './User.js';
import type { StickerPack } from './StickerPack.js';
import type { Collection } from '@discordjs/collection';

export const deletedStickers = new WeakSet<Sticker>();
let deprecationEmittedForDeleted = false;

export type StickerFormatTypeString = 'PNG' | 'APNG' | 'LOTTIE' | 'GIF';
export type StickerTypeString = 'STANDARD' | 'GUILD';

export interface APIStickerData {
  id: Snowflake;
  description?: string | null;
  type?: number;
  format_type?: number;
  name?: string;
  pack_id?: Snowflake | null;
  tags?: string | null;
  available?: boolean | null;
  guild_id?: Snowflake | null;
  user?: unknown;
  sort_value?: number | null;
  [key: string]: unknown;
}

export interface GuildStickerEditData {
  name?: string;
  description?: string | null;
  tags?: string;
}

/**
 * Represents a Sticker.
 */
export class Sticker extends Base {
  public description: string | null = null;
  public type: StickerTypeString | null = null;
  public format: StickerFormatTypeString = 'PNG';
  public name: string = '';
  public packId: Snowflake | null = null;
  public tags: string[] | null = null;
  public available: boolean | null = null;
  public guildId: Snowflake | null = null;
  public user: User | null = null;
  public sortValue: number | null = null;

  public constructor(client: Client | unknown, sticker: APIStickerData) {
    super(client as Client);

    this._patch(sticker);
  }

  public override _patch(sticker: APIStickerData): this {
    this.id = sticker.id;

    if ('description' in sticker) {
      this.description = sticker.description ?? null;
    } else {
      this.description ??= null;
    }

    if ('type' in sticker && sticker.type != null) {
      this.type = (StickerTypes as Record<number, StickerTypeString>)[sticker.type] ?? null;
    } else {
      this.type ??= null;
    }

    if ('format_type' in sticker && sticker.format_type != null) {
      this.format = (StickerFormatTypes as Record<number, StickerFormatTypeString>)[sticker.format_type] ?? 'PNG';
    }

    if ('name' in sticker && sticker.name != null) {
      this.name = sticker.name;
    }

    if ('pack_id' in sticker) {
      this.packId = sticker.pack_id ?? null;
    } else {
      this.packId ??= null;
    }

    if ('tags' in sticker && typeof sticker.tags === 'string') {
      this.tags = sticker.tags.split(', ');
    } else {
      this.tags ??= null;
    }

    if ('available' in sticker) {
      this.available = sticker.available ?? null;
    } else {
      this.available ??= null;
    }

    if ('guild_id' in sticker) {
      this.guildId = sticker.guild_id ?? null;
    } else {
      this.guildId ??= null;
    }

    if (sticker.user) {
      this.user = (this.client.users as unknown as { _add(u: unknown): User })._add(sticker.user);
    } else {
      this.user ??= null;
    }

    if ('sort_value' in sticker) {
      this.sortValue = sticker.sort_value ?? null;
    } else {
      this.sortValue ??= null;
    }

    return this;
  }

  public get createdTimestamp(): number {
    return SnowflakeUtil.timestampFrom(this.id);
  }

  public get createdAt(): Date {
    return new Date(this.createdTimestamp);
  }

  public get deleted(): boolean {
    if (!deprecationEmittedForDeleted) {
      deprecationEmittedForDeleted = true;
      process.emitWarning(
        'Sticker#deleted is deprecated, see https://github.com/discordjs/discord.js/issues/7091.',
        'DeprecationWarning',
      );
    }

    return deletedStickers.has(this);
  }

  public set deleted(value: boolean) {
    if (!deprecationEmittedForDeleted) {
      deprecationEmittedForDeleted = true;
      process.emitWarning(
        'Sticker#deleted is deprecated, see https://github.com/discordjs/discord.js/issues/7091.',
        'DeprecationWarning',
      );
    }

    if (value) deletedStickers.add(this);
    else deletedStickers.delete(this);
  }

  public get partial(): boolean {
    return !this.type;
  }

  public get guild(): Guild | null {
    if (!this.guildId) return null;
    return (this.client.guilds as unknown as { resolve(id: Snowflake): Guild | null }).resolve(this.guildId);
  }

  public get url(): string {
    return (this.client as unknown as { rest: { cdn: { Sticker(id: Snowflake, format: string): string } } }).rest.cdn.Sticker(this.id, this.format);
  }

  public async fetch(): Promise<this> {
    const data = await (this.client as unknown as {
      api: {
        stickers(id: Snowflake): {
          get(): Promise<APIStickerData>;
        };
      };
    }).api
      .stickers(this.id)
      .get();
    this._patch(data);
    return this;
  }

  public async fetchPack(): Promise<StickerPack | null> {
    if (!this.packId) return null;
    const packs = await (this.client as unknown as { fetchPremiumStickerPacks(): Promise<Collection<Snowflake, StickerPack>> }).fetchPremiumStickerPacks();
    return packs.get(this.packId) ?? null;
  }

  public async fetchUser(): Promise<User | null> {
    if (this.partial) await this.fetch();
    if (!this.guildId || !this.guild) throw new DjsError('NOT_GUILD_STICKER');
    return (this.guild.stickers as unknown as { fetchUser(s: Sticker): Promise<User | null> }).fetchUser(this);
  }

  public edit(data: GuildStickerEditData, reason?: string): Promise<Sticker> {
    if (!this.guild) throw new DjsError('NOT_GUILD_STICKER');
    return (this.guild.stickers as unknown as { edit(s: Sticker, d: GuildStickerEditData, r?: string): Promise<Sticker> }).edit(
      this,
      data,
      reason,
    );
  }

  public async delete(reason?: string): Promise<this> {
    if (!this.guild) throw new DjsError('NOT_GUILD_STICKER');
    await (this.guild.stickers as unknown as { delete(s: Sticker, r?: string): Promise<void> }).delete(this, reason);
    return this;
  }

  public equals(other: Sticker | APIStickerData): boolean {
    if (other instanceof Sticker) {
      return (
        other.id === this.id &&
        other.description === this.description &&
        other.type === this.type &&
        other.format === this.format &&
        other.name === this.name &&
        other.packId === this.packId &&
        (other.tags?.length ?? 0) === (this.tags?.length ?? 0) &&
        (other.tags?.every(tag => this.tags?.includes(tag)) ?? false) &&
        other.available === this.available &&
        other.guildId === this.guildId &&
        other.sortValue === this.sortValue
      );
    }
    return (
      other.id === this.id &&
      other.description === this.description &&
      other.name === this.name &&
      other.tags === (this.tags ? this.tags.join(', ') : '')
    );
  }
}

export default Sticker;
