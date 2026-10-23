import { Collection } from '@discordjs/collection';
import type { Snowflake } from 'discord-api-types/v10';
import Base from './Base.js';
import type { Client } from '../client/Client.js';
import type DMChannel from './DMChannel.js';
import type GroupDMChannel from './GroupDMChannel.js';
import type User from './User.js';

export interface RawCallStateData {
  channel_id: Snowflake;
  region?: string;
  ringing?: Snowflake[];
}

/**
 * Represents a call
 * @extends {Base}
 */
export class CallState extends Base {
  /**
   * The channel ID of the call
   */
  public channelId: Snowflake;

  /**
   * The region of the call
   */
  public region?: string;

  public _ringing: Snowflake[];

  public constructor(client: Client, data: RawCallStateData) {
    super(client);
    this.channelId = data.channel_id;
    this._ringing = [];
    this._patch(data);
  }

  public _patch(data: Partial<RawCallStateData>): void {
    if ('region' in data && data.region !== undefined) {
      this.region = data.region;
    }
    if ('ringing' in data && Array.isArray(data.ringing)) {
      this._ringing = data.ringing;
    }
  }

  /**
   * The channel of the call
   */
  public get channel(): DMChannel | GroupDMChannel | undefined {
    return (this.client as unknown as Client).channels.cache.get(this.channelId) as
      | DMChannel
      | GroupDMChannel
      | undefined;
  }

  /**
   * Sets the voice region of the call
   * @param region Region of the call
   */
  public setRTCRegion(region: string): Promise<unknown> {
    return (this.client as unknown as { api: { channels: (id: Snowflake) => { call: { patch: (opts: { data: { region: string } }) => Promise<unknown> } } } })
      .api.channels(this.channelId)
      .call.patch({ data: { region } });
  }

  /**
   * The list of user ID who is ringing
   */
  public get ringing(): Collection<Snowflake, User | undefined> {
    return new Collection(
      this._ringing.map(id => [id, (this.client as unknown as Client).users.cache.get(id)]),
    );
  }
}

export default CallState;
