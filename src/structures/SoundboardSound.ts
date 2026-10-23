import type { Snowflake } from 'discord-api-types/v10';
import { Base } from './Base.js';
import type { Client } from '../client/Client.js';
import type { Guild } from './Guild.js';
import type { User } from './User.js';

export interface RawSoundboardSoundData {
  sound_id: Snowflake;
  name: string;
  volume: number;
  emoji_id: Snowflake | null;
  emoji_name: string | null;
  guild_id?: Snowflake;
  available: boolean;
  user?: Record<string, unknown>;
}

export interface SoundboardEditData {
  name?: string;
  volume?: number;
  emojiId?: Snowflake | null;
  emojiName?: string | null;
}

/**
 * Represents a Discord Soundboard sound.
 */
export class SoundboardSound extends Base {
  public id: Snowflake;
  public name!: string;
  public volume!: number;
  public emojiId!: Snowflake | null;
  public emojiName!: string | null;
  public guildId: Snowflake | null = null;
  public available!: boolean;
  public user: User | null = null;

  public constructor(client: Client, data: RawSoundboardSoundData) {
    super(client);
    this.id = data.sound_id;
    this._patch(data);
  }

  public _patch(data: RawSoundboardSoundData): void {
    this.name = data.name;
    this.volume = data.volume;
    this.emojiId = data.emoji_id ?? null;
    this.emojiName = data.emoji_name ?? null;
    this.guildId = data.guild_id ?? this.guildId;
    this.available = data.available ?? true;

    if (data.user) {
      this.user = this.client.users._add(data.user);
    }
  }

  /**
   * The guild this soundboard sound belongs to, if not a default Discord sound.
   */
  public get guild(): Guild | null {
    return this.guildId ? this.client.guilds.cache.get(this.guildId) ?? null : null;
  }

  /**
   * Plays this soundboard sound into a connected voice or stage channel.
   * @param channelId Target voice/stage channel id
   */
  public async play(channelId: Snowflake): Promise<void> {
    const route = this.client.api.channels(channelId);
    await (route as unknown as {
      ['send-soundboard-sound']: {
        post: (options: { data: { sound_id: Snowflake; source_guild_id?: Snowflake } }) => Promise<unknown>;
      };
    })['send-soundboard-sound'].post({
      data: {
        sound_id: this.id,
        source_guild_id: this.guildId ?? undefined,
      },
    });
  }

  /**
   * Edits this soundboard sound.
   */
  public async edit(data: SoundboardEditData): Promise<SoundboardSound> {
    if (!this.guildId) throw new Error('Cannot edit default Discord soundboard sounds');
    const route = this.client.api.guilds(this.guildId);
    const updated = (await (route as unknown as {
      ['soundboard-sounds'](soundId: Snowflake): {
        patch: (options: {
          data: {
            name?: string;
            volume?: number;
            emoji_id?: Snowflake | null;
            emoji_name?: string | null;
          };
        }) => Promise<RawSoundboardSoundData>;
      };
    })['soundboard-sounds'](this.id).patch({
      data: {
        name: data.name,
        volume: data.volume,
        emoji_id: data.emojiId,
        emoji_name: data.emojiName,
      },
    })) as RawSoundboardSoundData;

    this._patch(updated);
    return this;
  }

  /**
   * Deletes this soundboard sound.
   */
  public async delete(): Promise<void> {
    if (!this.guildId) throw new Error('Cannot delete default Discord soundboard sounds');
    const route = this.client.api.guilds(this.guildId);
    await (route as unknown as {
      ['soundboard-sounds'](soundId: Snowflake): {
        delete: () => Promise<unknown>;
      };
    })['soundboard-sounds'](this.id).delete();
  }
}

export default SoundboardSound;
