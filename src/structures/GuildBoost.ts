import type { Snowflake } from 'discord-api-types/v10';
import Base from './Base.js';
import { DiscordjsError as DiscordError } from '../errors/index.js';
import type { Client } from '../client/Client.js';
import type { Guild } from './Guild.js';

export interface RawGuildBoostData {
  id?: Snowflake;
  subscription_id?: Snowflake;
  premium_guild_subscription?: {
    id?: Snowflake | null;
    guild_id?: Snowflake | null;
    ended?: boolean | null;
  } | null;
  canceled?: boolean;
  cooldown_ends_at?: string;
}

/**
 * Represents a guild boost in a guild on Discord.
 * @extends {Base}
 */
export class GuildBoost extends Base {
  public declare id: Snowflake;

  /**
   * The id of the subscription
   */
  public subscriptionId!: Snowflake;

  /**
   * The premium guild subscription id
   */
  public premiumGuildSubscriptionId!: Snowflake | null;

  /**
   * Guild id
   */
  public guildId!: Snowflake | null;

  /**
   * Whether the boost ended
   */
  public ended!: boolean | null;

  /**
   * Whether the subscription is canceled
   */
  public canceled!: boolean;

  /**
   * The cooldown end date
   */
  public cooldownEndsAt!: Date;

  public constructor(client: Client, data: RawGuildBoostData) {
    super(client);
    this._patch(data);
  }

  public _patch(data: Partial<RawGuildBoostData>): void {
    if ('id' in data && data.id !== undefined) {
      this.id = data.id;
    }

    if ('subscription_id' in data && data.subscription_id !== undefined) {
      this.subscriptionId = data.subscription_id;
    }

    if (typeof data.premium_guild_subscription === 'object' && data.premium_guild_subscription !== null) {
      this.premiumGuildSubscriptionId = data.premium_guild_subscription.id ?? null;
      this.guildId = data.premium_guild_subscription.guild_id ?? null;
      this.ended = data.premium_guild_subscription.ended ?? null;
    }

    if ('canceled' in data && data.canceled !== undefined) {
      this.canceled = data.canceled;
    }

    if ('cooldown_ends_at' in data && data.cooldown_ends_at !== undefined) {
      this.cooldownEndsAt = new Date(data.cooldown_ends_at);
    }
  }

  /**
   * The guild of the boost (legacy spelling support)
   */
  public get guilld(): Guild | null {
    return this.guild;
  }

  /**
   * The guild of the boost
   */
  public get guild(): Guild | null {
    if (!this.guildId) return null;
    return (this.client as unknown as { guilds: { cache: { get: (id: Snowflake) => Guild | undefined } } }).guilds.cache.get(this.guildId) ?? null;
  }

  /**
   * Cancel the boost
   */
  public async unsubscribe(): Promise<this> {
    if (!this.guildId) throw new DiscordError('BOOST_UNUSED');
    if (!this.premiumGuildSubscriptionId) throw new DiscordError('BOOST_UNCACHED');
    const api = (this.client as unknown as { api: { guilds: (guildId: Snowflake) => { premium: { subscriptions: (subId: Snowflake) => { delete: () => Promise<unknown> } } } } }).api;
    await api.guilds(this.guildId).premium.subscriptions(this.premiumGuildSubscriptionId).delete();
    this.guildId = null;
    this.premiumGuildSubscriptionId = null;
    this.ended = null;
    return this;
  }

  /**
   * Use the boost
   * @param guild The guild to use the boost on
   */
  public async subscribe(guild: unknown): Promise<this> {
    if (this.guildId || this.premiumGuildSubscriptionId) throw new DiscordError('BOOST_USED');
    const guildsManager = (this.client as unknown as { guilds: { resolveId: (g: unknown) => Snowflake | null } }).guilds;
    const id = guildsManager.resolveId(guild);
    if (!id) throw new DiscordError('UNKNOWN_GUILD');
    const api = (this.client as unknown as { api: { guilds: (guildId: Snowflake) => { premium: { subscriptions: { put: (opts: { data: { user_premium_guild_subscription_slot_ids: Snowflake[] } }) => Promise<RawGuildBoostData['premium_guild_subscription']> } } } } }).api;
    const d = await api.guilds(id).premium.subscriptions.put({
      data: {
        user_premium_guild_subscription_slot_ids: [this.id],
      },
    });
    this._patch({
      premium_guild_subscription: d,
    });
    return this;
  }
}

export default GuildBoost;
