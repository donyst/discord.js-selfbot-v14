import BaseGuildTextChannel from './BaseGuildTextChannel.js';
import { DiscordjsError as DjsError } from '../errors/index.js';
import type { Snowflake } from '../types/index.js';
import type { TextChannel } from './TextChannel.js';

export type TextChannelResolvable = TextChannel | NewsChannel | Snowflake;

/**
 * Represents a guild news channel on Discord.
 */
export class NewsChannel extends BaseGuildTextChannel {
  public async addFollower(channel: TextChannelResolvable, reason?: string): Promise<this> {
    const channelId = (this.guild.channels as unknown as { resolveId(ch: unknown): Snowflake | null }).resolveId(channel);
    if (!channelId) throw new DjsError('GUILD_CHANNEL_RESOLVE');

    await (this.client as unknown as {
      api: {
        channels(chId: Snowflake): {
          followers: {
            post(opts: { data: { webhook_channel_id: Snowflake }; reason?: string }): Promise<unknown>;
          };
        };
      };
    }).api
      .channels(this.id)
      .followers.post({ data: { webhook_channel_id: channelId }, reason });

    return this;
  }
}

export default NewsChannel;
