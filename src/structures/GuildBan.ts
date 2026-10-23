import Base from './Base.js';
import type { Client } from '../client/Client.js';
import type { Guild } from './Guild.js';
import type User from './User.js';

export interface RawGuildBanData {
  user: Record<string, unknown>;
  reason?: string | null;
}

/**
 * Represents a ban in a guild on Discord.
 * @extends {Base}
 */
export class GuildBan extends Base {
  /**
   * The guild in which the ban is
   */
  public guild: Guild;

  /**
   * The user this ban applies to
   */
  public user!: User;

  /**
   * The reason for the ban
   */
  public reason!: string | null;

  public constructor(client: Client, data: RawGuildBanData, guild: Guild) {
    super(client);
    this.guild = guild;
    this._patch(data);
  }

  public _patch(data: Partial<RawGuildBanData>): void {
    if ('user' in data && data.user) {
      this.user = (this.client as unknown as { users: { _add: (u: unknown, cache: boolean) => User } }).users._add(data.user, true);
    }

    if ('reason' in data) {
      this.reason = data.reason ?? null;
    }
  }

  /**
   * Whether this GuildBan is partial.
   */
  public get partial(): boolean {
    return !('reason' in this);
  }

  /**
   * Fetches this GuildBan.
   * @param force Whether to skip the cache check and request the API
   */
  public fetch(force = true): Promise<GuildBan> {
    return (this.guild as unknown as { bans: { fetch: (opts: { user: User; cache: boolean; force: boolean }) => Promise<GuildBan> } }).bans.fetch({
      user: this.user,
      cache: true,
      force,
    });
  }
}

export default GuildBan;
