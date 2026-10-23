import BaseGuild, { type BaseGuildData } from './BaseGuild.js';
import { VerificationLevels, NSFWLevels } from '../util/Constants.js';
import type { Snowflake } from '../types/index.js';
import type { Client } from '../client/Client.js';

export interface AnonymousGuildData extends BaseGuildData {
  splash?: string | null;
  banner?: string | null;
  description?: string | null;
  verification_level?: number | string;
  vanity_url_code?: string | null;
  nsfw_level?: number | string;
  premium_subscription_count?: number | null;
}

export abstract class AnonymousGuild extends BaseGuild {
  public splash: string | null = null;
  public banner: string | null = null;
  public description: string | null = null;
  public verificationLevel!: string;
  public vanityURLCode: string | null = null;
  public nsfwLevel!: string;
  public premiumSubscriptionCount: number | null = null;

  public constructor(client: Client, data: AnonymousGuildData, immediatePatch: boolean = true) {
    super(client, data);
    if (immediatePatch) this._patch(data);
  }

  public override _patch(data: AnonymousGuildData): this {
    if ('features' in data && data.features) this.features = data.features;

    if ('splash' in data) {
      this.splash = data.splash ?? null;
    }

    if ('banner' in data) {
      this.banner = data.banner ?? null;
    }

    if ('description' in data) {
      this.description = data.description ?? null;
    }

    if ('verification_level' in data && data.verification_level != null) {
      this.verificationLevel =
        typeof data.verification_level === 'number'
          ? (VerificationLevels as Record<number, string>)[data.verification_level]
          : data.verification_level;
    }

    if ('vanity_url_code' in data) {
      this.vanityURLCode = data.vanity_url_code ?? null;
    }

    if ('nsfw_level' in data && data.nsfw_level != null) {
      this.nsfwLevel =
        typeof data.nsfw_level === 'number'
          ? (NSFWLevels as Record<number, string>)[data.nsfw_level]
          : data.nsfw_level;
    }

    if ('premium_subscription_count' in data) {
      this.premiumSubscriptionCount = data.premium_subscription_count ?? null;
    } else {
      this.premiumSubscriptionCount ??= null;
    }

    return this;
  }

  public bannerURL({ format, size }: { format?: string; size?: number } = {}): string | null {
    if (!this.banner) return null;
    return (this.client.rest as unknown as { cdn: { Banner(id: Snowflake, banner: string, format?: string, size?: number): string } }).cdn.Banner(
      this.id,
      this.banner,
      format,
      size,
    );
  }

  public splashURL({ format, size }: { format?: string; size?: number } = {}): string | null {
    if (!this.splash) return null;
    return (this.client.rest as unknown as { cdn: { Splash(id: Snowflake, splash: string, format?: string, size?: number): string } }).cdn.Splash(
      this.id,
      this.splash,
      format,
      size,
    );
  }
}

export default AnonymousGuild;
