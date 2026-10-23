import { Collection } from '@discordjs/collection';
import type { Snowflake } from 'discord-api-types/v10';
import Base from './Base.js';
import {
  AutoModerationRuleKeywordPresetTypes,
  AutoModerationRuleTriggerTypes,
  AutoModerationRuleEventTypes,
  AutoModerationActionTypes,
} from '../util/Constants.js';
import type { Client } from '../client/Client.js';
import type { Guild } from './Guild.js';
import type { Role } from './Role.js';
import type GuildChannel from './GuildChannel.js';
import type ThreadChannel from './ThreadChannel.js';

export type AutoModerationRuleTriggerType = string;
export type AutoModerationRuleEventType = string;
export type AutoModerationRuleKeywordPresetType = string;
export type AutoModerationActionType = string;

export interface AutoModerationTriggerMetadata {
  keywordFilter: string[];
  regexPatterns: string[];
  presets: AutoModerationRuleKeywordPresetType[];
  allowList: string[];
  mentionTotalLimit: number | null;
  mentionRaidProtectionEnabled: boolean;
}

export interface AutoModerationActionMetadata {
  channelId: Snowflake | null;
  durationSeconds: number | null;
  customMessage: string | null;
}

export interface AutoModerationAction {
  type: AutoModerationActionType;
  metadata: AutoModerationActionMetadata;
}

export interface AutoModerationActionOptions {
  type: AutoModerationActionType | number;
  metadata?: Partial<AutoModerationActionMetadata>;
}

export interface AutoModerationRuleEditOptions {
  name?: string;
  eventType?: AutoModerationRuleEventType | number;
  triggerMetadata?: Partial<AutoModerationTriggerMetadata>;
  actions?: AutoModerationActionOptions[];
  enabled?: boolean;
  exemptRoles?: Collection<Snowflake, Role> | (Snowflake | Role)[];
  exemptChannels?: Collection<Snowflake, GuildChannel | ThreadChannel> | (Snowflake | GuildChannel | ThreadChannel)[];
  reason?: string;
}

export interface RawAutoModerationRuleData {
  id: Snowflake;
  guild_id?: Snowflake;
  name: string;
  creator_id: Snowflake;
  event_type: number;
  trigger_type: number;
  trigger_metadata: {
    keyword_filter?: string[];
    regex_patterns?: string[];
    presets?: number[];
    allow_list?: string[];
    mention_total_limit?: number | null;
    mention_raid_protection_enabled?: boolean;
  };
  actions: {
    type: number;
    metadata: {
      duration_seconds?: number | null;
      channel_id?: Snowflake | null;
      custom_message?: string | null;
    };
  }[];
  enabled: boolean;
  exempt_roles: Snowflake[];
  exempt_channels: Snowflake[];
}

/**
 * Represents an auto moderation rule.
 * @extends {Base}
 */
export class AutoModerationRule extends Base {
  public declare id: Snowflake;

  /**
   * The guild this auto moderation rule is for.
   */
  public guild: Guild;

  /**
   * The user that created this auto moderation rule.
   */
  public creatorId: Snowflake;

  /**
   * The trigger type of this auto moderation rule.
   */
  public triggerType: AutoModerationRuleTriggerType;

  /**
   * The name of this auto moderation rule.
   */
  public name!: string;

  /**
   * The event type of this auto moderation rule.
   */
  public eventType!: AutoModerationRuleEventType;

  /**
   * The trigger metadata of the rule.
   */
  public triggerMetadata!: AutoModerationTriggerMetadata;

  /**
   * The actions of this auto moderation rule.
   */
  public actions!: AutoModerationAction[];

  /**
   * Whether this auto moderation rule is enabled.
   */
  public enabled!: boolean;

  /**
   * The roles exempt by this auto moderation rule.
   */
  public exemptRoles!: Collection<Snowflake, Role | undefined>;

  /**
   * The channels exempt by this auto moderation rule.
   */
  public exemptChannels!: Collection<Snowflake, GuildChannel | ThreadChannel | undefined>;

  public constructor(client: Client, data: RawAutoModerationRuleData, guild: Guild) {
    super(client);
    this.id = data.id;
    this.guild = guild;
    this.creatorId = data.creator_id;
    this.triggerType = (AutoModerationRuleTriggerTypes as unknown as Record<number, string>)[data.trigger_type] ?? String(data.trigger_type);
    this._patch(data);
  }

  public _patch(data: Partial<RawAutoModerationRuleData>): void {
    if ('name' in data && data.name !== undefined) {
      this.name = data.name;
    }

    if ('event_type' in data && data.event_type !== undefined) {
      this.eventType = (AutoModerationRuleEventTypes as unknown as Record<number, string>)[data.event_type] ?? String(data.event_type);
    }

    if ('trigger_metadata' in data && data.trigger_metadata !== undefined) {
      this.triggerMetadata = {
        keywordFilter: data.trigger_metadata.keyword_filter ?? [],
        regexPatterns: data.trigger_metadata.regex_patterns ?? [],
        presets: data.trigger_metadata.presets?.map(preset => (AutoModerationRuleKeywordPresetTypes as unknown as Record<number, string>)[preset] ?? String(preset)) ?? [],
        allowList: data.trigger_metadata.allow_list ?? [],
        mentionTotalLimit: data.trigger_metadata.mention_total_limit ?? null,
        mentionRaidProtectionEnabled: data.trigger_metadata.mention_raid_protection_enabled ?? false,
      };
    }

    if ('actions' in data && data.actions !== undefined) {
      this.actions = data.actions.map(action => ({
        type: (AutoModerationActionTypes as unknown as Record<number, string>)[action.type] ?? String(action.type),
        metadata: {
          durationSeconds: action.metadata.duration_seconds ?? null,
          channelId: action.metadata.channel_id ?? null,
          customMessage: action.metadata.custom_message ?? null,
        },
      }));
    }

    if ('enabled' in data && data.enabled !== undefined) {
      this.enabled = data.enabled;
    }

    if ('exempt_roles' in data && data.exempt_roles !== undefined) {
      this.exemptRoles = new Collection(
        data.exempt_roles.map(exemptRole => [exemptRole, this.guild.roles.cache.get(exemptRole)]),
      );
    }

    if ('exempt_channels' in data && data.exempt_channels !== undefined) {
      this.exemptChannels = new Collection(
        data.exempt_channels.map(exemptChannel => [
          exemptChannel,
          this.guild.channels.cache.get(exemptChannel) as GuildChannel | ThreadChannel | undefined,
        ]),
      );
    }
  }

  /**
   * Edits this auto moderation rule.
   */
  public edit(options: AutoModerationRuleEditOptions): Promise<AutoModerationRule> {
    return (this.guild as unknown as { autoModerationRules: { edit: (id: Snowflake, opts: AutoModerationRuleEditOptions) => Promise<AutoModerationRule> } })
      .autoModerationRules.edit(this.id, options);
  }

  /**
   * Deletes this auto moderation rule.
   */
  public delete(reason?: string): Promise<void> {
    return (this.guild as unknown as { autoModerationRules: { delete: (id: Snowflake, r?: string) => Promise<void> } })
      .autoModerationRules.delete(this.id, reason);
  }

  public setName(name: string, reason?: string): Promise<AutoModerationRule> {
    return this.edit({ name, reason });
  }

  public setEventType(eventType: AutoModerationRuleEventType, reason?: string): Promise<AutoModerationRule> {
    return this.edit({ eventType, reason });
  }

  public setKeywordFilter(keywordFilter: string[], reason?: string): Promise<AutoModerationRule> {
    return this.edit({ triggerMetadata: { ...this.triggerMetadata, keywordFilter }, reason });
  }

  public setRegexPatterns(regexPatterns: string[], reason?: string): Promise<AutoModerationRule> {
    return this.edit({ triggerMetadata: { ...this.triggerMetadata, regexPatterns }, reason });
  }

  public setPresets(presets: AutoModerationRuleKeywordPresetType[], reason?: string): Promise<AutoModerationRule> {
    return this.edit({ triggerMetadata: { ...this.triggerMetadata, presets }, reason });
  }

  public setAllowList(allowList: string[], reason?: string): Promise<AutoModerationRule> {
    return this.edit({ triggerMetadata: { ...this.triggerMetadata, allowList }, reason });
  }

  public setMentionTotalLimit(mentionTotalLimit: number, reason?: string): Promise<AutoModerationRule> {
    return this.edit({ triggerMetadata: { ...this.triggerMetadata, mentionTotalLimit }, reason });
  }

  public setMentionRaidProtectionEnabled(mentionRaidProtectionEnabled: boolean, reason?: string): Promise<AutoModerationRule> {
    return this.edit({ triggerMetadata: { ...this.triggerMetadata, mentionRaidProtectionEnabled }, reason });
  }

  public setActions(actions: AutoModerationActionOptions[], reason?: string): Promise<AutoModerationRule> {
    return this.edit({ actions, reason });
  }

  public setEnabled(enabled = true, reason?: string): Promise<AutoModerationRule> {
    return this.edit({ enabled, reason });
  }

  public setExemptRoles(
    exemptRoles?: Collection<Snowflake, Role> | (Snowflake | Role)[],
    reason?: string,
  ): Promise<AutoModerationRule> {
    return this.edit({ exemptRoles, reason });
  }

  public setExemptChannels(
    exemptChannels?: Collection<Snowflake, GuildChannel | ThreadChannel> | (Snowflake | GuildChannel | ThreadChannel)[],
    reason?: string,
  ): Promise<AutoModerationRule> {
    return this.edit({ exemptChannels, reason });
  }
}

export default AutoModerationRule;
