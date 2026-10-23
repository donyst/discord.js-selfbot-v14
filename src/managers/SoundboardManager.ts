import { Collection } from '@discordjs/collection';
import type { Snowflake } from 'discord-api-types/v10';
import { CachedManager } from './CachedManager.js';
import { SoundboardSound, type RawSoundboardSoundData, type SoundboardEditData } from '../structures/SoundboardSound.js';
import type { Client } from '../client/Client.js';

export interface SoundboardCreateData {
  name: string;
  sound: string; // Base64 audio string (data:audio/mp3;base64,...)
  volume?: number;
  emojiId?: Snowflake | null;
  emojiName?: string | null;
}

export interface SoundboardPlayOptions {
  sourceGuildId?: Snowflake;
}

/**
 * Manages API methods for Discord Soundboard sounds and plays audio into voice/stage channels.
 */
export class SoundboardManager extends CachedManager<Snowflake, SoundboardSound, RawSoundboardSoundData> {
  public constructor(client: Client) {
    super(client, SoundboardSound);
  }

  /**
   * Plays a soundboard sound in a voice or stage channel.
   * @param channelId Voice or Stage Channel ID
   * @param soundId Soundboard Sound ID
   * @param options Options including source guild id
   */
  public async play(channelId: Snowflake, soundId: Snowflake, options?: SoundboardPlayOptions): Promise<void> {
    const route = this.client.api.channels(channelId);
    await (route as unknown as {
      ['send-soundboard-sound']: {
        post: (opts: { data: { sound_id: Snowflake; source_guild_id?: Snowflake } }) => Promise<unknown>;
      };
    })['send-soundboard-sound'].post({
      data: {
        sound_id: soundId,
        source_guild_id: options?.sourceGuildId,
      },
    });
  }

  /**
   * Fetches soundboard sounds belonging to a specific guild.
   */
  public async fetchGuildSounds(guildId: Snowflake): Promise<Collection<Snowflake, SoundboardSound>> {
    const route = this.client.api.guilds(guildId);
    const res = (await (route as unknown as {
      ['soundboard-sounds']: {
        get: () => Promise<{ items: RawSoundboardSoundData[] }>;
      };
    })['soundboard-sounds'].get()) as { items?: RawSoundboardSoundData[] } | RawSoundboardSoundData[];

    const items = Array.isArray(res) ? res : res.items ?? [];
    const col = new Collection<Snowflake, SoundboardSound>();

    for (const raw of items) {
      const sound = this._add(raw, true, { id: raw.sound_id });
      col.set(sound.id, sound);
    }

    return col;
  }

  /**
   * Fetches global default Discord soundboard sounds.
   */
  public async fetchDefaultSounds(): Promise<Collection<Snowflake, SoundboardSound>> {
    const route = this.client.api['soundboard-default-sounds'];
    const res = (await (route as unknown as {
      get: () => Promise<RawSoundboardSoundData[]>;
    }).get()) as RawSoundboardSoundData[];

    const col = new Collection<Snowflake, SoundboardSound>();
    for (const raw of res) {
      const sound = this._add(raw, true, { id: raw.sound_id });
      col.set(sound.id, sound);
    }

    return col;
  }

  /**
   * Creates a new soundboard sound in a guild.
   */
  public async create(guildId: Snowflake, data: SoundboardCreateData): Promise<SoundboardSound> {
    const route = this.client.api.guilds(guildId);
    const res = (await (route as unknown as {
      ['soundboard-sounds']: {
        post: (opts: {
          data: {
            name: string;
            sound: string;
            volume?: number;
            emoji_id?: Snowflake | null;
            emoji_name?: string | null;
          };
        }) => Promise<RawSoundboardSoundData>;
      };
    })['soundboard-sounds'].post({
      data: {
        name: data.name,
        sound: data.sound,
        volume: data.volume,
        emoji_id: data.emojiId,
        emoji_name: data.emojiName,
      },
    })) as RawSoundboardSoundData;

    return this._add(res, true, { id: res.sound_id });
  }

  /**
   * Edits an existing soundboard sound.
   */
  public async edit(guildId: Snowflake, soundId: Snowflake, data: SoundboardEditData): Promise<SoundboardSound> {
    const existing = this.cache.get(soundId);
    if (existing) {
      return existing.edit(data);
    }

    const route = this.client.api.guilds(guildId);
    const res = (await (route as unknown as {
      ['soundboard-sounds'](id: Snowflake): {
        patch: (opts: { data: Record<string, unknown> }) => Promise<RawSoundboardSoundData>;
      };
    })['soundboard-sounds'](soundId).patch({
      data: {
        name: data.name,
        volume: data.volume,
        emoji_id: data.emojiId,
        emoji_name: data.emojiName,
      },
    })) as RawSoundboardSoundData;

    return this._add(res, true, { id: res.sound_id });
  }

  /**
   * Deletes a soundboard sound.
   */
  public async delete(guildId: Snowflake, soundId: Snowflake): Promise<void> {
    const route = this.client.api.guilds(guildId);
    await (route as unknown as {
      ['soundboard-sounds'](id: Snowflake): {
        delete: () => Promise<unknown>;
      };
    })['soundboard-sounds'](soundId).delete();
    this.cache.delete(soundId);
  }
}

export default SoundboardManager;
