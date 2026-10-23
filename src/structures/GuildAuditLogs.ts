import { Collection } from '@discordjs/collection';
import type { Snowflake } from 'discord-api-types/v10';
import ApplicationCommand from './ApplicationCommand.js';
import AutoModerationRule from './AutoModerationRule.js';
import { GuildScheduledEvent } from './GuildScheduledEvent.js';
import Integration from './Integration.js';
import Invite from './Invite.js';
import { StageInstance } from './StageInstance.js';
import { Sticker } from './Sticker.js';
import Webhook from './Webhook.js';
import { OverwriteTypes, PartialTypes, AutoModerationRuleTriggerTypes } from '../util/Constants.js';
import SnowflakeUtil from '../util/SnowflakeUtil.js';
import Util from '../util/Util.js';
import type { Guild } from './Guild.js';
import type User from './User.js';

export type AuditLogTargetType =
  | 'ALL'
  | 'GUILD'
  | 'GUILD_SCHEDULED_EVENT'
  | 'CHANNEL'
  | 'USER'
  | 'ROLE'
  | 'INVITE'
  | 'WEBHOOK'
  | 'EMOJI'
  | 'MESSAGE'
  | 'INTEGRATION'
  | 'STAGE_INSTANCE'
  | 'STICKER'
  | 'THREAD'
  | 'APPLICATION_COMMAND'
  | 'AUTO_MODERATION'
  | 'SOUNDBOARD_SOUND'
  | 'GUILD_ONBOARDING_PROMPT'
  | 'GUILD_ONBOARDING'
  | 'UNKNOWN'
  | string;

export const Targets: Record<string, AuditLogTargetType> = {
  ALL: 'ALL',
  GUILD: 'GUILD',
  GUILD_SCHEDULED_EVENT: 'GUILD_SCHEDULED_EVENT',
  CHANNEL: 'CHANNEL',
  USER: 'USER',
  ROLE: 'ROLE',
  INVITE: 'INVITE',
  WEBHOOK: 'WEBHOOK',
  EMOJI: 'EMOJI',
  MESSAGE: 'MESSAGE',
  INTEGRATION: 'INTEGRATION',
  STAGE_INSTANCE: 'STAGE_INSTANCE',
  STICKER: 'STICKER',
  THREAD: 'THREAD',
  APPLICATION_COMMAND: 'APPLICATION_COMMAND',
  AUTO_MODERATION: 'AUTO_MODERATION',
  SOUNDBOARD_SOUND: 'SOUNDBOARD_SOUND',
  GUILD_ONBOARDING_PROMPT: 'GUILD_ONBOARDING_PROMPT',
  GUILD_ONBOARDING: 'GUILD_ONBOARDING',
  UNKNOWN: 'UNKNOWN',
};

export type AuditLogAction = number | string | null;

export const Actions: Record<string, number | null> = {
  ALL: null,
  GUILD_UPDATE: 1,
  CHANNEL_CREATE: 10,
  CHANNEL_UPDATE: 11,
  CHANNEL_DELETE: 12,
  CHANNEL_OVERWRITE_CREATE: 13,
  CHANNEL_OVERWRITE_UPDATE: 14,
  CHANNEL_OVERWRITE_DELETE: 15,
  MEMBER_KICK: 20,
  MEMBER_PRUNE: 21,
  MEMBER_BAN_ADD: 22,
  MEMBER_BAN_REMOVE: 23,
  MEMBER_UPDATE: 24,
  MEMBER_ROLE_UPDATE: 25,
  MEMBER_MOVE: 26,
  MEMBER_DISCONNECT: 27,
  BOT_ADD: 28,
  ROLE_CREATE: 30,
  ROLE_UPDATE: 31,
  ROLE_DELETE: 32,
  INVITE_CREATE: 40,
  INVITE_UPDATE: 41,
  INVITE_DELETE: 42,
  WEBHOOK_CREATE: 50,
  WEBHOOK_UPDATE: 51,
  WEBHOOK_DELETE: 52,
  EMOJI_CREATE: 60,
  EMOJI_UPDATE: 61,
  EMOJI_DELETE: 62,
  MESSAGE_DELETE: 72,
  MESSAGE_BULK_DELETE: 73,
  MESSAGE_PIN: 74,
  MESSAGE_UNPIN: 75,
  INTEGRATION_CREATE: 80,
  INTEGRATION_UPDATE: 81,
  INTEGRATION_DELETE: 82,
  STAGE_INSTANCE_CREATE: 83,
  STAGE_INSTANCE_UPDATE: 84,
  STAGE_INSTANCE_DELETE: 85,
  STICKER_CREATE: 90,
  STICKER_UPDATE: 91,
  STICKER_DELETE: 92,
  GUILD_SCHEDULED_EVENT_CREATE: 100,
  GUILD_SCHEDULED_EVENT_UPDATE: 101,
  GUILD_SCHEDULED_EVENT_DELETE: 102,
  THREAD_CREATE: 110,
  THREAD_UPDATE: 111,
  THREAD_DELETE: 112,
  APPLICATION_COMMAND_PERMISSION_UPDATE: 121,
  AUTO_MODERATION_RULE_CREATE: 140,
  AUTO_MODERATION_RULE_UPDATE: 141,
  AUTO_MODERATION_RULE_DELETE: 142,
  AUTO_MODERATION_BLOCK_MESSAGE: 143,
  AUTO_MODERATION_FLAG_TO_CHANNEL: 144,
  AUTO_MODERATION_USER_COMMUNICATION_DISABLED: 145,
};

export type AuditLogActionType = 'CREATE' | 'DELETE' | 'UPDATE' | 'ALL';

export interface AuditLogChange {
  key: string;
  old?: unknown;
  new?: unknown;
}

export interface RawAuditLogEntryData {
  id: Snowflake;
  action_type: number;
  reason?: string | null;
  user_id?: Snowflake | null;
  changes?: { key: string; old_value?: unknown; new_value?: unknown }[];
  options?: Record<string, unknown>;
  target_id?: Snowflake | null;
}

export interface RawGuildAuditLogsData {
  users?: Record<string, unknown>[];
  threads?: Record<string, unknown>[];
  webhooks?: Record<string, unknown>[];
  integrations?: Record<string, unknown>[];
  application_commands?: Record<string, unknown>[];
  auto_moderation_rules?: Record<string, unknown>[];
  audit_log_entries: RawAuditLogEntryData[];
}

/**
 * Audit logs entries are held in this class.
 */
export class GuildAuditLogs {
  public static readonly Targets = Targets;
  public static readonly Actions = Actions;
  public static get Entry(): typeof GuildAuditLogsEntry {
    return GuildAuditLogsEntry;
  }

  public webhooks: Collection<Snowflake, Webhook>;
  public integrations: Collection<Snowflake | string, Integration>;
  public applicationCommands: Collection<Snowflake, ApplicationCommand>;
  public autoModerationRules: Collection<Snowflake, AutoModerationRule>;
  public entries: Collection<Snowflake, GuildAuditLogsEntry>;

  public constructor(guild: Guild, data: RawGuildAuditLogsData) {
    if (data.users) {
      for (const user of data.users) {
        (guild.client as unknown as { users: { _add: (u: unknown) => User } }).users._add(user);
      }
    }
    if (data.threads) {
      for (const thread of data.threads) {
        (guild.client as unknown as { channels: { _add: (t: unknown, g: Guild) => unknown } }).channels._add(thread, guild);
      }
    }

    this.webhooks = new Collection();
    if (data.webhooks) {
      for (const hook of data.webhooks) {
        this.webhooks.set(hook.id as Snowflake, new Webhook(guild.client, hook as unknown as import('./Webhook.js').RawWebhookData));
      }
    }

    this.integrations = new Collection();
    if (data.integrations) {
      for (const integration of data.integrations) {
        this.integrations.set(integration.id as Snowflake, new Integration(guild.client, integration as unknown as import('./Integration.js').RawIntegrationData, guild));
      }
    }

    this.applicationCommands = new Collection();
    if (data.application_commands) {
      for (const command of data.application_commands) {
        this.applicationCommands.set(command.id as Snowflake, new ApplicationCommand(guild.client, command as unknown as import('./ApplicationCommand.js').RawApplicationCommandData, guild));
      }
    }

    this.autoModerationRules = (data.auto_moderation_rules ?? []).reduce(
      (rules, autoModerationRule) =>
        rules.set(
          autoModerationRule.id as Snowflake,
          (guild as unknown as { autoModerationRules: { _add: (r: unknown) => AutoModerationRule } }).autoModerationRules._add(autoModerationRule),
        ),
      new Collection<Snowflake, AutoModerationRule>(),
    );

    this.entries = new Collection();
    for (const item of data.audit_log_entries) {
      const entry = new GuildAuditLogsEntry(guild, item, this);
      this.entries.set(entry.id, entry);
    }
  }

  public static async build(guild: Guild, data: RawGuildAuditLogsData): Promise<GuildAuditLogs> {
    const logs = new GuildAuditLogs(guild, data);
    await Promise.all(logs.entries.map(e => e.target));
    return logs;
  }

  public static targetType(target: number): AuditLogTargetType {
    if (target < 10) return Targets.GUILD;
    if (target < 20) return Targets.CHANNEL;
    if (target < 30) return Targets.USER;
    if (target < 40) return Targets.ROLE;
    if (target < 50) return Targets.INVITE;
    if (target < 60) return Targets.WEBHOOK;
    if (target < 70) return Targets.EMOJI;
    if (target < 80) return Targets.MESSAGE;
    if (target < 83) return Targets.INTEGRATION;
    if (target < 86) return Targets.STAGE_INSTANCE;
    if (target < 100) return Targets.STICKER;
    if (target < 110) return Targets.GUILD_SCHEDULED_EVENT;
    if (target < 120) return Targets.THREAD;
    if (target < 130) return Targets.APPLICATION_COMMAND;
    if (target < 140) return Targets.SOUNDBOARD_SOUND;
    if (target < 143) return Targets.AUTO_MODERATION;
    if (target < 146) return Targets.USER;
    if (target >= 163 && target <= 165) return Targets.GUILD_ONBOARDING_PROMPT;
    if (target >= 160 && target < 170) return Targets.GUILD_ONBOARDING;
    return Targets.UNKNOWN;
  }

  public static actionType(action: number): AuditLogActionType {
    if (
      [
        Actions.CHANNEL_CREATE,
        Actions.CHANNEL_OVERWRITE_CREATE,
        Actions.MEMBER_BAN_REMOVE,
        Actions.BOT_ADD,
        Actions.ROLE_CREATE,
        Actions.INVITE_CREATE,
        Actions.WEBHOOK_CREATE,
        Actions.EMOJI_CREATE,
        Actions.MESSAGE_PIN,
        Actions.INTEGRATION_CREATE,
        Actions.STAGE_INSTANCE_CREATE,
        Actions.STICKER_CREATE,
        Actions.GUILD_SCHEDULED_EVENT_CREATE,
        Actions.THREAD_CREATE,
        Actions.AUTO_MODERATION_RULE_CREATE,
        Actions.AUTO_MODERATION_BLOCK_MESSAGE,
      ].includes(action)
    ) {
      return 'CREATE';
    }

    if (
      [
        Actions.CHANNEL_DELETE,
        Actions.CHANNEL_OVERWRITE_DELETE,
        Actions.MEMBER_KICK,
        Actions.MEMBER_PRUNE,
        Actions.MEMBER_BAN_ADD,
        Actions.MEMBER_DISCONNECT,
        Actions.ROLE_DELETE,
        Actions.INVITE_DELETE,
        Actions.WEBHOOK_DELETE,
        Actions.EMOJI_DELETE,
        Actions.MESSAGE_DELETE,
        Actions.MESSAGE_BULK_DELETE,
        Actions.MESSAGE_UNPIN,
        Actions.INTEGRATION_DELETE,
        Actions.STAGE_INSTANCE_DELETE,
        Actions.STICKER_DELETE,
        Actions.GUILD_SCHEDULED_EVENT_DELETE,
        Actions.THREAD_DELETE,
        Actions.AUTO_MODERATION_RULE_DELETE,
      ].includes(action)
    ) {
      return 'DELETE';
    }

    if (
      [
        Actions.GUILD_UPDATE,
        Actions.CHANNEL_UPDATE,
        Actions.CHANNEL_OVERWRITE_UPDATE,
        Actions.MEMBER_UPDATE,
        Actions.MEMBER_ROLE_UPDATE,
        Actions.MEMBER_MOVE,
        Actions.ROLE_UPDATE,
        Actions.INVITE_UPDATE,
        Actions.WEBHOOK_UPDATE,
        Actions.EMOJI_UPDATE,
        Actions.INTEGRATION_UPDATE,
        Actions.STAGE_INSTANCE_UPDATE,
        Actions.STICKER_UPDATE,
        Actions.GUILD_SCHEDULED_EVENT_UPDATE,
        Actions.THREAD_UPDATE,
        Actions.APPLICATION_COMMAND_PERMISSION_UPDATE,
        Actions.AUTO_MODERATION_RULE_UPDATE,
      ].includes(action)
    ) {
      return 'UPDATE';
    }

    return 'ALL';
  }

  public toJSON(): Record<string, unknown> {
    return Util.flatten(this) as Record<string, unknown>;
  }
}

/**
 * Audit logs entry.
 */
export class GuildAuditLogsEntry {
  public targetType: AuditLogTargetType;
  public actionType: AuditLogActionType;
  public action?: string;
  public reason: string | null;
  public executorId?: Snowflake | null;
  public executor: User | null;
  public changes: AuditLogChange[];
  public id: Snowflake;
  public extra: unknown = null;
  public targetId?: Snowflake | null;
  public target: unknown = null;

  public constructor(guild: Guild, data: RawAuditLogEntryData, logs?: GuildAuditLogs) {
    const targetType = GuildAuditLogs.targetType(data.action_type);
    this.targetType = targetType;
    this.actionType = GuildAuditLogs.actionType(data.action_type);
    this.action = Object.keys(Actions).find(k => Actions[k] === data.action_type);
    this.reason = data.reason ?? null;
    this.executorId = data.user_id;

    const partials = (guild.client as unknown as { options: { partials: string[] } }).options.partials;
    const usersManager = (guild.client as unknown as { users: { _add: (u: unknown) => User; cache: { get: (id: Snowflake) => User | undefined } } }).users;

    this.executor = data.user_id
      ? partials.includes(PartialTypes.USER)
        ? usersManager._add({ id: data.user_id })
        : usersManager.cache.get(data.user_id) ?? null
      : null;

    this.changes =
      data.changes?.map(change => ({
        key: change.key,
        ...('old_value' in change ? { old: change.old_value } : {}),
        ...('new_value' in change ? { new: change.new_value } : {}),
      })) ?? [];

    this.id = data.id;

    const options = data.options ?? {};
    switch (data.action_type) {
      case Actions.MEMBER_PRUNE:
        this.extra = {
          removed: Number(options.members_removed),
          days: Number(options.delete_member_days),
        };
        break;

      case Actions.MEMBER_MOVE:
      case Actions.MESSAGE_DELETE:
        this.extra = {
          channel: guild.channels.cache.get(options.channel_id as Snowflake) ?? { id: options.channel_id },
          count: Number(options.count),
        };
        break;

      case Actions.MESSAGE_PIN:
      case Actions.MESSAGE_UNPIN:
        this.extra = {
          channel: (guild.client as unknown as { channels: { cache: { get: (id: unknown) => unknown } } }).channels.cache.get(options.channel_id) ?? { id: options.channel_id },
          messageId: options.message_id,
        };
        break;

      case Actions.MESSAGE_BULK_DELETE:
      case Actions.MEMBER_DISCONNECT:
        this.extra = {
          count: Number(options.count),
        };
        break;

      case Actions.CHANNEL_OVERWRITE_CREATE:
      case Actions.CHANNEL_OVERWRITE_UPDATE:
      case Actions.CHANNEL_OVERWRITE_DELETE:
        switch (Number(options.type)) {
          case OverwriteTypes.role:
            this.extra = guild.roles.cache.get(options.id as Snowflake) ?? {
              id: options.id,
              name: options.role_name,
              type: (OverwriteTypes as Record<string | number, string>)[OverwriteTypes.role as string | number],
            };
            break;

          case OverwriteTypes.member:
            this.extra = guild.members.cache.get(options.id as Snowflake) ?? {
              id: options.id,
              type: (OverwriteTypes as Record<string | number, string>)[OverwriteTypes.member as string | number],
            };
            break;

          default:
            break;
        }
        break;

      case Actions.STAGE_INSTANCE_CREATE:
      case Actions.STAGE_INSTANCE_DELETE:
      case Actions.STAGE_INSTANCE_UPDATE:
        this.extra = {
          channel: (guild.client as unknown as { channels: { cache: { get: (id: unknown) => unknown } } }).channels.cache.get(options.channel_id) ?? { id: options.channel_id },
        };
        break;

      case Actions.APPLICATION_COMMAND_PERMISSION_UPDATE:
        this.extra = {
          applicationId: options.application_id,
        };
        break;

      case Actions.AUTO_MODERATION_BLOCK_MESSAGE:
      case Actions.AUTO_MODERATION_FLAG_TO_CHANNEL:
      case Actions.AUTO_MODERATION_USER_COMMUNICATION_DISABLED:
        this.extra = {
          autoModerationRuleName: options.auto_moderation_rule_name,
          autoModerationRuleTriggerType: (AutoModerationRuleTriggerTypes as unknown as Record<number, string>)[options.auto_moderation_rule_trigger_type as number],
          channel: (guild.client as unknown as { channels: { cache: { get: (id: unknown) => unknown } } }).channels.cache.get(options.channel_id) ?? { id: options.channel_id },
        };
        break;

      default:
        break;
    }

    this.targetId = data.target_id;

    if (targetType === Targets.UNKNOWN) {
      const targetObj: Record<string, unknown> = this.changes.reduce<Record<string, unknown>>((o, c) => {
        o[c.key] = c.new ?? c.old;
        return o;
      }, {});
      targetObj.id = data.target_id;
      this.target = targetObj;
    } else if (targetType === Targets.USER && data.target_id) {
      this.target = partials.includes(PartialTypes.USER)
        ? usersManager._add({ id: data.target_id })
        : usersManager.cache.get(data.target_id) ?? null;
    } else if (targetType === Targets.GUILD) {
      this.target = (guild.client as unknown as { guilds: { cache: { get: (id: Snowflake) => Guild | undefined } } }).guilds.cache.get(data.target_id as Snowflake);
    } else if (targetType === Targets.WEBHOOK) {
      this.target =
        logs?.webhooks.get(data.target_id as Snowflake) ??
        new Webhook(
          guild.client,
          this.changes.reduce<Record<string, unknown>>(
            (o, c) => {
              o[c.key] = c.new ?? c.old;
              return o;
            },
            {
              id: data.target_id,
              guild_id: guild.id,
            },
          ) as unknown as import('./Webhook.js').RawWebhookData,
        );
    } else if (targetType === Targets.INVITE) {
      const codeChange = this.changes.find(c => c.key === 'code');
      const changeVal = (codeChange?.new ?? codeChange?.old) as string | undefined;

      this.target =
        (changeVal ? guild.invites.cache.get(changeVal) : undefined) ??
        new Invite(
          guild.client,
          this.changes.reduce<Record<string, unknown>>(
            (o, c) => {
              o[c.key] = c.new ?? c.old;
              return o;
            },
            { guild },
          ) as unknown as import('./Invite.js').APIInviteData,
        );
    } else if (targetType === Targets.MESSAGE) {
      this.target =
        data.action_type === Actions.MESSAGE_BULK_DELETE
          ? guild.channels.cache.get(data.target_id as Snowflake) ?? { id: data.target_id }
          : usersManager.cache.get(data.target_id as Snowflake) ?? null;
    } else if (targetType === Targets.INTEGRATION) {
      this.target =
        logs?.integrations.get(data.target_id as Snowflake) ??
        new Integration(
          guild.client,
          this.changes.reduce<Record<string, unknown>>(
            (o, c) => {
              o[c.key] = c.new ?? c.old;
              return o;
            },
            { id: data.target_id },
          ) as unknown as import('./Integration.js').RawIntegrationData,
          guild,
        );
    } else if (targetType === Targets.CHANNEL || targetType === Targets.THREAD) {
      this.target =
        guild.channels.cache.get(data.target_id as Snowflake) ??
        this.changes.reduce<Record<string, unknown>>(
          (o, c) => {
            o[c.key] = c.new ?? c.old;
            return o;
          },
          { id: data.target_id },
        );
    } else if (targetType === Targets.STAGE_INSTANCE) {
      this.target =
        guild.stageInstances.cache.get(data.target_id as Snowflake) ??
        new StageInstance(
          guild.client,
          this.changes.reduce<Record<string, unknown>>(
            (o, c) => {
              o[c.key] = c.new ?? c.old;
              return o;
            },
            {
              id: data.target_id,
              channel_id: options.channel_id,
              guild_id: guild.id,
            },
          ) as unknown as import('./StageInstance.js').RawStageInstanceData,
        );
    } else if (targetType === Targets.STICKER) {
      this.target =
        guild.stickers.cache.get(data.target_id as Snowflake) ??
        new Sticker(
          guild.client,
          this.changes.reduce<Record<string, unknown>>(
            (o, c) => {
              o[c.key] = c.new ?? c.old;
              return o;
            },
            { id: data.target_id },
          ) as unknown as import('./Sticker.js').APIStickerData,
        );
    } else if (targetType === Targets.GUILD_SCHEDULED_EVENT) {
      this.target =
        guild.scheduledEvents.cache.get(data.target_id as Snowflake) ??
        new GuildScheduledEvent(
          guild.client,
          this.changes.reduce<Record<string, unknown>>(
            (o, c) => {
              o[c.key] = c.new ?? c.old;
              return o;
            },
            { id: data.target_id, guild_id: guild.id },
          ) as unknown as import('./GuildScheduledEvent.js').RawGuildScheduledEventData,
        );
    } else if (targetType === Targets.APPLICATION_COMMAND) {
      this.target = logs?.applicationCommands.get(data.target_id as Snowflake) ?? { id: data.target_id };
    } else if (targetType === Targets.AUTO_MODERATION) {
      this.target =
        guild.autoModerationRules.cache.get(data.target_id as Snowflake) ??
        new AutoModerationRule(
          guild.client,
          this.changes.reduce<Record<string, unknown>>(
            (o, c) => {
              o[c.key] = c.new ?? c.old;
              return o;
            },
            { id: data.target_id, guild_id: guild.id },
          ) as unknown as import('./AutoModerationRule.js').RawAutoModerationRuleData,
          guild,
        );
    } else if (targetType === Targets.ROLE) {
      this.target = guild.roles.cache.get(data.target_id as Snowflake) ?? { id: data.target_id };
    } else if (targetType === Targets.EMOJI) {
      this.target = guild.emojis.cache.get(data.target_id as Snowflake) ?? { id: data.target_id };
    } else if (data.target_id) {
      this.target = { id: data.target_id };
    }
  }

  public get createdTimestamp(): number {
    return SnowflakeUtil.timestampFrom(this.id);
  }

  public get createdAt(): Date {
    return new Date(this.createdTimestamp);
  }

  public toJSON(): Record<string, unknown> {
    return Util.flatten(this, { createdTimestamp: true }) as Record<string, unknown>;
  }
}

export default GuildAuditLogs;
