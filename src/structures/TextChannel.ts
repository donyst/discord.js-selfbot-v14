import BaseGuildTextChannel, { type BaseGuildTextChannelData } from './BaseGuildTextChannel.js';

export interface TextChannelData extends BaseGuildTextChannelData {
  rate_limit_per_user?: number;
}

/**
 * Represents a guild text channel on Discord.
 */
export class TextChannel extends BaseGuildTextChannel {
  public rateLimitPerUser: number = 0;

  public override _patch(data: TextChannelData): this {
    super._patch(data);

    if ('rate_limit_per_user' in data && data.rate_limit_per_user != null) {
      this.rateLimitPerUser = data.rate_limit_per_user;
    }

    return this;
  }

  public override setRateLimitPerUser(rateLimitPerUser: number, reason?: string): Promise<this> {
    return this.edit({ rateLimitPerUser }, reason) as Promise<this>;
  }
}

export default TextChannel;
