import type { Snowflake } from 'discord-api-types/v10';
import type { Guild } from './Guild.js';
import type { VoiceChannel } from './VoiceChannel.js';
import { Emoji, type APIEmojiData } from './Emoji.js';

export type VoiceChannelEffectSendAnimationType = number;

export interface RawVoiceChannelEffectData {
  channel_id: Snowflake;
  user_id: Snowflake;
  emoji?: APIEmojiData | null;
  animation_type?: VoiceChannelEffectSendAnimationType | null;
  animation_id?: number | null;
  sound_id?: Snowflake | number | null;
  sound_volume?: number | null;
}

/**
 * Represents an effect used in a {@link VoiceChannel}.
 */
export class VoiceChannelEffect {
  /**
   * The guild where the effect was sent from.
   */
  public guild: Guild;

  /**
   * The id of the channel the effect was sent in.
   */
  public channelId: Snowflake;

  /**
   * The id of the user that sent the effect.
   */
  public userId: Snowflake;

  /**
   * The emoji of the effect.
   */
  public emoji: Emoji | null;

  /**
   * The animation type of the effect.
   */
  public animationType: VoiceChannelEffectSendAnimationType | null;

  /**
   * The animation id of the effect.
   */
  public animationId: number | null;

  /**
   * The id of the soundboard sound for soundboard effects.
   */
  public soundId: Snowflake | number | null;

  /**
   * The volume of the soundboard sound [0-1] for soundboard effects.
   */
  public soundVolume: number | null;

  public constructor(data: RawVoiceChannelEffectData, guild: Guild) {
    this.guild = guild;
    this.channelId = data.channel_id;
    this.userId = data.user_id;
    this.emoji = data.emoji ? new Emoji(guild.client, data.emoji) : null;
    this.animationType = data.animation_type ?? null;
    this.animationId = data.animation_id ?? null;
    this.soundId = data.sound_id ?? null;
    this.soundVolume = data.sound_volume ?? null;
  }

  /**
   * The channel the effect was sent in.
   */
  public get channel(): VoiceChannel | null {
    return (this.guild.channels.cache.get(this.channelId) as VoiceChannel | undefined) ?? null;
  }
}

export default VoiceChannelEffect;
