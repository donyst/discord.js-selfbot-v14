import type { Snowflake } from 'discord-api-types/v10';
import BaseClient from './BaseClient.js';
import { DiscordjsError as Error } from '../errors/index.js';
import Webhook from '../structures/Webhook.js';
import type { ClientOptions } from '../util/Options.js';

export interface WebhookClientData {
  id?: Snowflake;
  token?: string;
  url?: string;
}

/**
 * The webhook client.
 * @implements {Webhook}
 * @extends {BaseClient}
 */
export class WebhookClient extends BaseClient {
  public id!: Snowflake;
  public token!: string | null;

  public constructor(data: WebhookClientData, options?: Partial<ClientOptions>) {
    super(options);
    Object.defineProperty(this, 'client', { value: this });
    let id = data.id;
    let token = data.token;

    if ('url' in data && data.url) {
      const url = data.url.match(
        /^https?:\/\/(?:canary|ptb)?\.?discord\.com\/api\/webhooks(?:\/v[0-9]\d*)?\/([^/]+)\/([^/]+)/i,
      );

      if (!url || url.length <= 1) throw new Error('WEBHOOK_URL_INVALID');

      [, id, token] = url as unknown as [unknown, Snowflake, string];
    }

    this.id = id!;
    Object.defineProperty(this, 'token', { value: token, writable: true, configurable: true });
  }
}

export interface WebhookClient extends Webhook {}

Webhook.applyToClass(WebhookClient);

export default WebhookClient;
