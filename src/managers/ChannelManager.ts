import process from 'node:process';
import { CachedManager } from './CachedManager.js';
import { Channel, type APIChannelData } from '../structures/Channel.js';
import { Events, ThreadChannelTypes, RelationshipTypes } from '../util/Constants.js';
import type { Snowflake, BaseFetchOptions, UserResolvable } from '../types/index.js';
import type { Client } from '../client/Client.js';
import type { Guild } from '../structures/Guild.js';
import type { GroupDMChannel } from '../structures/GroupDMChannel.js';

let cacheWarningEmitted = false;

export interface FetchChannelOptions extends BaseFetchOptions {
  allowUnknownGuild?: boolean;
}

export type ChannelResolvable = Channel | Snowflake;

/**
 * A manager of channels belonging to a client
 * @extends {CachedManager}
 */
export class ChannelManager extends CachedManager<Snowflake, Channel, ChannelResolvable> {
  public constructor(client: Client, iterable?: Iterable<Channel>) {
    super(client, Channel, iterable);

    const cacheObj = this._cache as unknown as {
      constructor: { name: string };
      maxSize?: number;
      sweepFilter?: { isDefault?: boolean };
    };

    const defaultCaching =
      cacheObj.constructor.name === 'Collection' ||
      ((cacheObj.maxSize === undefined || cacheObj.maxSize === Infinity) &&
        (cacheObj.sweepFilter === undefined || cacheObj.sweepFilter.isDefault));

    if (!cacheWarningEmitted && !defaultCaching) {
      cacheWarningEmitted = true;
      process.emitWarning(
        `Overriding the cache handling for ${this.constructor.name} is unsupported and breaks functionality.`,
        'UnsupportedCacheOverwriteWarning',
      );
    }
  }

  public override _add(
    data: unknown,
    guildOrCache?: Guild | null | boolean,
    options?: { cache?: boolean; allowUnknownGuild?: boolean; id?: Snowflake; extras?: unknown[] },
  ): Channel {
    const rawData = data as APIChannelData;
    const guild = (typeof guildOrCache === 'object' ? guildOrCache : undefined) ?? null;
    const cache = typeof guildOrCache === 'boolean' ? guildOrCache : (options?.cache ?? true);
    const allowUnknownGuild = options?.allowUnknownGuild ?? false;

    const existing = rawData.id ? this.cache.get(rawData.id) : undefined;
    if (existing) {
      if (cache) (existing as unknown as { _patch(d: unknown): void })._patch(rawData);
      if (guild) (guild.channels as unknown as { _add(c: unknown): void })?._add(existing);
      if (ThreadChannelTypes.includes(existing.type as unknown as (typeof ThreadChannelTypes)[number])) {
        const parent = (existing as unknown as { parent?: { threads?: { _add(t: unknown): void } } }).parent;
        parent?.threads?._add(existing);
      }
      return existing;
    }

    const channel = Channel.create(this.client, rawData, guild ?? undefined, { allowUnknownGuild });

    if (!channel) {
      this.client.emit(Events.DEBUG, `Failed to find guild, or unknown type for channel ${rawData.id} ${rawData.type}`);
      return null as unknown as Channel;
    }

    if (cache && !allowUnknownGuild) this.cache.set(channel.id, channel);

    return channel;
  }

  public _remove(id: Snowflake): void {
    const channel = this.cache.get(id);
    const chGuild = (channel as unknown as { guild?: Guild | null }).guild;
    chGuild?.channels.cache.delete(id);

    if (chGuild?.invites?.cache) {
      for (const [code, invite] of chGuild.invites.cache) {
        if ((invite as unknown as { channelId?: Snowflake }).channelId === id) {
          chGuild.invites.cache.delete(code);
        }
      }
    }

    const parent = (channel as unknown as { parent?: { threads?: { cache: Map<Snowflake, unknown> } } }).parent;
    parent?.threads?.cache.delete(id);
    this.cache.delete(id);

    const threads = (channel as unknown as { threads?: { cache: Map<Snowflake, unknown> } }).threads;
    if (threads) {
      for (const threadId of threads.cache.keys()) {
        this.cache.delete(threadId);
        chGuild?.channels.cache.delete(threadId);
      }
    }
  }

  /**
   * Obtains a channel from Discord, or the channel cache if it's already available.
   */
  public async fetch(
    id: Snowflake,
    { allowUnknownGuild = false, cache = true, force = false }: FetchChannelOptions = {},
  ): Promise<Channel | null> {
    if (!force) {
      const existing = this.cache.get(id);
      if (existing && !(existing as unknown as { partial?: boolean }).partial) return existing;
    }

    const api = this.client.api as unknown as {
      channels(chId: Snowflake): {
        get(): Promise<APIChannelData>;
      };
    };

    const data = await api.channels(id).get();
    return this._add(data, null, { cache, allowUnknownGuild });
  }

  /**
   * Create Group DM
   */
  public async createGroupDM(recipients: UserResolvable[] = []): Promise<GroupDMChannel | null> {
    if (!Array.isArray(recipients)) {
      throw new Error(`Expected an array of recipients (got ${typeof recipients})`);
    }

    const users = this.client.users as unknown as { resolveId(u: unknown): Snowflake | null };
    const relationships = (this.client as unknown as { relationships?: { cache: Map<Snowflake, number> } }).relationships;

    const resolvedRecipients = recipients
      .map(r => users.resolveId(r))
      .filter((r): r is Snowflake => Boolean(r && relationships?.cache.get(r) === RelationshipTypes.FRIEND));

    if (resolvedRecipients.length === 1 || resolvedRecipients.length > 9) {
      throw new Error('Invalid Users length (max=9)');
    }

    const api = this.client.api as unknown as {
      users: {
        ['@me']: {
          channels: {
            post(opts: { data: { recipients: Snowflake[] } }): Promise<APIChannelData>;
          };
        };
      };
    };

    const data = await api.users['@me'].channels.post({
      data: { recipients: resolvedRecipients },
    });

    return this._add(data, null, { cache: true, allowUnknownGuild: true }) as GroupDMChannel | null;
  }
}

export default ChannelManager;
