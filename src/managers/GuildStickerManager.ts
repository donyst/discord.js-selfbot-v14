import { Collection } from '@discordjs/collection';
import { CachedManager } from './CachedManager.js';
import { DiscordjsTypeError as DJSTypeError } from '../errors/index.js';
import MessagePayload from '../structures/MessagePayload.js';
import { Sticker, type APIStickerData } from '../structures/Sticker.js';
import type { Snowflake, BaseFetchOptions, BufferResolvable } from '../types/index.js';
import type { Guild } from '../structures/Guild.js';
import type { User } from '../structures/User.js';

export type StickerResolvable = Sticker | Snowflake;

export interface GuildStickerCreateOptions {
  description?: string | null;
  reason?: string;
}

export interface GuildStickerEditData {
  name?: string;
  description?: string;
  tags?: string;
}

/**
 * Manages API methods for Guild Stickers and stores their cache.
 * @extends {CachedManager}
 */
export class GuildStickerManager extends CachedManager<Snowflake, Sticker, StickerResolvable> {
  /**
   * The guild this manager belongs to
   */
  public guild: Guild;

  public constructor(guild: Guild, iterable?: Iterable<Sticker>) {
    super(guild.client, Sticker, iterable);
    this.guild = guild;
  }

  public override _add(data: APIStickerData, cache?: boolean): Sticker {
    return super._add(data, cache, { extras: [this.guild] });
  }

  /**
   * Creates a new custom sticker in the guild.
   */
  public async create(
    file: BufferResolvable | unknown,
    name: string,
    tags: string,
    { description, reason }: GuildStickerCreateOptions = {},
  ): Promise<Sticker> {
    const payloadClass = MessagePayload as unknown as {
      resolveFile(f: unknown): Promise<{ [key: string]: unknown } | null>;
    };
    const resolvedFile = await payloadClass.resolveFile(file);
    if (!resolvedFile) throw new DJSTypeError('REQ_RESOURCE_TYPE');
    const fileWithKey = { ...resolvedFile, key: 'file' };

    const data = { name, tags, description: description ?? '' };

    const api = this.client.api as unknown as {
      guilds(guildId: Snowflake): {
        stickers: {
          post(opts: {
            data: unknown;
            files: unknown[];
            reason?: string;
            dontUsePayloadJSON?: boolean;
          }): Promise<APIStickerData>;
        };
      };
    };

    const sticker = await api
      .guilds(this.guild.id)
      .stickers.post({ data, files: [fileWithKey], reason, dontUsePayloadJSON: true });

    const actions = this.client.actions as unknown as {
      GuildStickerCreate: {
        handle(guild: Guild, s: unknown): { sticker: Sticker };
      };
    };
    return actions.GuildStickerCreate.handle(this.guild, sticker).sticker;
  }

  /**
   * Edits a sticker.
   */
  public async edit(sticker: StickerResolvable, data: GuildStickerEditData, reason?: string): Promise<Sticker> {
    const stickerId = this.resolveId(sticker);
    if (!stickerId) throw new DJSTypeError('INVALID_TYPE', 'sticker', 'StickerResolvable');

    const api = this.client.api as unknown as {
      guilds(guildId: Snowflake): {
        stickers(sId: Snowflake): {
          patch(opts: { data: unknown; reason?: string }): Promise<APIStickerData>;
        };
      };
    };

    const d = await api.guilds(this.guild.id).stickers(stickerId).patch({
      data,
      reason,
    });

    const existing = this.cache.get(stickerId);
    if (existing) {
      const clone = (existing as unknown as { _clone(): Sticker })._clone();
      (clone as unknown as { _patch(patchData: unknown): void })._patch(d);
      return clone;
    }
    return this._add(d);
  }

  /**
   * Deletes a sticker.
   */
  public async delete(sticker: StickerResolvable, reason?: string): Promise<void> {
    const id = this.resolveId(sticker);
    if (!id) throw new DJSTypeError('INVALID_TYPE', 'sticker', 'StickerResolvable');

    const api = this.client.api as unknown as {
      guilds(guildId: Snowflake): {
        stickers(sId: Snowflake): {
          delete(opts: { reason?: string }): Promise<void>;
        };
      };
    };

    await api.guilds(this.guild.id).stickers(id).delete({ reason });
  }

  /**
   * Obtains one or more stickers from Discord, or the sticker cache if they're already available.
   */
  public fetch(id: Snowflake, options?: BaseFetchOptions): Promise<Sticker>;
  public fetch(id?: undefined, options?: BaseFetchOptions): Promise<Collection<Snowflake, Sticker>>;
  public async fetch(
    id?: Snowflake,
    { cache = true, force = false }: BaseFetchOptions = {},
  ): Promise<Sticker | Collection<Snowflake, Sticker>> {
    const api = this.client.api as unknown as {
      guilds(guildId: Snowflake): {
        stickers: {
          get(): Promise<APIStickerData[]>;
          (sId: Snowflake): {
            get(): Promise<APIStickerData>;
          };
        };
      };
    };

    if (id) {
      if (!force) {
        const existing = this.cache.get(id);
        if (existing) return existing;
      }
      const sticker = await api.guilds(this.guild.id).stickers(id).get();
      return this._add(sticker, cache);
    }

    const data = await api.guilds(this.guild.id).stickers.get();
    return new Collection<Snowflake, Sticker>(data.map(sticker => [sticker.id, this._add(sticker, cache)]));
  }

  /**
   * Fetches the user who uploaded this sticker, if this is a guild sticker.
   */
  public async fetchUser(sticker: StickerResolvable): Promise<User | null> {
    const resolvedSticker = this.resolve(sticker);
    if (!resolvedSticker) throw new DJSTypeError('INVALID_TYPE', 'sticker', 'StickerResolvable');

    const api = this.client.api as unknown as {
      guilds(guildId: Snowflake): {
        stickers(sId: Snowflake): {
          get(): Promise<APIStickerData>;
        };
      };
    };

    const data = await api.guilds(this.guild.id).stickers(resolvedSticker.id).get();
    (resolvedSticker as unknown as { _patch(patchData: unknown): void })._patch(data);
    return resolvedSticker.user;
  }
}

export default GuildStickerManager;
