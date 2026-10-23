import { Collection } from '@discordjs/collection';
import { BaseManager } from './BaseManager.js';
import { GuildBoost, type RawGuildBoostData } from '../structures/GuildBoost.js';
import type { Snowflake } from '../types/index.js';
import type { Client } from '../client/Client.js';

export interface PaymentSourceData {
  id: Snowflake;
  type: number;
  invalid?: boolean;
  flags?: number;
  email?: string;
  billing_address?: Record<string, unknown>;
  country?: string;
  payment_gateway?: number;
  [key: string]: unknown;
}

export interface SubscriptionData {
  id: Snowflake;
  type: number;
  status: number;
  plan_id?: Snowflake;
  currency?: string;
  [key: string]: unknown;
}

/**
 * Manages the API methods of a data model.
 * @extends {BaseManager}
 */
export class BillingManager extends BaseManager {
  /**
   * All the payment sources of the client
   */
  public paymentSources: Collection<Snowflake, PaymentSourceData>;

  /**
   * All the guild boosts of the client
   */
  public guildBoosts: Collection<Snowflake, GuildBoost>;

  /**
   * The current subscription of the client
   */
  public currentSubscription: Collection<Snowflake, SubscriptionData>;

  public constructor(client: Client) {
    super(client);
    this.paymentSources = new Collection();
    this.guildBoosts = new Collection();
    this.currentSubscription = new Collection();
  }

  /**
   * Fetches all the payment sources of the client
   */
  public async fetchPaymentSources(): Promise<Collection<Snowflake, PaymentSourceData>> {
    const api = this.client.api as unknown as {
      users(userId: string): {
        billing: {
          ['payment-sources']: {
            get(): Promise<PaymentSourceData[]>;
          };
        };
      };
    };

    const d = await api.users('@me').billing['payment-sources'].get();
    this.paymentSources = new Collection(d.map(s => [s.id, s]));
    return this.paymentSources;
  }

  /**
   * Fetches all the guild boosts of the client
   */
  public async fetchGuildBoosts(): Promise<Collection<Snowflake, GuildBoost>> {
    const api = this.client.api as unknown as {
      users(userId: string): {
        guilds: {
          premium: {
            ['subscription-slots']: {
              get(): Promise<RawGuildBoostData[]>;
            };
          };
        };
      };
    };

    const d = await api.users('@me').guilds.premium['subscription-slots'].get();
    this.guildBoosts = new Collection(
      d.filter((s): s is RawGuildBoostData & { id: Snowflake } => Boolean(s.id)).map(s => [s.id, new GuildBoost(this.client, s)]),
    );
    return this.guildBoosts;
  }

  /**
   * Fetches the current subscription of the client
   */
  public async fetchCurrentSubscription(): Promise<Collection<Snowflake, SubscriptionData>> {
    const api = this.client.api as unknown as {
      users(userId: string): {
        billing: {
          subscriptions: {
            get(): Promise<SubscriptionData[]>;
          };
        };
      };
    };

    const d = await api.users('@me').billing.subscriptions.get();
    this.currentSubscription = new Collection(d.map(s => [s.id, s]));
    return this.currentSubscription;
  }
}

export default BillingManager;
