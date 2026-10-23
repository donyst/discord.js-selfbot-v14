import type { Snowflake } from 'discord-api-types/v10';
import type { Collection } from '@discordjs/collection';
import Base from './Base.js';
import { DiscordjsError as DiscordError } from '../errors/index.js';
import {
  GuildScheduledEventEntityTypes,
  GuildScheduledEventStatuses,
  GuildScheduledEventPrivacyLevels,
  Endpoints,
} from '../util/Constants.js';
import SnowflakeUtil from '../util/SnowflakeUtil.js';
import type { Client } from '../client/Client.js';
import type { Guild } from './Guild.js';
import type User from './User.js';
import type VoiceChannel from './VoiceChannel.js';
import type StageChannel from './StageChannel.js';
import type { PrivacyLevel } from './StageInstance.js';

export type GuildScheduledEventStatus = 'SCHEDULED' | 'ACTIVE' | 'COMPLETED' | 'CANCELED';
export type GuildScheduledEventEntityType = 'STAGE_INSTANCE' | 'VOICE' | 'EXTERNAL';

export interface GuildScheduledEventEntityMetadata {
  location: string | null;
}

export type GuildScheduledEventRecurrenceRuleFrequency = number | string;
export type GuildScheduledEventRecurrenceRuleWeekday = number | string;
export type GuildScheduledEventRecurrenceRuleMonth = number;

export interface GuildScheduledEventRecurrenceRuleNWeekday {
  n: number;
  day: GuildScheduledEventRecurrenceRuleWeekday;
}

export interface GuildScheduledEventRecurrenceRule {
  startTimestamp: number;
  startAt: Date;
  endTimestamp: number | null;
  endAt: Date | null;
  frequency: GuildScheduledEventRecurrenceRuleFrequency;
  interval: number;
  byWeekday?: GuildScheduledEventRecurrenceRuleWeekday[] | null;
  byNWeekday?: GuildScheduledEventRecurrenceRuleNWeekday[] | null;
  byMonth?: GuildScheduledEventRecurrenceRuleMonth[] | null;
  byMonthDay?: number[] | null;
  byYearDay?: number[] | null;
  count?: number | null;
}

export interface RawGuildScheduledEventRecurrenceRuleData {
  start: string;
  end?: string | null;
  frequency: GuildScheduledEventRecurrenceRuleFrequency;
  interval: number;
  by_weekday?: GuildScheduledEventRecurrenceRuleWeekday[] | null;
  by_n_weekday?: GuildScheduledEventRecurrenceRuleNWeekday[] | null;
  by_month?: GuildScheduledEventRecurrenceRuleMonth[] | null;
  by_month_day?: number[] | null;
  by_year_day?: number[] | null;
  count?: number | null;
}

export interface RawGuildScheduledEventData {
  id: Snowflake;
  guild_id: Snowflake;
  channel_id?: Snowflake | null;
  creator_id?: Snowflake | null;
  name?: string | null;
  description?: string | null;
  scheduled_start_time?: string;
  scheduled_end_time?: string | null;
  privacy_level?: number;
  status?: number;
  entity_type?: number;
  entity_id?: Snowflake | null;
  user_count?: number | null;
  creator?: Record<string, unknown> | null;
  entity_metadata?: { location?: string | null } | null;
  image?: string | null;
  recurrence_rule?: RawGuildScheduledEventRecurrenceRuleData | null;
}

export interface GuildScheduledEventEditOptions {
  name?: string;
  scheduledStartTime?: Date | number | string;
  scheduledEndTime?: Date | number | string | null;
  description?: string;
  privacyLevel?: PrivacyLevel | number;
  entityType?: GuildScheduledEventEntityType | number;
  channel?: Snowflake | null;
  entityMetadata?: GuildScheduledEventEntityMetadata | null;
  image?: Buffer | string | null;
  status?: GuildScheduledEventStatus | number;
  reason?: string;
}

export interface CreateGuildScheduledEventInviteURLOptions {
  channel?: Snowflake | unknown;
  maxAge?: number;
  maxUses?: number;
  temporary?: boolean;
  unique?: boolean;
  reason?: string;
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
  member?: unknown;
}

/**
 * Represents a scheduled event in a {@link Guild}.
 * @extends {Base}
 */
export class GuildScheduledEvent extends Base {
  /**
   * The id of the guild scheduled event
   */
  public declare id: Snowflake;

  /**
   * The id of the guild this guild scheduled event belongs to
   */
  public guildId: Snowflake;

  /**
   * The channel id in which the scheduled event will be hosted, or `null` if entity type is `EXTERNAL`
   */
  public channelId!: Snowflake | null;

  /**
   * The id of the user that created this guild scheduled event
   */
  public creatorId!: Snowflake | null;

  /**
   * The name of the guild scheduled event
   */
  public name!: string | null;

  /**
   * The description of the guild scheduled event
   */
  public description!: string | null;

  /**
   * The timestamp the guild scheduled event will start at
   */
  public scheduledStartTimestamp!: number | null;

  /**
   * The timestamp the guild scheduled event will end at
   */
  public scheduledEndTimestamp!: number | null;

  /**
   * The privacy level of the guild scheduled event
   */
  public privacyLevel!: PrivacyLevel | null;

  /**
   * The status of the guild scheduled event
   */
  public status!: GuildScheduledEventStatus | null;

  /**
   * The type of hosting entity associated with the scheduled event
   */
  public entityType!: GuildScheduledEventEntityType | null;

  /**
   * The id of the hosting entity associated with the scheduled event
   */
  public entityId!: Snowflake | null;

  /**
   * The number of users who are subscribed to this guild scheduled event
   */
  public userCount!: number | null;

  /**
   * The user that created this guild scheduled event
   */
  public creator!: User | null;

  /**
   * Additional metadata
   */
  public entityMetadata!: GuildScheduledEventEntityMetadata | null;

  /**
   * The cover image hash for this scheduled event
   */
  public image!: string | null;

  /**
   * The recurrence rule for this scheduled event
   */
  public recurrenceRule!: GuildScheduledEventRecurrenceRule | null;

  public constructor(client: Client, data: RawGuildScheduledEventData) {
    super(client);
    this.id = data.id;
    this.guildId = data.guild_id;
    this._patch(data);
  }

  public _patch(data: Partial<RawGuildScheduledEventData>): void {
    if ('channel_id' in data) {
      this.channelId = data.channel_id ?? null;
    } else {
      this.channelId ??= null;
    }

    if ('creator_id' in data) {
      this.creatorId = data.creator_id ?? null;
    } else {
      this.creatorId ??= null;
    }

    if ('name' in data) {
      this.name = data.name ?? null;
    } else {
      this.name ??= null;
    }

    if ('description' in data) {
      this.description = data.description ?? null;
    } else {
      this.description ??= null;
    }

    if ('scheduled_start_time' in data && data.scheduled_start_time) {
      this.scheduledStartTimestamp = Date.parse(data.scheduled_start_time);
    } else {
      this.scheduledStartTimestamp ??= null;
    }

    if ('scheduled_end_time' in data) {
      this.scheduledEndTimestamp = data.scheduled_end_time ? Date.parse(data.scheduled_end_time) : null;
    } else {
      this.scheduledEndTimestamp ??= null;
    }

    if ('privacy_level' in data && data.privacy_level !== undefined) {
      this.privacyLevel = (GuildScheduledEventPrivacyLevels as unknown as Record<number, PrivacyLevel>)[data.privacy_level] ?? null;
    } else {
      this.privacyLevel ??= null;
    }

    if ('status' in data && data.status !== undefined) {
      this.status = (GuildScheduledEventStatuses as unknown as Record<number, GuildScheduledEventStatus>)[data.status] ?? null;
    } else {
      this.status ??= null;
    }

    if ('entity_type' in data && data.entity_type !== undefined) {
      this.entityType = (GuildScheduledEventEntityTypes as unknown as Record<number, GuildScheduledEventEntityType>)[data.entity_type] ?? null;
    } else {
      this.entityType ??= null;
    }

    if ('entity_id' in data) {
      this.entityId = data.entity_id ?? null;
    } else {
      this.entityId ??= null;
    }

    if ('user_count' in data) {
      this.userCount = data.user_count ?? null;
    } else {
      this.userCount ??= null;
    }

    if ('creator' in data && data.creator) {
      this.creator = (this.client as unknown as { users: { _add: (c: Record<string, unknown>) => User } }).users._add(data.creator);
    } else {
      this.creator ??= this.creatorId ? (this.client as unknown as { users: { resolve: (id: Snowflake) => User | null } }).users.resolve(this.creatorId) : null;
    }

    if ('entity_metadata' in data) {
      if (data.entity_metadata) {
        this.entityMetadata = {
          location: data.entity_metadata.location ?? this.entityMetadata?.location ?? null,
        };
      } else {
        this.entityMetadata = null;
      }
    } else {
      this.entityMetadata ??= null;
    }

    if ('image' in data) {
      this.image = data.image ?? null;
    } else {
      this.image ??= null;
    }

    if ('recurrence_rule' in data) {
      const rr = data.recurrence_rule;
      if (rr) {
        const startTs = Date.parse(rr.start);
        const endTs = rr.end ? Date.parse(rr.end) : null;
        this.recurrenceRule = {
          startTimestamp: startTs,
          get startAt() {
            return new Date(this.startTimestamp);
          },
          endTimestamp: endTs,
          get endAt() {
            return this.endTimestamp ? new Date(this.endTimestamp) : null;
          },
          frequency: rr.frequency,
          interval: rr.interval,
          byWeekday: rr.by_weekday,
          byNWeekday: rr.by_n_weekday,
          byMonth: rr.by_month,
          byMonthDay: rr.by_month_day,
          byYearDay: rr.by_year_day,
          count: rr.count,
        };
      } else {
        this.recurrenceRule = null;
      }
    } else {
      this.recurrenceRule ??= null;
    }
  }

  /**
   * The URL of this scheduled event's cover image
   */
  public coverImageURL({ format, size }: { format?: string; size?: number } = {}): string | null {
    if (!this.image) return null;
    return (this.client as unknown as { rest: { cdn: { GuildScheduledEventCover: (id: Snowflake, hash: string, f?: string, s?: number) => string } } })
      .rest.cdn.GuildScheduledEventCover(this.id, this.image, format, size);
  }

  /**
   * Whether this guild scheduled event is partial.
   */
  public get partial(): boolean {
    return this.name === null;
  }

  /**
   * The timestamp the guild scheduled event was created at
   */
  public get createdTimestamp(): number {
    return SnowflakeUtil.timestampFrom(this.id);
  }

  /**
   * The time the guild scheduled event was created at
   */
  public get createdAt(): Date {
    return new Date(this.createdTimestamp);
  }

  /**
   * The time the guild scheduled event will start at
   */
  public get scheduledStartAt(): Date | null {
    return this.scheduledStartTimestamp ? new Date(this.scheduledStartTimestamp) : null;
  }

  /**
   * The time the guild scheduled event will end at
   */
  public get scheduledEndAt(): Date | null {
    return this.scheduledEndTimestamp ? new Date(this.scheduledEndTimestamp) : null;
  }

  /**
   * The channel associated with this scheduled event
   */
  public get channel(): VoiceChannel | StageChannel | null {
    return this.channelId ? (this.client as unknown as { channels: { resolve: (id: Snowflake) => VoiceChannel | StageChannel | null } }).channels.resolve(this.channelId) : null;
  }

  /**
   * The guild this scheduled event belongs to
   */
  public get guild(): Guild | null {
    return (this.client as unknown as { guilds: { resolve: (id: Snowflake) => Guild | null } }).guilds.resolve(this.guildId);
  }

  /**
   * The URL to the guild scheduled event
   */
  public get url(): string {
    const httpOptions = (this.client as unknown as { options: { http: { scheduledEvent: string } } }).options.http;
    return Endpoints.scheduledEvent(httpOptions.scheduledEvent, this.guildId, this.id);
  }

  /**
   * Fetches this guild scheduled event.
   */
  public fetch(force = true): Promise<GuildScheduledEvent> {
    if (!this.guild) return Promise.reject(new Error('GUILD_UNCACHED'));
    return (this.guild as unknown as { scheduledEvents: { fetch: (opts: { guildScheduledEvent: Snowflake; force: boolean }) => Promise<GuildScheduledEvent> } })
      .scheduledEvents.fetch({ guildScheduledEvent: this.id, force });
  }

  /**
   * Creates an invite URL to this guild scheduled event.
   */
  public async createInviteURL(options?: CreateGuildScheduledEventInviteURLOptions): Promise<string> {
    if (!this.guild) throw new Error('GUILD_UNCACHED');
    let channelId = this.channelId;
    if (this.entityType === 'EXTERNAL') {
      if (!options?.channel) throw new DiscordError('INVITE_OPTIONS_MISSING_CHANNEL');
      channelId = (this.guild.channels as unknown as { resolveId: (ch: unknown) => Snowflake | null }).resolveId(options.channel);
      if (!channelId) throw new DiscordError('GUILD_CHANNEL_RESOLVE');
    }
    const invite = await (this.guild as unknown as { invites: { create: (cid: Snowflake | null, opts?: unknown) => Promise<{ code: string }> } })
      .invites.create(channelId, options);
    const httpOptions = (this.client as unknown as { options: { http: { invite: string } } }).options.http;
    return Endpoints.invite(httpOptions.invite, invite.code, this.id);
  }

  /**
   * Edits this guild scheduled event.
   */
  public edit(options: GuildScheduledEventEditOptions): Promise<GuildScheduledEvent> {
    if (!this.guild) return Promise.reject(new Error('GUILD_UNCACHED'));
    return (this.guild as unknown as { scheduledEvents: { edit: (id: Snowflake, opts: GuildScheduledEventEditOptions) => Promise<GuildScheduledEvent> } })
      .scheduledEvents.edit(this.id, options);
  }

  /**
   * Deletes this guild scheduled event.
   */
  public async delete(): Promise<this> {
    if (!this.guild) throw new Error('GUILD_UNCACHED');
    await (this.guild as unknown as { scheduledEvents: { delete: (id: Snowflake) => Promise<unknown> } })
      .scheduledEvents.delete(this.id);
    return this;
  }

  /**
   * Sets a new name for the guild scheduled event.
   */
  public setName(name: string, reason?: string): Promise<GuildScheduledEvent> {
    return this.edit({ name, reason });
  }

  /**
   * Sets a new time to schedule the event at.
   */
  public setScheduledStartTime(scheduledStartTime: Date | number | string, reason?: string): Promise<GuildScheduledEvent> {
    return this.edit({ scheduledStartTime, reason });
  }

  /**
   * Sets a new time to end the event at.
   */
  public setScheduledEndTime(scheduledEndTime: Date | number | string | null, reason?: string): Promise<GuildScheduledEvent> {
    return this.edit({ scheduledEndTime, reason });
  }

  /**
   * Sets the new description of the guild scheduled event.
   */
  public setDescription(description: string, reason?: string): Promise<GuildScheduledEvent> {
    return this.edit({ description, reason });
  }

  /**
   * Sets the new status of the guild scheduled event.
   */
  public setStatus(status: GuildScheduledEventStatus | number, reason?: string): Promise<GuildScheduledEvent> {
    return this.edit({ status, reason });
  }

  /**
   * Sets the new location of the guild scheduled event.
   */
  public setLocation(location: string, reason?: string): Promise<GuildScheduledEvent> {
    return this.edit({ entityMetadata: { location }, reason });
  }

  /**
   * Fetches subscribers of this guild scheduled event.
   */
  public fetchSubscribers(options?: FetchGuildScheduledEventSubscribersOptions): Promise<Collection<Snowflake, GuildScheduledEventUser>> {
    if (!this.guild) return Promise.reject(new Error('GUILD_UNCACHED'));
    return (this.guild as unknown as { scheduledEvents: { fetchSubscribers: (id: Snowflake, opts?: FetchGuildScheduledEventSubscribersOptions) => Promise<Collection<Snowflake, GuildScheduledEventUser>> } })
      .scheduledEvents.fetchSubscribers(this.id, options);
  }

  public override toString(): string {
    return this.url;
  }

  public isActive(): boolean {
    return this.status === 'ACTIVE';
  }

  public isCanceled(): boolean {
    return this.status === 'CANCELED';
  }

  public isCompleted(): boolean {
    return this.status === 'COMPLETED';
  }

  public isScheduled(): boolean {
    return this.status === 'SCHEDULED';
  }
}

export default GuildScheduledEvent;
