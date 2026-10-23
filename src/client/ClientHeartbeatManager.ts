import EventEmitter from 'node:events';
import { randomUUID } from 'node:crypto';
import type { Client } from './Client.js';

export interface ClientHeartbeatSessionData {
  uuid: string;
  createdAtTimestamp: number;
  lastUsedTimestamp: number;
  version: number;
}

/**
 * Emulates the official Discord Desktop Client Heartbeat Session store ('LAST_CLIENT_HEARTBEAT_SESSION').
 * Tracks user activity, natural session duration, and keeps telemetry active.
 */
export class ClientHeartbeatManager extends EventEmitter {
  public readonly client: Client;
  public uuid: string;
  public createdAtTimestamp: number;
  public lastUsedTimestamp: number;
  public version = 1;

  private timer: NodeJS.Timeout | null = null;
  private intervalMs = 45_000;

  public constructor(client: Client, intervalMs = 45_000) {
    super();
    this.client = client;
    this.uuid = randomUUID();
    this.createdAtTimestamp = Date.now();
    this.lastUsedTimestamp = Date.now();
    this.intervalMs = intervalMs;
  }

  /**
   * Returns current session metadata matching the LevelDB store format.
   */
  public get session(): ClientHeartbeatSessionData {
    return {
      uuid: this.uuid,
      createdAtTimestamp: this.createdAtTimestamp,
      lastUsedTimestamp: this.lastUsedTimestamp,
      version: this.version,
    };
  }

  /**
   * Records natural user activity (message sent, reaction, navigation) and refreshes timestamp.
   */
  public touch(): void {
    this.lastUsedTimestamp = Date.now();
    this.emit('touch', this.session);
  }

  /**
   * Starts the periodic background heartbeat session updater.
   */
  public start(): void {
    if (this.timer) return;
    this.lastUsedTimestamp = Date.now();
    this.timer = setInterval(() => {
      this.touch();
      this.emit('heartbeat', this.session);
    }, this.intervalMs);
    this.timer.unref?.();
  }

  /**
   * Stops the background heartbeat session updater.
   */
  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Resets and initiates a new session UUID.
   */
  public reset(): void {
    this.uuid = randomUUID();
    this.createdAtTimestamp = Date.now();
    this.lastUsedTimestamp = Date.now();
    this.emit('reset', this.session);
  }
}

export default ClientHeartbeatManager;
