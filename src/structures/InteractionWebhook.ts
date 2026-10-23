import { Webhook, type WebhookMessageOptions, type WebhookEditMessageOptions } from './Webhook.js';
import type { Snowflake } from '../types/index.js';
import type { Client } from '../client/Client.js';
import type { Message } from './Message.js';
import type { MessagePayload } from './MessagePayload.js';

/**
 * Represents a webhook for an Interaction
 */
export class InteractionWebhook {
  public readonly client: Client;
  public id: Snowflake;
  public token: string;

  public constructor(client: Client, id: Snowflake, token: string) {
    Object.defineProperty(this, 'client', { value: client });
    this.id = id;
    this.token = token;
    Object.defineProperty(this, 'token', { value: token, writable: true, configurable: true });
  }

  /* eslint-disable @typescript-eslint/no-empty-function */
  public send(
    _options: string | MessagePayload | WebhookMessageOptions,
  ): Promise<Message | Record<string, unknown>> {
    throw new Error('Method not implemented.');
  }

  public fetchMessage(_message: Snowflake, _options?: { cache?: boolean }): Promise<Message> {
    throw new Error('Method not implemented.');
  }

  public editMessage(
    _message: Snowflake | Message,
    _options: string | MessagePayload | WebhookEditMessageOptions,
  ): Promise<Message | Record<string, unknown>> {
    throw new Error('Method not implemented.');
  }

  public deleteMessage(_message: Snowflake | Message): Promise<void> {
    throw new Error('Method not implemented.');
  }

  public get url(): string {
    throw new Error('Method not implemented.');
  }
}

Webhook.applyToClass(InteractionWebhook, ['sendSlackMessage', 'edit', 'delete', 'createdTimestamp', 'createdAt']);

export default InteractionWebhook;
