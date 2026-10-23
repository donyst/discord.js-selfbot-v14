import { Collection } from '@discordjs/collection';
import GuildChannel from './GuildChannel.js';
import type { GuildChannelCreateOptions } from '../managers/GuildChannelManager.js';
import type { Snowflake } from '../types/index.js';

export type CategoryCreateChannelOptions = GuildChannelCreateOptions;

/**
 * Represents a guild category channel on Discord.
 */
export class CategoryChannel extends GuildChannel {
  public override get parentId(): null {
    return null;
  }

  public override get parent(): null {
    return null;
  }

  public get children(): Collection<Snowflake, GuildChannel> {
    return (this.guild.channels.cache as unknown as Collection<Snowflake, GuildChannel>).filter(c => c.parentId === this.id);
  }

  public createChannel(name: string, options: CategoryCreateChannelOptions = {}): Promise<GuildChannel> {
    return (this.guild.channels as unknown as { create(name: string, opts: unknown): Promise<GuildChannel> }).create(name, {
      ...options,
      parent: this.id,
    });
  }
}

export default CategoryChannel;
