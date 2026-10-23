import { randomUUID } from 'node:crypto';
import type { SuperProperties } from '../types/index.js';
import { UserAgent } from './Constants.js';

export type ClientPlatformMode = 'desktop' | 'mobile' | 'web';
export type DesktopOS = 'Windows' | 'Mac OS X' | 'Linux';
export type MobileOS = 'iOS' | 'Android';

export interface FingerprintData {
  clientVersion: string;
  clientBuildNumber: number;
  nativeBuildNumber: number;
  versionHash: string;
  sentryRelease: string;
  lastUpdated: number;
}

export interface FingerprintGenerationOptions {
  mode?: ClientPlatformMode;
  os?: DesktopOS | MobileOS | string;
  osVersion?: string;
  locale?: string;
  releaseChannel?: 'stable' | 'ptb' | 'canary' | 'development';
}

/**
 * Manages dynamic client fingerprint scraping, synchronization, and SuperProperties generation
 * based on ground-truth reverse engineered Discord Desktop Electron signatures.
 */
export class ClientFingerprintManager {
  private static cachedData: FingerprintData = {
    clientVersion: '1.0.9265',
    clientBuildNumber: 647615,
    nativeBuildNumber: 96160,
    versionHash: '3b2687994fb9072c70fc836c5aefd186e2ce5270',
    sentryRelease: 'discord-desktop-6a2c449a768e5cd9570c6187983050e2be62e4df',
    lastUpdated: Date.now(),
  };

  private static syncInterval: NodeJS.Timeout | null = null;

  /**
   * Returns the current cached fingerprint metadata.
   */
  public static get data(): Readonly<FingerprintData> {
    return this.cachedData;
  }

  /**
   * Scrapes Discord CDN to retrieve the latest build number and client version hash.
   * Falls back gracefully to verified ground-truth values if network or parsing fails.
   */
  public static async fetchLatest(): Promise<FingerprintData> {
    try {
      const res = await fetch('https://discord.com/app', {
        headers: {
          'User-Agent': UserAgent,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      if (res.ok) {
        const html = await res.text();
        // Extract script assets matching web.*.js or assets/*.js
        const scriptMatches = [...html.matchAll(/src="(\/assets\/[^"]+\.js)"/g)];
        const candidateUrls = scriptMatches.map(m => `https://discord.com${m[1]}`).slice(-4);

        for (const url of candidateUrls) {
          try {
            const scriptRes = await fetch(url, { headers: { 'User-Agent': UserAgent } });
            if (scriptRes.ok) {
              const scriptText = await scriptRes.text();
              const buildMatch = scriptText.match(/buildNumber["\s:]+(\d{5,8})/i) ||
                scriptText.match(/client_build_number["\s:]+(\d{5,8})/i) ||
                scriptText.match(/Build Number:\s*(\d{5,8})/i);

              if (buildMatch?.[1]) {
                const parsedBuildNumber = Number.parseInt(buildMatch[1], 10);
                if (parsedBuildNumber > 600000) {
                  this.cachedData.clientBuildNumber = parsedBuildNumber;
                }
              }

              const hashMatch = scriptText.match(/versionHash["\s:]+"([a-f0-9]{40})"/i);
              if (hashMatch?.[1]) {
                this.cachedData.versionHash = hashMatch[1];
              }

              this.cachedData.lastUpdated = Date.now();
              break;
            }
          } catch {
            // Check next script
          }
        }
      }
    } catch {
      // Graceful fallback to cached/default data
    }

    return this.cachedData;
  }

  /**
   * Starts periodic background synchronization of the client fingerprint.
   * @param intervalMs Interval in milliseconds (default: 3,600,000 ms / 1 hour)
   */
  public static startAutoSync(intervalMs = 3_600_000): void {
    if (this.syncInterval) clearInterval(this.syncInterval);
    this.syncInterval = setInterval(() => {
      void this.fetchLatest();
    }, intervalMs);
    this.syncInterval.unref?.();
  }

  /**
   * Stops periodic synchronization.
   */
  public static stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * Builds genuine SuperProperties conforming to official Discord clients.
   */
  public static getSuperProperties(options: FingerprintGenerationOptions = {}): SuperProperties {
    const mode = options.mode ?? 'desktop';
    const releaseChannel = options.releaseChannel ?? 'stable';
    const locale = options.locale ?? 'en-US';

    if (mode === 'mobile') {
      const isIOS = options.os === 'iOS' || (!options.os && true);
      if (isIOS) {
        return {
          os: 'iOS',
          browser: 'Discord iOS',
          device: 'iPhone',
          device_model_name: 'iPhone14,2',
          system_locale: locale,
          browser_user_agent: '',
          browser_version: '220.0',
          os_version: options.osVersion ?? '18.1',
          os_sdk_version: '18.1',
          client_version: '220.0',
          release_channel: releaseChannel,
          client_build_number: this.cachedData.clientBuildNumber,
          client_event_source: null,
          has_client_mods: false,
        };
      }
      return {
        os: 'Android',
        browser: 'Discord Android',
        device: 'Pixel 8 Pro',
        device_model_name: 'husky',
        system_locale: locale,
        browser_user_agent: '',
        browser_version: '220.0',
        os_version: options.osVersion ?? '14',
        os_sdk_version: '34',
        client_version: '220.0',
        release_channel: releaseChannel,
        client_build_number: this.cachedData.clientBuildNumber,
        client_event_source: null,
        has_client_mods: false,
      };
    }

    if (mode === 'web') {
      return {
        os: options.os ?? 'Windows',
        browser: 'Chrome',
        system_locale: locale,
        browser_user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
        browser_version: '148.0.0.0',
        os_version: options.osVersion ?? '10.0.26300',
        client_version: this.cachedData.clientVersion,
        release_channel: releaseChannel,
        client_build_number: this.cachedData.clientBuildNumber,
        client_event_source: null,
        has_client_mods: false,
      };
    }

    // Default: Desktop Electron client matching reverse-engineered ground truth
    return {
      os: options.os ?? 'Windows',
      browser: 'Discord Client',
      release_channel: releaseChannel,
      client_version: this.cachedData.clientVersion,
      os_version: options.osVersion ?? '10.0.26300',
      os_arch: 'x64',
      app_arch: 'x64',
      system_locale: locale,
      has_client_mods: false,
      client_launch_id: randomUUID(),
      browser_user_agent: UserAgent,
      browser_version: '42.11.15',
      os_sdk_version: '26300',
      client_build_number: this.cachedData.clientBuildNumber,
      native_build_number: this.cachedData.nativeBuildNumber,
      client_event_source: null,
      launch_signature: randomUUID(),
      client_heartbeat_session_id: randomUUID(),
      client_app_state: 'focused',
    };
  }

  /**
   * Generates a Base64-encoded string of the SuperProperties for X-Super-Properties header.
   */
  public static getSuperPropertiesBase64(options?: FingerprintGenerationOptions): string {
    const props = this.getSuperProperties(options);
    return Buffer.from(JSON.stringify(props), 'utf-8').toString('base64');
  }
}

export default ClientFingerprintManager;
