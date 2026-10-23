import type { Snowflake } from 'discord-api-types/v10';
import CachedManager from './CachedManager.js';
import { InteractionResponse, InteractionResponseData } from '../structures/InteractionResponse.js';
import type { Client } from '../client/Client.js';
import type { Guild } from '../structures/Guild.js';
import type TextBasedChannel from '../structures/interfaces/TextBasedChannel.js';

export interface InteractionChannelLike {
  client: Client;
  id: Snowflake;
  guild?: Guild | null;
}

/**
 * Manages API methods for InteractionResponse and holds their cache.
 * @extends {CachedManager}
 */
export class InteractionManager extends CachedManager<
  Snowflake,
  InteractionResponse,
  InteractionResponse | Snowflake
> {
  /**
   * The channel that the responses belong to
   */
  public channel: InteractionChannelLike & (TextBasedChannel | unknown);

  public constructor(
    channel: InteractionChannelLike & (TextBasedChannel | unknown),
    iterable?: Iterable<InteractionResponse>,
  ) {
    super(channel.client, InteractionResponse, iterable);
    this.channel = channel;
  }

  public override _add(
    data: unknown,
    cache = true,
    options: { id?: Snowflake; extras?: unknown[] } = {},
  ): InteractionResponse {
    const rawData = {
      ...(typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {}),
      channelId: this.channel.id,
      guildId: this.channel.guild?.id,
    } as InteractionResponseData;
    if (!rawData.id) return undefined as unknown as InteractionResponse;
    return super._add(rawData, cache, options);
  }
}

export default InteractionManager;
