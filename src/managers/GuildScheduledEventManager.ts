import { Collection } from '@discordjs/collection';
import { CachedManager } from './CachedManager.js';
import { DiscordjsTypeError as DJSTypeError, DiscordjsError as DJSError } from '../errors/index.js';
import {
  GuildScheduledEvent,
  type RawGuildScheduledEventData,
  type GuildScheduledEventStatus,
  type GuildScheduledEventEntityType,
  type GuildScheduledEventRecurrenceRuleFrequency,
  type GuildScheduledEventRecurrenceRuleWeekday,
  type GuildScheduledEventRecurrenceRuleNWeekday,
  type GuildScheduledEventRecurrenceRuleMonth,
} from '../structures/GuildScheduledEvent.js';
import { PrivacyLevels, GuildScheduledEventEntityTypes, GuildScheduledEventStatuses } from '../util/Constants.js';
import DataResolver from '../util/DataResolver.js';
import Util from '../util/Util.js';
import type { Snowflake, BaseFetchOptions, BufferResolvable, GuildVoiceChannelResolvable } from '../types/index.js';
import type { Guild } from '../structures/Guild.js';
import type { GuildMember } from '../structures/GuildMember.js';
import type { User } from '../structures/User.js';
import type { PrivacyLevel } from '../structures/StageInstance.js';

export type GuildScheduledEventResolvable = Snowflake | GuildScheduledEvent;

export interface GuildScheduledEventRecurrenceRuleOptions {
  startAt: Date | number | string;
  frequency: GuildScheduledEventRecurrenceRuleFrequency;
  interval: number;
  byWeekday?: GuildScheduledEventRecurrenceRuleWeekday[] | null;
  byNWeekday?: GuildScheduledEventRecurrenceRuleNWeekday[] | null;
  byMonth?: GuildScheduledEventRecurrenceRuleMonth[] | null;
  byMonthDay?: number[] | null;
}

export interface GuildScheduledEventEntityMetadataOptions {
  location?: string;
}

export interface GuildScheduledEventCreateOptions {
  name: string;
  scheduledStartTime: Date | number | string;
  scheduledEndTime?: Date | number | string;
  privacyLevel: PrivacyLevel | number;
  entityType: GuildScheduledEventEntityType | number;
  description?: string;
  channel?: GuildVoiceChannelResolvable;
  entityMetadata?: GuildScheduledEventEntityMetadataOptions;
  image?: BufferResolvable | unknown;
  reason?: string;
  recurrenceRule?: GuildScheduledEventRecurrenceRuleOptions;
}

export interface FetchGuildScheduledEventOptions extends BaseFetchOptions {
  guildScheduledEvent?: GuildScheduledEventResolvable;
  withUserCount?: boolean;
}

export interface FetchGuildScheduledEventsOptions {
  cache?: boolean;
  withUserCount?: boolean;
}

export interface GuildScheduledEventEditOptions {
  name?: string;
  scheduledStartTime?: Date | number | string;
  scheduledEndTime?: Date | number | string;
  privacyLevel?: PrivacyLevel | number;
  entityType?: GuildScheduledEventEntityType | number;
  description?: string;
  channel?: GuildVoiceChannelResolvable | null;
  status?: GuildScheduledEventStatus | number;
  entityMetadata?: GuildScheduledEventEntityMetadataOptions;
  image?: BufferResolvable | unknown;
  reason?: string;
  recurrenceRule?: GuildScheduledEventRecurrenceRuleOptions | null;
}

export interface FetchGuildScheduledEventSubscribersOptions {
  limit?: number;
  withMember?: boolean;
  before?: Snowflake;
  after?: Snowflake;
}

export interface GuildScheduledEventUser {
  guildScheduledEventId: Snowflake;
  user: User;
  member: GuildMember | null;
}

/**
 * Manages API methods for GuildScheduledEvents and stores their cache.
 * @extends {CachedManager}
 */
export class GuildScheduledEventManager extends CachedManager<
  Snowflake,
  GuildScheduledEvent,
  GuildScheduledEventResolvable
> {
  /**
   * The guild this manager belongs to
   */
  public guild: Guild;

  public constructor(guild: Guild, iterable?: Iterable<GuildScheduledEvent>) {
    super(guild.client, GuildScheduledEvent, iterable);
    this.guild = guild;
  }

  /**
   * Creates a new guild scheduled event.
   */
  public async create(options: GuildScheduledEventCreateOptions): Promise<GuildScheduledEvent> {
    if (typeof options !== 'object' || options === null) {
      throw new DJSTypeError('INVALID_TYPE', 'options', 'object', true);
    }
    const {
      channel,
      name,
      scheduledStartTime,
      description,
      scheduledEndTime,
      entityMetadata,
      reason,
      image,
      recurrenceRule,
    } = options;

    let privacyLevel: number =
      typeof options.privacyLevel === 'string'
        ? (PrivacyLevels as Record<string, number>)[options.privacyLevel]
        : options.privacyLevel;

    let entityType: number =
      typeof options.entityType === 'string'
        ? (GuildScheduledEventEntityTypes as Record<string, number>)[options.entityType]
        : options.entityType;

    let entity_metadata: { location?: string } | null | undefined;
    let channel_id: Snowflake | null | undefined;

    if (entityType === GuildScheduledEventEntityTypes.EXTERNAL) {
      channel_id = typeof channel === 'undefined' ? (channel as unknown as Snowflake) : null;
      entity_metadata = { location: entityMetadata?.location };
    } else {
      const channels = this.guild.channels as unknown as { resolveId(c: unknown): Snowflake | null };
      channel_id = channels.resolveId(channel);
      if (!channel_id) throw new DJSError('GUILD_VOICE_CHANNEL_RESOLVE');
      entity_metadata = typeof entityMetadata === 'undefined' ? entityMetadata : null;
    }

    const resolvedImage = image ? await DataResolver.resolveImage(image as Parameters<typeof DataResolver.resolveImage>[0]) : undefined;
    const util = Util as unknown as {
      transformGuildScheduledEventRecurrenceRule(r: unknown): unknown;
    };

    const api = this.client.api as unknown as {
      guilds(
        guildId: Snowflake,
        endpoint: string,
      ): {
        post(opts: { data: unknown; reason?: string }): Promise<RawGuildScheduledEventData>;
      };
    };

    const data = await api.guilds(this.guild.id, 'scheduled-events').post({
      data: {
        channel_id,
        name,
        privacy_level: privacyLevel,
        scheduled_start_time: new Date(scheduledStartTime).toISOString(),
        scheduled_end_time: scheduledEndTime ? new Date(scheduledEndTime).toISOString() : scheduledEndTime,
        description,
        image: resolvedImage,
        entity_type: entityType,
        entity_metadata,
        recurrence_rule: recurrenceRule && util.transformGuildScheduledEventRecurrenceRule(recurrenceRule),
      },
      reason,
    });

    return this._add(data);
  }

  /**
   * Obtains one or more guild scheduled events from Discord, or the guild cache if it's already available.
   */
  public fetch(
    options: GuildScheduledEventResolvable | FetchGuildScheduledEventOptions,
  ): Promise<GuildScheduledEvent>;
  public fetch(options?: FetchGuildScheduledEventsOptions): Promise<Collection<Snowflake, GuildScheduledEvent>>;
  public async fetch(
    options:
      | GuildScheduledEventResolvable
      | FetchGuildScheduledEventOptions
      | FetchGuildScheduledEventsOptions = {},
  ): Promise<GuildScheduledEvent | Collection<Snowflake, GuildScheduledEvent>> {
    const opts = typeof options === 'object' && options !== null ? options : {};
    const id = this.resolveId(
      (opts as FetchGuildScheduledEventOptions).guildScheduledEvent ??
        (options as GuildScheduledEventResolvable),
    );

    const api = this.client.api as unknown as {
      guilds(
        guildId: Snowflake,
        endpoint: string,
        id?: Snowflake,
      ): {
        get(opts: { query?: unknown }): Promise<RawGuildScheduledEventData | RawGuildScheduledEventData[]>;
      };
    };

    if (id) {
      if (!(opts as BaseFetchOptions).force) {
        const existing = this.cache.get(id);
        if (existing) return existing;
      }

      const data = (await api
        .guilds(this.guild.id, 'scheduled-events', id)
        .get({ query: { with_user_count: (opts as FetchGuildScheduledEventOptions).withUserCount ?? true } })) as RawGuildScheduledEventData;
      return this._add(data, (opts as BaseFetchOptions).cache);
    }

    const data = (await api
      .guilds(this.guild.id, 'scheduled-events')
      .get({ query: { with_user_count: (opts as FetchGuildScheduledEventsOptions).withUserCount ?? true } })) as RawGuildScheduledEventData[];

    return data.reduce(
      (coll: Collection<Snowflake, GuildScheduledEvent>, rawData: RawGuildScheduledEventData) =>
        coll.set(rawData.id, this._add(rawData, (opts as FetchGuildScheduledEventsOptions).cache)),
      new Collection<Snowflake, GuildScheduledEvent>(),
    );
  }

  /**
   * Edits a guild scheduled event.
   */
  public async edit(
    guildScheduledEvent: GuildScheduledEventResolvable,
    options: GuildScheduledEventEditOptions,
  ): Promise<GuildScheduledEvent> {
    const guildScheduledEventId = this.resolveId(guildScheduledEvent);
    if (!guildScheduledEventId) throw new DJSError('GUILD_SCHEDULED_EVENT_RESOLVE');

    if (typeof options !== 'object' || options === null) {
      throw new DJSTypeError('INVALID_TYPE', 'options', 'object', true);
    }

    const {
      channel,
      name,
      scheduledStartTime,
      description,
      scheduledEndTime,
      entityMetadata,
      reason,
      image,
      recurrenceRule,
    } = options;

    let privacyLevel: number | undefined =
      typeof options.privacyLevel === 'string'
        ? (PrivacyLevels as Record<string, number>)[options.privacyLevel]
        : options.privacyLevel;

    let entityType: number | undefined =
      typeof options.entityType === 'string'
        ? (GuildScheduledEventEntityTypes as Record<string, number>)[options.entityType]
        : options.entityType;

    let status: number | undefined =
      typeof options.status === 'string'
        ? (GuildScheduledEventStatuses as Record<string, number>)[options.status]
        : options.status;

    let entity_metadata: { location?: string } | undefined;
    if (entityMetadata) {
      entity_metadata = {
        location: entityMetadata.location,
      };
    }

    const resolvedImage = image ? await DataResolver.resolveImage(image as Parameters<typeof DataResolver.resolveImage>[0]) : undefined;
    const channels = this.guild.channels as unknown as { resolveId(c: unknown): Snowflake | null };
    const util = Util as unknown as {
      transformGuildScheduledEventRecurrenceRule(r: unknown): unknown;
    };

    const api = this.client.api as unknown as {
      guilds(
        guildId: Snowflake,
        endpoint: string,
        id: Snowflake,
      ): {
        patch(opts: { data: unknown; reason?: string }): Promise<RawGuildScheduledEventData>;
      };
    };

    const data = await api.guilds(this.guild.id, 'scheduled-events', guildScheduledEventId).patch({
      data: {
        channel_id: typeof channel === 'undefined' ? channel : (channel === null ? null : channels.resolveId(channel)),
        name,
        privacy_level: privacyLevel,
        scheduled_start_time: scheduledStartTime ? new Date(scheduledStartTime).toISOString() : undefined,
        scheduled_end_time: scheduledEndTime ? new Date(scheduledEndTime).toISOString() : scheduledEndTime,
        description,
        entity_type: entityType,
        status,
        image: resolvedImage,
        entity_metadata,
        recurrence_rule: recurrenceRule && util.transformGuildScheduledEventRecurrenceRule(recurrenceRule),
      },
      reason,
    });

    return this._add(data);
  }

  /**
   * Deletes a guild scheduled event.
   */
  public async delete(guildScheduledEvent: GuildScheduledEventResolvable): Promise<void> {
    const guildScheduledEventId = this.resolveId(guildScheduledEvent);
    if (!guildScheduledEventId) throw new DJSError('GUILD_SCHEDULED_EVENT_RESOLVE');

    const api = this.client.api as unknown as {
      guilds(
        guildId: Snowflake,
        endpoint: string,
        id: Snowflake,
      ): {
        delete(): Promise<void>;
      };
    };

    await api.guilds(this.guild.id, 'scheduled-events', guildScheduledEventId).delete();
  }

  /**
   * Fetches subscribers of a guild scheduled event.
   */
  public async fetchSubscribers(
    guildScheduledEvent: GuildScheduledEventResolvable,
    options: FetchGuildScheduledEventSubscribersOptions = {},
  ): Promise<Collection<Snowflake, GuildScheduledEventUser>> {
    const guildScheduledEventId = this.resolveId(guildScheduledEvent);
    if (!guildScheduledEventId) throw new DJSError('GUILD_SCHEDULED_EVENT_RESOLVE');

    const { limit, withMember, before, after } = options;

    const api = this.client.api as unknown as {
      guilds(
        guildId: Snowflake,
        endpoint: string,
        id: Snowflake,
      ): {
        users: {
          get(opts: { query: unknown }): Promise<
            {
              guild_scheduled_event_id: Snowflake;
              user: unknown;
              member?: unknown;
            }[]
          >;
        };
      };
    };

    const data = await api
      .guilds(this.guild.id, 'scheduled-events', guildScheduledEventId)
      .users.get({
        query: { limit, with_member: withMember, before, after },
      });

    const clientUsers = this.client.users as unknown as { _add(u: unknown): User };
    const guildMembers = this.guild.members as unknown as { _add(m: unknown): GuildMember };

    return data.reduce(
      (coll: Collection<Snowflake, GuildScheduledEventUser>, rawData) => {
        const user = clientUsers._add(rawData.user);
        return coll.set((user as { id: Snowflake }).id, {
          guildScheduledEventId: rawData.guild_scheduled_event_id,
          user,
          member: rawData.member ? guildMembers._add(Object.assign({ user: rawData.user }, rawData.member as Record<string, unknown>)) : null,
        });
      },
      new Collection<Snowflake, GuildScheduledEventUser>(),
    );
  }
}

export default GuildScheduledEventManager;
