import Base from './Base.js';
import Emoji, { type APIEmojiData } from './Emoji.js';
import type { Snowflake } from '../types/index.js';
import type { Guild } from './Guild.js';
import type { InviteGuild } from './InviteGuild.js';
import type { Channel } from './Channel.js';
import type { GuildEmoji } from './GuildEmoji.js';

export interface APIWelcomeChannelData {
  description: string;
  emoji_name?: string | null;
  emoji_id?: Snowflake | null;
  channel_id: Snowflake;
  [key: string]: unknown;
}

export class WelcomeChannel extends Base {
  public guild: Guild | InviteGuild;
  public description: string;
  private _emoji: { name?: string | null; id?: Snowflake | null };
  public channelId: Snowflake;

  public constructor(guild: Guild | InviteGuild, data: APIWelcomeChannelData) {
    super(guild.client);
    this.guild = guild;
    this.description = data.description;
    this._emoji = {
      name: data.emoji_name,
      id: data.emoji_id,
    };
    this.channelId = data.channel_id;
  }

  public get channel(): Channel | null {
    const cache = (this.client as unknown as { channels?: { cache?: { get(id: Snowflake): Channel | undefined } } }).channels?.cache;
    return cache?.get(this.channelId) ?? null;
  }

  public get emoji(): GuildEmoji | Emoji {
    if (this._emoji.id) {
      const cached = (this.client as unknown as { emojis?: { cache?: { get(id: Snowflake): GuildEmoji | undefined } } }).emojis?.cache?.get(this._emoji.id);
      if (cached) return cached;
    }
    return new Emoji(this.client, this._emoji as unknown as APIEmojiData);
  }
}

export default WelcomeChannel;
