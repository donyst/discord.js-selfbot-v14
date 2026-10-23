import { randomUUID } from 'node:crypto';
import { Collection } from '@discordjs/collection';
import { LimitedCollection } from './LimitedCollection.js';
import { Sweepers } from './Sweepers.js';
import { Intents } from './Intents.js';
import type { SuperProperties } from '../types/index.js';

export interface RateLimitData {
  timeout: number;
  limit: number;
  method: string;
  path: string;
  route: string;
  global: boolean;
}

export type RateLimitQueueFilter = (rateLimitData: RateLimitData) => boolean | Promise<boolean>;

export type CaptchaSolver = (captcha: unknown, userAgent: string) => Promise<string>;

export type PartialType =
  | 'USER'
  | 'CHANNEL'
  | 'GUILD_MEMBER'
  | 'MESSAGE'
  | 'REACTION'
  | 'GUILD_SCHEDULED_EVENT';

export interface HTTPOptions {
  version: number;
  agent?: unknown;
  api: string;
  cdn: string;
  invite: string;
  template: string;
  scheduledEvent: string;
  headers: Record<string, string>;
}

export interface WebsocketOptions {
  capabilities: number;
  compress: boolean;
  version: number;
  agent?: unknown;
  properties: SuperProperties;
  client_state: {
    guild_versions: Record<string, unknown>;
  };
}

export interface ClientOptions {
  DMChannelVoiceStatusSync: number;
  captchaRetryLimit: number;
  captchaSolver: CaptchaSolver;
  TOTPKey: string | null;
  closeTimeout: number;
  waitGuildTimeout: number;
  shardCount: number;
  shards: number[];
  makeCache?: unknown;
  messageCacheLifetime: number;
  messageSweepInterval: number;
  invalidRequestWarningInterval: number;
  intents: number;
  partials: PartialType[];
  restWsBridgeTimeout: number;
  restRequestTimeout: number;
  restGlobalRateLimit: number;
  retryLimit: number;
  restTimeOffset: number;
  restSweepInterval: number;
  failIfNotExists: boolean;
  presence: {
    status: 'online' | 'idle' | 'dnd' | 'invisible';
    since: number;
    activities: unknown[];
    afk: boolean;
  };
  sweepers: Record<string, unknown>;
  ws: WebsocketOptions;
  http: HTTPOptions;
}

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) discord/1.0.9265 Chrome/148.0.7778.280 Electron/42.11.15 Safari/537.36';

/**
 * Contains various utilities for client options.
 */
export class Options {
  private constructor() {}

  /**
   * The default client options with updated ground-truth fingerprint from capture-kit.
   */
  public static createDefault(): ClientOptions {
    return {
      DMChannelVoiceStatusSync: 0,
      captchaRetryLimit: 3,
      captchaSolver: () => {
        const err = new Error('CAPTCHA_SOLVER_NOT_IMPLEMENTED');
        err.cause =
          'You need to provide a captcha solver to use this feature\nExample: const client = new Client({ captchaSolver: yourAsyncFunction })';
        throw err;
      },
      TOTPKey: null,
      closeTimeout: 5_000,
      waitGuildTimeout: 15_000,
      shardCount: 1,
      shards: [0],
      messageCacheLifetime: 0,
      messageSweepInterval: 0,
      invalidRequestWarningInterval: 0,
      intents: Intents.ALL,
      partials: ['USER', 'CHANNEL', 'GUILD_MEMBER', 'MESSAGE', 'REACTION', 'GUILD_SCHEDULED_EVENT'],
      restWsBridgeTimeout: 5_000,
      restRequestTimeout: 15_000,
      restGlobalRateLimit: 0,
      retryLimit: 1,
      restTimeOffset: 500,
      restSweepInterval: 60,
      failIfNotExists: true,
      presence: { status: 'online', since: 0, activities: [], afk: true },
      makeCache: Options.cacheWithLimits(Options.defaultMakeCacheSettings),
      sweepers: {},
      ws: {
        capabilities: 0,
        compress: false,
        version: 9,
        properties: {
          os: 'Windows',
          browser: 'Discord Client',
          release_channel: 'stable',
          client_version: '1.0.9265',
          os_version: '10.0.26300',
          os_arch: 'x64',
          app_arch: 'x64',
          system_locale: 'en-US',
          has_client_mods: false,
          client_launch_id: randomUUID(),
          browser_user_agent: DEFAULT_USER_AGENT,
          browser_version: '42.11.15',
          os_sdk_version: '26300',
          client_build_number: 647615, // Ground truth captured from live Discord session 2026-10-23
          native_build_number: 96160,
          client_event_source: null,
          launch_signature: randomUUID(),
          client_heartbeat_session_id: randomUUID(),
          client_app_state: 'focused',
        },
        client_state: {
          guild_versions: {},
        },
      },
      http: {
        version: 9,
        api: 'https://discord.com/api',
        cdn: 'https://cdn.discordapp.com',
        invite: 'https://discord.gg',
        template: 'https://discord.new',
        scheduledEvent: 'https://discord.com/events',
        headers: {
          'User-Agent': DEFAULT_USER_AGENT,
        },
      },
    };
  }

  public static cacheWithLimits(settings: Record<string, unknown> = {}): (manager: { name: string }) => Collection<unknown, unknown> {
    return (manager: { name: string }) => {
      const setting = settings[manager.name] as { sweepFilter?: unknown; sweepInterval?: number; maxSize?: number } | number | undefined;
      if (setting == null) {
        return new Collection();
      }
      if (typeof setting === 'number') {
        if (setting === Infinity) {
          return new Collection();
        }
        return new LimitedCollection({ maxSize: setting });
      }
      const noSweeping =
        setting.sweepFilter == null ||
        setting.sweepInterval == null ||
        setting.sweepInterval <= 0 ||
        setting.sweepInterval === Infinity;
      const noLimit = setting.maxSize == null || setting.maxSize === Infinity;
      if (noSweeping && noLimit) {
        return new Collection();
      }
      return new LimitedCollection(setting as unknown as import('./LimitedCollection.js').LimitedCollectionOptions<unknown, unknown>);
    };
  }

  public static cacheEverything(): () => Collection<unknown, unknown> {
    return () => new Collection();
  }

  public static get defaultMakeCacheSettings(): Record<string, unknown> {
    return {
      MessageManager: 200,
      ChannelManager: {
        sweepInterval: 3600,
        sweepFilter: Sweepers.archivedThreadSweepFilter(),
      },
      GuildChannelManager: {
        sweepInterval: 3600,
        sweepFilter: Sweepers.archivedThreadSweepFilter(),
      },
      ThreadManager: {
        sweepInterval: 3600,
        sweepFilter: Sweepers.archivedThreadSweepFilter(),
      },
    };
  }

  public static defaultSweeperSettings: Record<string, unknown> = {
    threads: {
      interval: 3600,
      lifetime: 14400,
    },
  };
}

export default Options;

