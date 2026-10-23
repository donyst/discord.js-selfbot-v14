import { Emoji, type APIEmojiData } from './Emoji.js';
import type { Guild } from './Guild.js';
import type { GuildPreview } from './GuildPreview.js';
import type { Client } from '../client/Client.js';

export interface BaseGuildEmojiData extends APIEmojiData {
  require_colons?: boolean | null;
  managed?: boolean | null;
  available?: boolean | null;
}

/**
 * Parent class for {@link GuildEmoji} and {@link GuildPreviewEmoji}.
 */
export abstract class BaseGuildEmoji extends Emoji {
  public guild: Guild | GuildPreview;
  public requiresColons: boolean | null = null;
  public managed: boolean | null = null;
  public available: boolean | null = null;

  public constructor(client: Client | unknown, data: BaseGuildEmojiData, guild: Guild | GuildPreview) {
    super(client, data);

    this.guild = guild;
    this.requiresColons = null;
    this.managed = null;
    this.available = null;

    this._patch(data);
  }

  public override _patch(data: BaseGuildEmojiData): this {
    if ('name' in data) this.name = data.name ?? null;

    if ('require_colons' in data) {
      this.requiresColons = data.require_colons ?? null;
    }

    if ('managed' in data) {
      this.managed = data.managed ?? null;
    }

    if ('available' in data) {
      this.available = data.available ?? null;
    }

    return this;
  }
}

export default BaseGuildEmoji;
