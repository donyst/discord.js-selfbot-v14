import type { Snowflake } from 'discord-api-types/v10';
import Base from './Base.js';
import type { Client } from '../client/Client.js';
import type { PresenceStatus } from './Presence.js';

export interface WidgetActivity {
  name: string;
}

export interface RawWidgetMemberData {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
  status: PresenceStatus;
  deaf?: boolean | null;
  mute?: boolean | null;
  self_deaf?: boolean | null;
  self_mute?: boolean | null;
  suppress?: boolean | null;
  channel_id?: Snowflake | null;
  avatar_url: string;
  activity?: WidgetActivity | null;
}

/**
 * Represents a WidgetMember.
 * @extends {Base}
 */
export class WidgetMember extends Base {
  public declare id: string;
  public username: string;
  public discriminator: string;
  public avatar: string | null;
  public status: PresenceStatus;
  public deaf: boolean | null;
  public mute: boolean | null;
  public selfDeaf: boolean | null;
  public selfMute: boolean | null;
  public suppress: boolean | null;
  public channelId: Snowflake | null;
  public avatarURL: string;
  public activity: WidgetActivity | null;

  public constructor(client: Client, data: RawWidgetMemberData) {
    super(client);
    this.id = data.id;
    this.username = data.username;
    this.discriminator = data.discriminator;
    this.avatar = data.avatar;
    this.status = data.status;
    this.deaf = data.deaf ?? null;
    this.mute = data.mute ?? null;
    this.selfDeaf = data.self_deaf ?? null;
    this.selfMute = data.self_mute ?? null;
    this.suppress = data.suppress ?? null;
    this.channelId = data.channel_id ?? null;
    this.avatarURL = data.avatar_url;
    this.activity = data.activity ?? null;
  }
}

export default WidgetMember;
