import Action from './Action.js';
import { Events } from '../../util/Constants.js';
import type { Snowflake } from '../../types/index.js';

export interface RawWebhooksUpdateData {
  channel_id: Snowflake;
  guild_id?: Snowflake;
  [key: string]: unknown;
}

export class WebhooksUpdate extends Action {
  public handle(data: RawWebhooksUpdateData): void {
    const client = this.client;
    const channel = client.channels.cache.get(data.channel_id);
    if (channel) {
      client.emit(Events.WEBHOOKS_UPDATE, channel);
    }
  }
}

export default WebhooksUpdate;
