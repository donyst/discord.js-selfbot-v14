import { Collection } from '@discordjs/collection';
import GuildChannel, { type ChannelData } from './GuildChannel.js';
import type { Snowflake } from '../types/index.js';
import type { Guild } from './Guild.js';
import type { Client } from '../client/Client.js';
import type { Invite, CreateInviteOptions } from './Invite.js';

export interface StoreChannelData extends ChannelData {
  nsfw?: boolean;
}

/**
 * Represents a guild store channel on Discord.
 * @deprecated Store channels have been removed from Discord.
 */
export class StoreChannel extends GuildChannel {
  public nsfw: boolean;

  public constructor(guild: Guild, data: StoreChannelData, client?: Client) {
    super(guild, data, client);
    this.nsfw = Boolean(data.nsfw);
  }

  public override _patch(data: StoreChannelData): this {
    super._patch(data);

    if ('nsfw' in data && data.nsfw != null) {
      this.nsfw = Boolean(data.nsfw);
    }

    return this;
  }

  public createInvite(options?: CreateInviteOptions): Promise<Invite> {
    return (this.guild.invites as unknown as { create(id: Snowflake, opts?: CreateInviteOptions): Promise<Invite> }).create(
      this.id,
      options,
    );
  }

  public fetchInvites(cache = true): Promise<Collection<string, Invite>> {
    return (this.guild.invites as unknown as { fetch(opts: { channelId: Snowflake; cache?: boolean }): Promise<Collection<string, Invite>> }).fetch({
      channelId: this.id,
      cache,
    });
  }
}

export default StoreChannel;
