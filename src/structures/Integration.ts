import type { Snowflake } from 'discord-api-types/v10';
import type { Collection } from '@discordjs/collection';
import Base from './Base.js';
import IntegrationApplication, { type APIIntegrationApplicationData } from './IntegrationApplication.js';
import type { Client } from '../client/Client.js';
import type { Guild } from './Guild.js';
import type { Role } from './Role.js';
import type User from './User.js';

export interface IntegrationAccount {
  id: Snowflake | string;
  name: string;
}

export type IntegrationType = 'twitch' | 'youtube' | 'discord' | 'guild_subscription' | string;

export interface RawIntegrationData {
  id: Snowflake;
  name: string;
  type: IntegrationType;
  enabled: boolean;
  syncing?: boolean;
  role_id?: Snowflake;
  enable_emoticons?: boolean | null;
  user?: Record<string, unknown>;
  account: IntegrationAccount;
  synced_at?: number | null;
  subscriber_count?: number | null;
  revoked?: boolean | null;
  expire_behavior?: number | null;
  expire_grace_period?: number | null;
  application?: APIIntegrationApplicationData | null;
}

/**
 * Represents a guild integration.
 * @extends {Base}
 */
export class Integration extends Base {
  public declare id: Snowflake;

  /**
   * The guild this integration belongs to
   */
  public guild: Guild;

  /**
   * The integration name
   */
  public name: string;

  /**
   * The integration type
   */
  public type: IntegrationType;

  /**
   * Whether this integration is enabled
   */
  public enabled: boolean;

  /**
   * Whether this integration is syncing
   */
  public syncing?: boolean;

  /**
   * The role that this integration uses for subscribers
   */
  public role: Role | null;

  /**
   * Whether emoticons should be synced for this integration
   */
  public enableEmoticons!: boolean | null;

  /**
   * The user for this integration
   */
  public user: User | null;

  /**
   * The account integration information
   */
  public account: IntegrationAccount;

  /**
   * The last time this integration was last synced
   */
  public syncedAt?: number | null;

  /**
   * How many subscribers this integration has
   */
  public subscriberCount!: number | null;

  /**
   * Whether this integration has been revoked
   */
  public revoked!: boolean | null;

  /**
   * The behavior of expiring subscribers
   */
  public expireBehavior?: number | null;

  /**
   * The grace period before expiring subscribers
   */
  public expireGracePeriod?: number | null;

  /**
   * The application for this integration
   */
  public application!: IntegrationApplication | null;

  public constructor(client: Client, data: RawIntegrationData, guild: Guild) {
    super(client);
    this.guild = guild;
    this.id = data.id;
    this.name = data.name;
    this.type = data.type;
    this.enabled = data.enabled;
    this.syncing = data.syncing;
    this.role = (data.role_id ? guild.roles.cache.get(data.role_id) : undefined) ?? null;

    if ('enable_emoticons' in data) {
      this.enableEmoticons = data.enable_emoticons ?? null;
    } else {
      this.enableEmoticons ??= null;
    }

    if (data.user) {
      this.user = (this.client as unknown as { users: { _add: (u: unknown) => User } }).users._add(data.user);
    } else {
      this.user = null;
    }

    this.account = data.account;
    this.syncedAt = data.synced_at;

    if ('subscriber_count' in data) {
      this.subscriberCount = data.subscriber_count ?? null;
    } else {
      this.subscriberCount ??= null;
    }

    if ('revoked' in data) {
      this.revoked = data.revoked ?? null;
    } else {
      this.revoked ??= null;
    }

    this._patch(data);
  }

  /**
   * All roles that are managed by this integration
   */
  public get roles(): Collection<Snowflake, Role> {
    const roles = this.guild.roles.cache;
    return roles.filter(role => role.tags?.integrationId === this.id);
  }

  public _patch(data: Partial<RawIntegrationData>): void {
    if ('expire_behavior' in data) {
      this.expireBehavior = data.expire_behavior ?? null;
    }

    if ('expire_grace_period' in data) {
      this.expireGracePeriod = data.expire_grace_period ?? null;
    }

    if ('application' in data) {
      if (this.application && data.application) {
        this.application._patch(data.application);
      } else if (data.application) {
        this.application = new IntegrationApplication(this.client, data.application);
      } else {
        this.application = null;
      }
    } else {
      this.application ??= null;
    }
  }

  /**
   * Deletes this integration.
   * @param reason Reason for deleting this integration
   */
  public async delete(reason?: string): Promise<this> {
    const api = (this.client as unknown as { api: { guilds: (guildId: Snowflake) => { integrations: (id: Snowflake) => { delete: (opts: { reason?: string }) => Promise<unknown> } } } }).api;
    await api.guilds(this.guild.id).integrations(this.id).delete({ reason });
    return this;
  }

  public override toJSON(): Record<string, unknown> {
    return super.toJSON({
      role: 'roleId',
      guild: 'guildId',
      user: 'userId',
    }) as Record<string, unknown>;
  }
}

export default Integration;
