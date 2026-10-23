import Base from './Base.js';
import type { Client } from '../client/Client.js';

export interface SessionClientInfo {
  location: string;
  platform: string;
  os: string;
}

export interface RawSessionData {
  id_hash?: string;
  approx_last_used_time?: string;
  client_info?: SessionClientInfo;
}

/**
 * Represents a Client OAuth2 Application Team / User Session.
 * @extends {Base}
 */
export class Session extends Base {

  /**
   * The approximate last used time
   */
  public approxLastUsedTime!: string;

  /**
   * The client info
   */
  public clientInfo!: SessionClientInfo;

  public constructor(client: Client, data: RawSessionData) {
    super(client);
    this._patch(data);
  }

  public _patch(data: RawSessionData): void {
    if ('id_hash' in data && data.id_hash !== undefined) {
      this.id = data.id_hash;
    }
    if ('approx_last_used_time' in data && data.approx_last_used_time !== undefined) {
      this.approxLastUsedTime = data.approx_last_used_time;
    }
    if ('client_info' in data && data.client_info !== undefined) {
      this.clientInfo = data.client_info;
    }
  }

  /**
   * The timestamp the client was last used at.
   */
  public get createdTimestamp(): number {
    return this.createdAt.getTime();
  }

  /**
   * The time the client was last used at.
   */
  public get createdAt(): Date {
    return new Date(this.approxLastUsedTime);
  }

  /**
   * Logout the client (remote).
   */
  public logout(): Promise<unknown> {
    return (this.client as unknown as { api: { auth: { sessions: { logout: (opts: { data: { session_id_hashes: string[] } }) => Promise<unknown> } } } })
      .api.auth.sessions.logout({
        data: {
          session_id_hashes: [this.id],
        },
      });
  }

  public override toJSON(): Record<string, unknown> {
    return super.toJSON() as Record<string, unknown>;
  }
}

export default Session;
