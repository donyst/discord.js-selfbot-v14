import process from 'node:process';
import type { Snowflake } from 'discord-api-types/v10';
import Base from './Base.js';
import { PrivacyLevels } from '../util/Constants.js';
import SnowflakeUtil from '../util/SnowflakeUtil.js';
import type { Client } from '../client/Client.js';
import type { Guild } from './Guild.js';
import type StageChannel from './StageChannel.js';
import type { GuildScheduledEvent } from './GuildScheduledEvent.js';

export const deletedStageInstances = new WeakSet<StageInstance>();
let deprecationEmittedForDeleted = false;

export type PrivacyLevel = 'PUBLIC' | 'GUILD_ONLY';

export interface RawStageInstanceData {
  id: Snowflake;
  guild_id?: Snowflake;
  channel_id?: Snowflake;
  topic?: string;
  privacy_level?: number;
  discoverable_disabled?: boolean | null;
  guild_scheduled_event_id?: Snowflake | null;
}

export interface StageInstanceEditOptions {
  topic?: string;
  privacyLevel?: PrivacyLevel | number;
}

export interface StageInstanceCreateOptions extends StageInstanceEditOptions {
  channel?: StageChannel | Snowflake;
  sendStartNotification?: boolean;
}

/**
 * Represents a stage instance.
 * @extends {Base}
 */
export class StageInstance extends Base {
  /**
   * The id of the guild associated with the stage channel
   */
  public guildId!: Snowflake;

  /**
   * The id of the channel associated with the stage channel
   */
  public channelId!: Snowflake;

  /**
   * The topic of the stage instance
   */
  public topic!: string;

  /**
   * The privacy level of the stage instance
   */
  public privacyLevel!: PrivacyLevel;

  /**
   * Whether or not stage discovery is disabled
   */
  public discoverableDisabled!: boolean | null;

  /**
   * The associated guild scheduled event id of this stage instance
   */
  public guildScheduledEventId!: Snowflake | null;

  public constructor(client: Client, data: RawStageInstanceData) {
    super(client);
    this.id = data.id;
    this._patch(data);
  }

  public _patch(data: Partial<RawStageInstanceData>): void {
    if ('guild_id' in data && data.guild_id !== undefined) {
      this.guildId = data.guild_id;
    }

    if ('channel_id' in data && data.channel_id !== undefined) {
      this.channelId = data.channel_id;
    }

    if ('topic' in data && data.topic !== undefined) {
      this.topic = data.topic;
    }

    if ('privacy_level' in data && data.privacy_level !== undefined) {
      this.privacyLevel = (PrivacyLevels as unknown as Record<number, PrivacyLevel>)[data.privacy_level];
    }

    if ('discoverable_disabled' in data) {
      this.discoverableDisabled = data.discoverable_disabled ?? null;
    } else {
      this.discoverableDisabled ??= null;
    }

    if ('guild_scheduled_event_id' in data) {
      this.guildScheduledEventId = data.guild_scheduled_event_id ?? null;
    } else {
      this.guildScheduledEventId ??= null;
    }
  }

  /**
   * The stage channel associated with this stage instance
   */
  public get channel(): StageChannel | null {
    return (this.client as unknown as { channels: { resolve: (id: Snowflake) => StageChannel | null } }).channels.resolve(this.channelId);
  }

  /**
   * The associated guild scheduled event of this stage instance
   */
  public get guildScheduledEvent(): GuildScheduledEvent | null {
    return this.guild?.scheduledEvents.resolve(this.guildScheduledEventId!) ?? null;
  }

  /**
   * Whether or not the stage instance has been deleted
   * @deprecated This will be removed in the next major version
   */
  public get deleted(): boolean {
    if (!deprecationEmittedForDeleted) {
      deprecationEmittedForDeleted = true;
      process.emitWarning(
        'StageInstance#deleted is deprecated, see https://github.com/discordjs/discord.js/issues/7091.',
        'DeprecationWarning',
      );
    }
    return deletedStageInstances.has(this);
  }

  public set deleted(value: boolean) {
    if (!deprecationEmittedForDeleted) {
      deprecationEmittedForDeleted = true;
      process.emitWarning(
        'StageInstance#deleted is deprecated, see https://github.com/discordjs/discord.js/issues/7091.',
        'DeprecationWarning',
      );
    }

    if (value) deletedStageInstances.add(this);
    else deletedStageInstances.delete(this);
  }

  /**
   * The guild this stage instance belongs to
   */
  public get guild(): Guild | null {
    return (this.client as unknown as { guilds: { resolve: (id: Snowflake) => Guild | null } }).guilds.resolve(this.guildId);
  }

  /**
   * Edits this stage instance.
   * @param options The options to edit the stage instance
   */
  public edit(options: StageInstanceEditOptions): Promise<StageInstance> {
    if (!this.guild) return Promise.reject(new Error('GUILD_UNCACHED'));
    return (this.guild as unknown as { stageInstances: { edit: (channelId: Snowflake, opts: StageInstanceEditOptions) => Promise<StageInstance> } }).stageInstances.edit(this.channelId, options);
  }

  /**
   * Deletes this stage instance.
   */
  public async delete(): Promise<this> {
    if (!this.guild) throw new Error('GUILD_UNCACHED');
    await (this.guild as unknown as { stageInstances: { delete: (channelId: Snowflake) => Promise<unknown> } }).stageInstances.delete(this.channelId);
    const clone = this._clone();
    deletedStageInstances.add(clone);
    return clone;
  }

  /**
   * Sets the topic of this stage instance.
   * @param topic The topic for the stage instance
   */
  public setTopic(topic: string): Promise<StageInstance> {
    return this.edit({ topic });
  }

  /**
   * The timestamp this stage instances was created at
   */
  public get createdTimestamp(): number {
    return SnowflakeUtil.timestampFrom(this.id);
  }

  /**
   * The time this stage instance was created at
   */
  public get createdAt(): Date {
    return new Date(this.createdTimestamp);
  }
}

export default StageInstance;
