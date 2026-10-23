import { CachedManager } from './CachedManager.js';
import { DiscordjsTypeError as DJSTypeError, DiscordjsError as DJSError } from '../errors/index.js';
import {
  StageInstance,
  type RawStageInstanceData,
  type StageInstanceEditOptions,
  type StageInstanceCreateOptions,
} from '../structures/StageInstance.js';
import { PrivacyLevels } from '../util/Constants.js';
import type { Snowflake, BaseFetchOptions } from '../types/index.js';
import type { Guild } from '../structures/Guild.js';
import type StageChannel from '../structures/StageChannel.js';
import type { GuildScheduledEventResolvable } from './GuildScheduledEventManager.js';

export type StageChannelResolvable = StageChannel | Snowflake;

export interface StageInstanceManagerCreateOptions extends StageInstanceCreateOptions {
  guildScheduledEvent?: GuildScheduledEventResolvable;
}

/**
 * Manages API methods for {@link StageInstance} objects and holds their cache.
 * @extends {CachedManager}
 */
export class StageInstanceManager extends CachedManager<
  Snowflake,
  StageInstance,
  RawStageInstanceData
> {
  /**
   * The guild this manager belongs to
   */
  public guild: Guild;

  public constructor(guild: Guild, iterable?: Iterable<StageInstance>) {
    super(guild.client, StageInstance, iterable);
    this.guild = guild;
  }

  /**
   * Creates a new stage instance.
   */
  public async create(
    channel: StageChannelResolvable,
    options: StageInstanceManagerCreateOptions,
  ): Promise<StageInstance> {
    const channels = this.guild.channels as unknown as { resolveId(c: unknown): Snowflake | null };
    const channelId = channels.resolveId(channel);
    if (!channelId) throw new DJSError('STAGE_CHANNEL_RESOLVE');
    if (typeof options !== 'object' || options === null) {
      throw new DJSTypeError('INVALID_TYPE', 'options', 'object', true);
    }

    const { guildScheduledEvent, topic, sendStartNotification } = options;
    let privacyLevel = options.privacyLevel;

    if (privacyLevel !== undefined) {
      privacyLevel = typeof privacyLevel === 'number' ? privacyLevel : (PrivacyLevels as Record<string, number>)[privacyLevel];
    }

    const guildScheduledEventId = guildScheduledEvent
      ? typeof guildScheduledEvent === 'string'
        ? guildScheduledEvent
        : (guildScheduledEvent as { id?: Snowflake }).id
      : undefined;

    const api = this.client.api as unknown as {
      ['stage-instances']: {
        post(opts: { data: unknown }): Promise<RawStageInstanceData>;
      };
    };

    const data = await api['stage-instances'].post({
      data: {
        channel_id: channelId,
        topic,
        privacy_level: privacyLevel,
        send_start_notification: sendStartNotification,
        guild_scheduled_event_id: guildScheduledEventId,
      },
    });

    return this._add(data);
  }

  /**
   * Fetches the stage instance associated with a stage channel, if it exists.
   */
  public async fetch(
    channel: StageChannelResolvable,
    { cache = true, force = false }: BaseFetchOptions = {},
  ): Promise<StageInstance | null> {
    const channels = this.guild.channels as unknown as { resolveId(c: unknown): Snowflake | null };
    const channelId = channels.resolveId(channel);
    if (!channelId) throw new DJSError('STAGE_CHANNEL_RESOLVE');

    if (!force) {
      const existing = this.cache.find(stageInstance => stageInstance.channelId === channelId);
      if (existing) return existing;
    }

    const api = this.client.api as unknown as (
      endpoint: string,
      id: Snowflake,
    ) => {
      get(): Promise<RawStageInstanceData>;
    };

    const data = await api('stage-instances', channelId).get();
    return this._add(data, cache);
  }

  /**
   * Edits an existing stage instance.
   */
  public async edit(
    channel: StageChannelResolvable,
    options: StageInstanceEditOptions,
  ): Promise<StageInstance> {
    if (typeof options !== 'object' || options === null) {
      throw new DJSTypeError('INVALID_TYPE', 'options', 'object', true);
    }
    const channels = this.guild.channels as unknown as { resolveId(c: unknown): Snowflake | null };
    const channelId = channels.resolveId(channel);
    if (!channelId) throw new DJSError('STAGE_CHANNEL_RESOLVE');

    const { topic } = options;
    let privacyLevel = options.privacyLevel;

    if (privacyLevel !== undefined) {
      privacyLevel = typeof privacyLevel === 'number' ? privacyLevel : (PrivacyLevels as Record<string, number>)[privacyLevel];
    }

    const api = this.client.api as unknown as (
      endpoint: string,
      id: Snowflake,
    ) => {
      patch(opts: { data: unknown }): Promise<RawStageInstanceData>;
    };

    const data = await api('stage-instances', channelId).patch({
      data: {
        topic,
        privacy_level: privacyLevel,
      },
    });

    const existing = this.cache.get(data.id);
    if (existing) {
      const clone = (existing as unknown as { _clone(): StageInstance })._clone();
      (clone as unknown as { _patch(d: unknown): void })._patch(data);
      return clone;
    }

    return this._add(data);
  }

  /**
   * Deletes an existing stage instance.
   */
  public async delete(channel: StageChannelResolvable): Promise<void> {
    const channels = this.guild.channels as unknown as { resolveId(c: unknown): Snowflake | null };
    const channelId = channels.resolveId(channel);
    if (!channelId) throw new DJSError('STAGE_CHANNEL_RESOLVE');

    const api = this.client.api as unknown as (
      endpoint: string,
      id: Snowflake,
    ) => {
      delete(): Promise<void>;
    };

    await api('stage-instances', channelId).delete();
  }
}

export default StageInstanceManager;
