import { Collection } from '@discordjs/collection';
import { CachedManager } from './CachedManager.js';
import { AutoModerationRule, type RawAutoModerationRuleData } from '../structures/AutoModerationRule.js';
import {
  AutoModerationRuleEventTypes,
  AutoModerationRuleTriggerTypes,
  AutoModerationActionTypes,
  AutoModerationRuleKeywordPresetTypes,
  type AutoModerationRuleEventType,
  type AutoModerationRuleTriggerType,
  type AutoModerationActionType,
  type AutoModerationRuleKeywordPresetType,
} from '../util/Constants.js';
import type { Snowflake, BaseFetchOptions, RoleResolvable, GuildChannelResolvable, GuildTextChannelResolvable } from '../types/index.js';
import type { Guild } from '../structures/Guild.js';
import type { Role } from '../structures/Role.js';
import type { GuildChannel } from '../structures/GuildChannel.js';
import type { ThreadChannel } from '../structures/ThreadChannel.js';

export type AutoModerationRuleResolvable = AutoModerationRule | Snowflake;

export interface AutoModerationTriggerMetadataOptions {
  keywordFilter?: string[];
  regexPatterns?: string[];
  presets?: (AutoModerationRuleKeywordPresetType | number)[];
  allowList?: string[];
  mentionTotalLimit?: number | null;
  mentionRaidProtectionEnabled?: boolean;
}

export interface AutoModerationActionMetadataOptions {
  channel?: GuildTextChannelResolvable | ThreadChannel;
  durationSeconds?: number;
  customMessage?: string;
}

export interface AutoModerationActionOptions {
  type: AutoModerationActionType | number;
  metadata?: AutoModerationActionMetadataOptions;
}

export interface AutoModerationRuleCreateOptions {
  name: string;
  eventType: AutoModerationRuleEventType | number;
  triggerType: AutoModerationRuleTriggerType | number;
  triggerMetadata?: AutoModerationTriggerMetadataOptions;
  actions: AutoModerationActionOptions[];
  enabled?: boolean;
  exemptRoles?: (Collection<Snowflake, Role> | RoleResolvable)[];
  exemptChannels?: (Collection<Snowflake, GuildChannel | ThreadChannel> | GuildChannelResolvable)[];
  reason?: string;
}

export interface AutoModerationRuleEditOptions {
  name?: string;
  eventType?: AutoModerationRuleEventType | number;
  triggerMetadata?: AutoModerationTriggerMetadataOptions;
  actions?: AutoModerationActionOptions[];
  enabled?: boolean;
  exemptRoles?: (Collection<Snowflake, Role> | RoleResolvable)[];
  exemptChannels?: (Collection<Snowflake, GuildChannel | ThreadChannel> | GuildChannelResolvable)[];
  reason?: string;
}

export interface FetchAutoModerationRuleOptions extends BaseFetchOptions {
  autoModerationRule?: AutoModerationRuleResolvable;
}

export interface FetchAutoModerationRulesOptions {
  cache?: boolean;
}

/**
 * Manages API methods for auto moderation rules and stores their cache.
 * @extends {CachedManager}
 */
export class AutoModerationRuleManager extends CachedManager<
  Snowflake,
  AutoModerationRule,
  RawAutoModerationRuleData
> {
  /**
   * The guild this manager belongs to.
   */
  public guild: Guild;

  public constructor(guild: Guild, iterable?: Iterable<AutoModerationRule>) {
    super(guild.client, AutoModerationRule, iterable);
    this.guild = guild;
  }

  public override _add(data: RawAutoModerationRuleData, cache?: boolean): AutoModerationRule {
    return super._add(data, cache, { extras: [this.guild] });
  }

  /**
   * Creates a new auto moderation rule.
   */
  public async create({
    name,
    eventType,
    triggerType,
    triggerMetadata,
    actions,
    enabled,
    exemptRoles,
    exemptChannels,
    reason,
  }: AutoModerationRuleCreateOptions): Promise<AutoModerationRule> {
    const rolesMgr = this.guild.roles as unknown as { resolveId(r: unknown): Snowflake | null };
    const channelsMgr = this.guild.channels as unknown as { resolveId(c: unknown): Snowflake | null };

    const api = this.client.api as unknown as {
      guilds(guildId: Snowflake): {
        ['auto-moderation']: {
          rules: {
            post(opts: { data: unknown; reason?: string }): Promise<RawAutoModerationRuleData>;
          };
        };
      };
    };

    const data = await api.guilds(this.guild.id)['auto-moderation'].rules.post({
      data: {
        name,
        event_type:
          typeof eventType === 'number'
            ? eventType
            : (AutoModerationRuleEventTypes as Record<string, number>)[eventType],
        trigger_type:
          typeof triggerType === 'number'
            ? triggerType
            : (AutoModerationRuleTriggerTypes as Record<string, number>)[triggerType],
        trigger_metadata: triggerMetadata && {
          keyword_filter: triggerMetadata.keywordFilter,
          regex_patterns: triggerMetadata.regexPatterns,
          presets: triggerMetadata.presets?.map(preset =>
            typeof preset === 'number'
              ? preset
              : (AutoModerationRuleKeywordPresetTypes as Record<string, number>)[preset],
          ),
          allow_list: triggerMetadata.allowList,
          mention_total_limit: triggerMetadata.mentionTotalLimit,
          mention_raid_protection_enabled: triggerMetadata.mentionRaidProtectionEnabled,
        },
        actions: actions.map(action => ({
          type:
            typeof action.type === 'number'
              ? action.type
              : (AutoModerationActionTypes as Record<string, number>)[action.type],
          metadata: {
            duration_seconds: action.metadata?.durationSeconds,
            channel_id: action.metadata?.channel && channelsMgr.resolveId(action.metadata.channel),
            custom_message: action.metadata?.customMessage,
          },
        })),
        enabled,
        exempt_roles: exemptRoles?.map(exemptRole => rolesMgr.resolveId(exemptRole)),
        exempt_channels: exemptChannels?.map(exemptChannel => channelsMgr.resolveId(exemptChannel)),
      },
      reason,
    });

    return this._add(data);
  }

  /**
   * Edits an auto moderation rule.
   */
  public async edit(
    autoModerationRule: AutoModerationRuleResolvable,
    {
      name,
      eventType,
      triggerMetadata,
      actions,
      enabled,
      exemptRoles,
      exemptChannels,
      reason,
    }: AutoModerationRuleEditOptions,
  ): Promise<AutoModerationRule> {
    const autoModerationRuleId = this.resolveId(autoModerationRule);
    const rolesMgr = this.guild.roles as unknown as { resolveId(r: unknown): Snowflake | null };
    const channelsMgr = this.guild.channels as unknown as { resolveId(c: unknown): Snowflake | null };

    const api = this.client.api as unknown as {
      guilds(guildId: Snowflake): (endpoint: string) => {
        rules(ruleId: Snowflake | null): {
          patch(opts: { data: unknown; reason?: string }): Promise<RawAutoModerationRuleData>;
        };
      };
    };

    const data = await api
      .guilds(this.guild.id)('auto-moderation')
      .rules(autoModerationRuleId)
      .patch({
        data: {
          name,
          event_type:
            typeof eventType === 'number'
              ? eventType
              : eventType
                ? (AutoModerationRuleEventTypes as Record<string, number>)[eventType]
                : undefined,
          trigger_metadata: triggerMetadata && {
            keyword_filter: triggerMetadata.keywordFilter,
            regex_patterns: triggerMetadata.regexPatterns,
            presets: triggerMetadata.presets?.map(preset =>
              typeof preset === 'number'
                ? preset
                : (AutoModerationRuleKeywordPresetTypes as Record<string, number>)[preset],
            ),
            allow_list: triggerMetadata.allowList,
            mention_total_limit: triggerMetadata.mentionTotalLimit,
            mention_raid_protection_enabled: triggerMetadata.mentionRaidProtectionEnabled,
          },
          actions: actions?.map(action => ({
            type:
              typeof action.type === 'number'
                ? action.type
                : (AutoModerationActionTypes as Record<string, number>)[action.type],
            metadata: {
              duration_seconds: action.metadata?.durationSeconds,
              channel_id: action.metadata?.channel && channelsMgr.resolveId(action.metadata.channel),
              custom_message: action.metadata?.customMessage,
            },
          })),
          enabled,
          exempt_roles: exemptRoles?.map(exemptRole => rolesMgr.resolveId(exemptRole)),
          exempt_channels: exemptChannels?.map(exemptChannel => channelsMgr.resolveId(exemptChannel)),
        },
        reason,
      });

    return this._add(data);
  }

  /**
   * Fetches auto moderation rules from Discord.
   */
  public fetch(options: AutoModerationRuleResolvable | FetchAutoModerationRuleOptions): Promise<AutoModerationRule>;
  public fetch(options?: FetchAutoModerationRulesOptions): Promise<Collection<Snowflake, AutoModerationRule>>;
  public fetch(
    options?: AutoModerationRuleResolvable | FetchAutoModerationRuleOptions | FetchAutoModerationRulesOptions,
  ): Promise<AutoModerationRule | Collection<Snowflake, AutoModerationRule>> {
    if (!options) return this._fetchMany();
    const opts = typeof options === 'object' && options !== null ? options : {};
    const autoModRule = (opts as FetchAutoModerationRuleOptions).autoModerationRule;
    const resolvedAutoModerationRule = this.resolveId(autoModRule ?? (options as AutoModerationRuleResolvable));

    if (resolvedAutoModerationRule) {
      return this._fetchSingle({
        autoModerationRule: resolvedAutoModerationRule,
        cache: (opts as BaseFetchOptions).cache,
        force: (opts as BaseFetchOptions).force,
      });
    }
    return this._fetchMany(opts as FetchAutoModerationRulesOptions);
  }

  public async _fetchSingle({
    autoModerationRule,
    cache,
    force = false,
  }: {
    autoModerationRule: Snowflake;
    cache?: boolean;
    force?: boolean;
  }): Promise<AutoModerationRule> {
    if (!force) {
      const existing = this.cache.get(autoModerationRule);
      if (existing) return existing;
    }

    const api = this.client.api as unknown as {
      guilds(guildId: Snowflake): (endpoint: string) => {
        rules(ruleId: Snowflake): {
          get(): Promise<RawAutoModerationRuleData>;
        };
      };
    };

    const data = await api.guilds(this.guild.id)('auto-moderation').rules(autoModerationRule).get();
    return this._add(data, cache);
  }

  public async _fetchMany(options: FetchAutoModerationRulesOptions = {}): Promise<Collection<Snowflake, AutoModerationRule>> {
    const api = this.client.api as unknown as {
      guilds(guildId: Snowflake): (endpoint: string) => {
        rules: {
          get(): Promise<RawAutoModerationRuleData[]>;
        };
      };
    };

    const data = await api.guilds(this.guild.id)('auto-moderation').rules.get();
    return data.reduce(
      (col: Collection<Snowflake, AutoModerationRule>, rule: RawAutoModerationRuleData) =>
        col.set(rule.id, this._add(rule, options.cache)),
      new Collection<Snowflake, AutoModerationRule>(),
    );
  }

  /**
   * Deletes an auto moderation rule.
   */
  public async delete(autoModerationRule: AutoModerationRuleResolvable, reason?: string): Promise<void> {
    const autoModerationRuleId = this.resolveId(autoModerationRule);
    const api = this.client.api as unknown as {
      guilds(guildId: Snowflake): (endpoint: string) => {
        rules(ruleId: Snowflake | null): {
          delete(opts: { reason?: string }): Promise<void>;
        };
      };
    };

    await api.guilds(this.guild.id)('auto-moderation').rules(autoModerationRuleId).delete({ reason });
  }
}

export default AutoModerationRuleManager;
