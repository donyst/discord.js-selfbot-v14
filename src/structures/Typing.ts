import { Base } from './Base.js';
import type { TextBasedChannels } from '../types/index.js';
import type { User } from './User.js';
import type { Guild } from './Guild.js';
import type { GuildMember } from './GuildMember.js';
import type { Client } from '../client/Client.js';

export interface RawTypingData {
  timestamp: number;
  [key: string]: unknown;
}

/**
 * Represents a typing state for a user in a channel.
 * @extends {Base}
 */
export class Typing extends Base {
  /**
   * The channel the status is from
   */
  public channel: TextBasedChannels;

  /**
   * The user who is typing
   */
  public user: User;

  /**
   * The UNIX timestamp in milliseconds the user started typing at
   */
  public startedTimestamp!: number;

  public constructor(channel: TextBasedChannels, user: User, data: RawTypingData) {
    super((channel as unknown as { client: Client }).client);
    this.channel = channel;
    this.user = user;
    this._patch(data);
  }

  public _patch(data: RawTypingData): void {
    if ('timestamp' in data) {
      this.startedTimestamp = data.timestamp * 1_000;
    }
  }

  /**
   * Indicates whether the status is received from a guild.
   */
  public inGuild(): boolean {
    return this.guild !== null;
  }

  /**
   * The time the user started typing at
   */
  public get startedAt(): Date {
    return new Date(this.startedTimestamp);
  }

  /**
   * The guild the status is from
   */
  public get guild(): Guild | null {
    return (this.channel as unknown as { guild?: Guild | null }).guild ?? null;
  }

  /**
   * The member who is typing
   */
  public get member(): GuildMember | null {
    if (!this.guild || !this.user) return null;
    return this.guild.members.resolve(this.user);
  }
}

export default Typing;
