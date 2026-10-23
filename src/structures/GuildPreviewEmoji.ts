import type { Snowflake } from 'discord-api-types/v10';
import { BaseGuildEmoji, type BaseGuildEmojiData } from './BaseGuildEmoji.js';
import type { GuildPreview } from './GuildPreview.js';
import type { Client } from '../client/Client.js';

export interface RawGuildPreviewEmojiData extends BaseGuildEmojiData {
  roles?: Snowflake[];
}

/**
 * Represents an instance of an emoji belonging to a public guild obtained through Discord's preview endpoint.
 * @extends {BaseGuildEmoji}
 */
export class GuildPreviewEmoji extends BaseGuildEmoji {
  public declare guild: GuildPreview;

  /**
   * The roles this emoji is active for
   */
  public roles: Snowflake[];

  public constructor(client: Client, data: RawGuildPreviewEmojiData, guild: GuildPreview) {
    super(client, data, guild);
    this.roles = data.roles ?? [];
  }
}

export default GuildPreviewEmoji;
