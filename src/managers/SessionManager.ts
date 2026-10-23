import { CachedManager } from './CachedManager.js';
import { Session, type RawSessionData } from '../structures/Session.js';
import type { Client } from '../client/Client.js';
import type { Collection } from '@discordjs/collection';

/**
 * Manages API methods for sessions and stores their cache.
 * @extends {CachedManager}
 */
export class SessionManager extends CachedManager<string, Session, RawSessionData> {
  /**
   * The current session ID hash of the client.
   */
  public currentSessionIdHash: string | null = null;

  public constructor(client: Client, iterable?: Iterable<Session>) {
    super(client, Session, iterable);
  }

  /**
   * Fetch all sessions of the client.
   */
  public async fetch(): Promise<Collection<string, Session>> {
    const api = this.client.api as unknown as {
      auth: {
        sessions: {
          get(): Promise<{ user_sessions: (RawSessionData & { id_hash: string })[] }>;
        };
      };
    };

    const data = await api.auth.sessions.get();
    const allData = data.user_sessions;
    this.cache.clear();
    for (const session of allData) {
      this._add(session, true, { id: session.id_hash });
    }
    return this.cache;
  }

  /**
   * Logout all client (remote).
   */
  public logoutAllDevices(): Promise<void> {
    const api = this.client.api as unknown as {
      auth: {
        sessions: {
          logout(opts: { data: { session_id_hashes: string[] } }): Promise<void>;
        };
      };
    };

    return api.auth.sessions.logout({
      data: {
        session_id_hashes: this.cache.map(session => session.id),
      },
    });
  }

  /**
   * Get the current session of the client.
   */
  public get currentSession(): Session | null {
    if (!this.currentSessionIdHash) {
      return null;
    }
    return this.cache.get(this.currentSessionIdHash) ?? null;
  }
}

export default SessionManager;
