import { Collection } from '@discordjs/collection';
import type { Snowflake } from 'discord-api-types/v10';
import Base from './Base.js';
import WidgetMember, { type RawWidgetMemberData } from './WidgetMember.js';
import type { Client } from '../client/Client.js';

export interface WidgetChannel {
  id: Snowflake;
  name: string;
  position: number;
}

export interface RawWidgetData {
  id: Snowflake;
  name: string;
  instant_invite?: string | null;
  channels: WidgetChannel[];
  members: RawWidgetMemberData[];
  presence_count?: number;
}

/**
 * Represents a Widget.
 * @extends {Base}
 */
export class Widget extends Base {
  public declare id: Snowflake;
  public name!: string;
  public instantInvite!: string | null;
  public channels!: Collection<Snowflake, WidgetChannel>;
  public members!: Collection<string, WidgetMember>;
  public presenceCount?: number;

  public constructor(client: Client, data: RawWidgetData) {
    super(client);
    this._patch(data);
  }

  public _patch(data: RawWidgetData): void {
    this.id = data.id;

    if ('name' in data && data.name !== undefined) {
      this.name = data.name;
    }

    if ('instant_invite' in data) {
      this.instantInvite = data.instant_invite ?? null;
    }

    this.channels = new Collection();
    for (const channel of data.channels) {
      this.channels.set(channel.id, channel);
    }

    this.members = new Collection();
    for (const member of data.members) {
      this.members.set(member.id, new WidgetMember(this.client as unknown as Client, member));
    }

    if ('presence_count' in data && data.presence_count !== undefined) {
      this.presenceCount = data.presence_count;
    }
  }

  public async fetch(): Promise<this> {
    const api = (this.client as unknown as { api: { guilds: (id: Snowflake, sub: string) => { get: () => Promise<RawWidgetData> } } }).api;
    const data = await api.guilds(this.id, 'widget.json').get();
    this._patch(data);
    return this;
  }
}

export default Widget;
