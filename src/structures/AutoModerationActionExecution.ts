import { AutoModerationRuleTriggerTypes, type AutoModerationRuleTriggerType } from '../util/Constants.js';
import type { Snowflake } from '../types/index.js';
import type { Guild } from './Guild.js';
import type { AutoModerationRule } from './AutoModerationRule.js';

export interface AutoModerationAction {
  type: number | string;
  metadata?: {
    channelId?: Snowflake;
    durationSeconds?: number;
    customMessage?: string;
    [key: string]: unknown;
  };
}

export interface RawAutoModerationActionExecutionData {
  guild_id: Snowflake;
  action: AutoModerationAction;
  rule_id: Snowflake;
  rule_trigger_type: number;
  user_id: Snowflake;
  channel_id?: Snowflake | null;
  message_id?: Snowflake | null;
  alert_system_message_id?: Snowflake | null;
  content: string;
  matched_keyword?: string | null;
  matched_content?: string | null;
  [key: string]: unknown;
}

/**
 * Represents the structure of an executed action when an {@link AutoModerationRule} is triggered.
 */
export class AutoModerationActionExecution {
  /**
   * The guild where this action was executed from.
   */
  public guild: Guild;

  /**
   * The action that was executed.
   */
  public action: AutoModerationAction;

  /**
   * The id of the auto moderation rule this action belongs to.
   */
  public ruleId: Snowflake;

  /**
   * The trigger type of the auto moderation rule which was triggered.
   */
  public ruleTriggerType: AutoModerationRuleTriggerType;

  /**
   * The id of the user that triggered this action.
   */
  public userId: Snowflake;

  /**
   * The id of the channel where this action was triggered from.
   */
  public channelId: Snowflake | null;

  /**
   * The id of the message that triggered this action.
   */
  public messageId: Snowflake | null;

  /**
   * The id of any system auto moderation messages posted as a result of this action.
   */
  public alertSystemMessageId: Snowflake | null;

  /**
   * The content that triggered this action.
   */
  public content: string;

  /**
   * The word or phrase configured in the rule that triggered this action.
   */
  public matchedKeyword: string | null;

  /**
   * The substring in content that triggered this action.
   */
  public matchedContent: string | null;

  public constructor(data: RawAutoModerationActionExecutionData, guild: Guild) {
    this.guild = guild;
    this.action = data.action;
    this.ruleId = data.rule_id;
    this.ruleTriggerType = (AutoModerationRuleTriggerTypes[data.rule_trigger_type] as AutoModerationRuleTriggerType) ?? 'KEYWORD';
    this.userId = data.user_id;
    this.channelId = data.channel_id ?? null;
    this.messageId = data.message_id ?? null;
    this.alertSystemMessageId = data.alert_system_message_id ?? null;
    this.content = data.content;
    this.matchedKeyword = data.matched_keyword ?? null;
    this.matchedContent = data.matched_content ?? null;
  }

  /**
   * The auto moderation rule this action belongs to.
   */
  public get autoModerationRule(): AutoModerationRule | null {
    return (this.guild.autoModerationRules?.cache.get(this.ruleId) as AutoModerationRule | undefined) ?? null;
  }
}

export default AutoModerationActionExecution;
