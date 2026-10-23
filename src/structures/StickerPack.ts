import { Collection } from '@discordjs/collection';
import Base from './Base.js';
import Sticker, { type APIStickerData } from './Sticker.js';
import SnowflakeUtil from '../util/SnowflakeUtil.js';
import type { Snowflake, ImageURLOptions } from '../types/index.js';
import type { Client } from '../client/Client.js';

export interface APIStickerPackData {
  id: Snowflake;
  stickers: APIStickerData[];
  name: string;
  sku_id: Snowflake;
  cover_sticker_id?: Snowflake | null;
  description: string;
  banner_asset_id?: Snowflake | null;
  [key: string]: unknown;
}

/**
 * Represents a pack of standard stickers.
 */
export class StickerPack extends Base {
  public stickers: Collection<Snowflake, Sticker>;
  public name: string;
  public skuId: Snowflake;
  public coverStickerId: Snowflake | null;
  public description: string;
  public bannerId: Snowflake | null;

  public constructor(client: Client | unknown, pack: APIStickerPackData) {
    super(client as Client);

    this.id = pack.id;
    this.stickers = new Collection(pack.stickers.map(s => [s.id, new Sticker(client, s)]));
    this.name = pack.name;
    this.skuId = pack.sku_id;
    this.coverStickerId = pack.cover_sticker_id ?? null;
    this.description = pack.description;
    this.bannerId = pack.banner_asset_id ?? null;
  }

  public get createdTimestamp(): number {
    return SnowflakeUtil.timestampFrom(this.id);
  }

  public get createdAt(): Date {
    return new Date(this.createdTimestamp);
  }

  public get coverSticker(): Sticker | null {
    return this.coverStickerId ? this.stickers.get(this.coverStickerId) ?? null : null;
  }

  public bannerURL({ format, size }: ImageURLOptions = {}): string | null {
    return this.bannerId
      ? (this.client as unknown as { rest: { cdn: { StickerPackBanner(id: Snowflake, format?: string, size?: number): string } } }).rest.cdn.StickerPackBanner(
          this.bannerId,
          format,
          size,
        )
      : null;
  }
}

export default StickerPack;
