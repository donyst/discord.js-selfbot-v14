import EventEmitter from 'node:events';
import childProcess from 'node:child_process';
import util from 'node:util';
import path from 'node:path';
import { Collection } from '@discordjs/collection';
import type { Snowflake } from 'discord-api-types/v10';
import type { Client } from '../client/Client.js';
import type { PresenceData } from '../structures/ClientPresence.js';

const exec = util.promisify(childProcess.exec);

export interface DetectableExecutable {
  name: string;
  os: 'win32' | 'darwin' | 'linux';
  is_launcher?: boolean;
}

export interface DetectableApplication {
  id: Snowflake;
  name: string;
  executables?: DetectableExecutable[];
  summary?: string;
  publishers?: Array<{ id: string; name: string }>;
  developers?: Array<{ id: string; name: string }>;
  icon?: string;
}

export interface RunningGameInfo {
  application: DetectableApplication;
  executableName: string;
  pid?: number;
  startedAt: number;
}

export interface GameDetectionOptions {
  intervalMs?: number;
  autoSetActivity?: boolean;
}

/**
 * Manages detection of running games and applications on the local machine
 * utilizing Discord's registry of 24,000+ detectable applications.
 */
export class GameDetectionManager extends EventEmitter {
  public readonly client: Client;
  public cache: Collection<Snowflake, DetectableApplication> = new Collection();
  public executableIndex: Map<string, DetectableApplication> = new Map();
  public currentGame: RunningGameInfo | null = null;

  private pollInterval: NodeJS.Timeout | null = null;
  private isScanning = false;

  public constructor(client: Client) {
    super();
    this.client = client;
  }

  /**
   * Fetches the complete list of 24,000+ detectable games from Discord's official API.
   */
  public async fetchDetectable(): Promise<Collection<Snowflake, DetectableApplication>> {
    const route = this.client.api.applications.detectable;
    const res = (await (route as unknown as { get(): Promise<DetectableApplication[]> }).get()) as DetectableApplication[];

    this.cache.clear();
    this.executableIndex.clear();

    for (const app of res) {
      this.cache.set(app.id, app);
      if (app.executables) {
        for (const exe of app.executables) {
          const baseName = path.basename(exe.name).toLowerCase();
          this.executableIndex.set(baseName, app);
        }
      }
    }

    this.emit('loaded', this.cache.size);
    return this.cache;
  }

  /**
   * Finds a detectable application by its executable filename.
   */
  public findByExecutable(executableName: string): DetectableApplication | undefined {
    return this.executableIndex.get(executableName.toLowerCase());
  }

  /**
   * Finds a detectable application by its display name.
   */
  public findByName(name: string): DetectableApplication | undefined {
    const lower = name.toLowerCase();
    return this.cache.find(app => app.name.toLowerCase() === lower);
  }

  /**
   * Retrieves all running process image names on the current operating system.
   */
  public async getRunningProcessNames(): Promise<string[]> {
    const isWindows = process.platform === 'win32';
    try {
      if (isWindows) {
        const { stdout } = await exec('tasklist /FO CSV /NH');
        const lines = stdout.split('\r\n').filter(Boolean);
        const processes: string[] = [];
        for (const line of lines) {
          const match = line.match(/^"([^"]+)"/);
          if (match?.[1]) {
            processes.push(match[1].toLowerCase());
          }
        }
        return processes;
      }
      const { stdout } = await exec('ps -eo comm');
      return stdout
        .split('\n')
        .map(line => path.basename(line.trim()).toLowerCase())
        .filter(Boolean);
    } catch {
      return [];
    }
  }

  /**
   * Scans current running processes and identifies any active detectable game.
   */
  public async scanRunningGames(): Promise<RunningGameInfo | null> {
    if (this.executableIndex.size === 0) {
      await this.fetchDetectable();
    }

    const processNames = await this.getRunningProcessNames();
    for (const procName of processNames) {
      const match = this.executableIndex.get(procName);
      if (match) {
        return {
          application: match,
          executableName: procName,
          startedAt: Date.now(),
        };
      }
    }

    return null;
  }

  /**
   * Starts periodic polling of running games with optional automatic presence synchronization.
   */
  public startAutoDetection(options: GameDetectionOptions = {}): void {
    const intervalMs = options.intervalMs ?? 15_000;
    const autoSetActivity = options.autoSetActivity ?? true;

    if (this.pollInterval) clearInterval(this.pollInterval);

    this.pollInterval = setInterval(async () => {
      if (this.isScanning) return;
      this.isScanning = true;

      try {
        const detected = await this.scanRunningGames();
        if (detected && (!this.currentGame || this.currentGame.application.id !== detected.application.id)) {
          this.currentGame = detected;
          this.emit('gameStarted', detected.application, detected.executableName);

          if (autoSetActivity && this.client.user) {
            void this.client.user.setPresence({
              activities: [
                {
                  name: detected.application.name,
                  type: 0, // Playing
                  application_id: detected.application.id,
                  timestamps: { start: detected.startedAt },
                },
              ],
            } as PresenceData);
          }
        } else if (!detected && this.currentGame) {
          const prev = this.currentGame;
          this.currentGame = null;
          this.emit('gameStopped', prev.application);

          if (autoSetActivity && this.client.user) {
            void this.client.user.setPresence({
              activities: [],
            } as PresenceData);
          }
        }
      } catch (err) {
        this.emit('error', err);
      } finally {
        this.isScanning = false;
      }
    }, intervalMs);

    this.pollInterval.unref?.();
  }

  /**
   * Stops auto detection.
   */
  public stopAutoDetection(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.currentGame = null;
  }
}

export default GameDetectionManager;
