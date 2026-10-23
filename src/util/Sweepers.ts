import { Collection } from '@discordjs/collection';
import { Events, ThreadChannelTypes, SweeperKeys } from './Constants.js';
import type { SweeperKey } from './Constants.js';
import { DiscordjsTypeError } from '../errors/index.js';

export interface LifetimeFilterOptions<K = unknown, V = unknown> {
  lifetime?: number;
  getComparisonTimestamp?: (entry: V, key: K, collection: Collection<K, V>) => number | null | undefined;
  excludeFromSweep?: (entry: V, key: K, collection: Collection<K, V>) => boolean;
}

export type GlobalSweepFilter<K = unknown, V = unknown> = () =>
  | ((entry: V, key: K, collection: Collection<K, V>) => boolean)
  | null;

export type SweepFilterPredicate = (...args: unknown[]) => boolean;

export interface SweeperOptionInfo {
  interval: number;
  filter?: () => SweepFilterPredicate | null;
  lifetime?: number;
}

export type SweeperOptions = Partial<Record<SweeperKey, SweeperOptionInfo>> & Record<string, unknown>;

export interface SweeperClient {
  guilds: {
    cache: Collection<string, unknown>;
  };
  channels: {
    cache: Collection<string, unknown>;
    _remove?: (id: string) => void;
  };
  users: {
    cache: Collection<string, unknown>;
  };
  application?: {
    commands: {
      cache: Collection<string, unknown>;
    };
  };
  emit(event: string, ...args: unknown[]): boolean;
}

export interface SweepEventOptions {
  emit?: boolean;
  outputName?: string;
}

/**
 * A container for all cache sweeping intervals and their associated sweep methods.
 */
export class Sweepers {
  public readonly client: SweeperClient;
  public options: SweeperOptions;
  public intervals: Record<SweeperKey, NodeJS.Timeout | null>;

  public constructor(client: SweeperClient, options: SweeperOptions) {
    Object.defineProperty(this, 'client', { value: client });
    this.options = options;
    this.intervals = Object.fromEntries(SweeperKeys.map(key => [key, null])) as Record<
      SweeperKey,
      NodeJS.Timeout | null
    >;

    for (const key of SweeperKeys) {
      if (!(key in options)) continue;

      this._validateProperties(key);

      const clonedOptions = { ...(this.options[key] as SweeperOptionInfo) };

      // Handle cases that have a "lifetime"
      if (!('filter' in clonedOptions)) {
        switch (key) {
          case 'invites':
            clonedOptions.filter = (
              this.constructor as typeof Sweepers
            ).expiredInviteSweepFilter(clonedOptions.lifetime) as unknown as () => SweepFilterPredicate | null;
            break;
          case 'messages':
            clonedOptions.filter = (
              this.constructor as typeof Sweepers
            ).outdatedMessageSweepFilter(clonedOptions.lifetime) as unknown as () => SweepFilterPredicate | null;
            break;
          case 'threads':
            clonedOptions.filter = (
              this.constructor as typeof Sweepers
            ).archivedThreadSweepFilter(clonedOptions.lifetime) as unknown as () => SweepFilterPredicate | null;
            break;
        }
      }

      const methodName = `sweep${key[0]!.toUpperCase()}${key.slice(1)}` as keyof this;
      this._initInterval(key, methodName, clonedOptions);
    }
  }

  public sweepApplicationCommands(filter: (value: unknown, key: string, collection: Collection<string, unknown>) => boolean): number {
    const { guilds, items: guildCommands } = this._sweepGuildDirectProp('commands', filter, { emit: false });
    const globalCommands = this.client.application?.commands.cache.sweep(filter) ?? 0;

    this.client.emit(
      Events.CACHE_SWEEP,
      `Swept ${globalCommands} global application commands and ${guildCommands} guild commands in ${guilds} guilds.`,
    );
    return guildCommands + globalCommands;
  }

  public sweepAutoModerationRules(filter: (value: unknown, key: string, collection: Collection<string, unknown>) => boolean): number {
    return this._sweepGuildDirectProp('autoModerationRules', filter).items;
  }

  public sweepBans(filter: (value: unknown, key: string, collection: Collection<string, unknown>) => boolean): number {
    return this._sweepGuildDirectProp('bans', filter).items;
  }

  public sweepEmojis(filter: (value: unknown, key: string, collection: Collection<string, unknown>) => boolean): number {
    return this._sweepGuildDirectProp('emojis', filter).items;
  }

  public sweepInvites(filter: (value: unknown, key: string, collection: Collection<string, unknown>) => boolean): number {
    return this._sweepGuildDirectProp('invites', filter).items;
  }

  public sweepGuildMembers(filter: (value: unknown, key: string, collection: Collection<string, unknown>) => boolean): number {
    return this._sweepGuildDirectProp('members', filter, { outputName: 'guild members' }).items;
  }

  public sweepMessages(filter: ((value: unknown, key: string, collection: Collection<string, unknown>) => boolean) | SweepFilterPredicate): number {
    if (typeof filter !== 'function') {
      throw new DiscordjsTypeError('INVALID_TYPE', 'filter', 'function');
    }
    let channels = 0;
    let messages = 0;

    for (const rawChannel of this.client.channels.cache.values()) {
      const channel = rawChannel as { isText?: () => boolean; messages?: { cache: Collection<string, unknown> } };
      if (!channel.isText?.() || !channel.messages) continue;

      channels++;
      messages += channel.messages.cache.sweep(filter as (value: unknown, key: string, collection: Collection<string, unknown>) => boolean);
    }
    this.client.emit(Events.CACHE_SWEEP, `Swept ${messages} messages in ${channels} text-based channels.`);
    return messages;
  }

  public sweepPresences(filter: (value: unknown, key: string, collection: Collection<string, unknown>) => boolean): number {
    return this._sweepGuildDirectProp('presences', filter).items;
  }

  public sweepReactions(filter: (value: unknown, key: string, collection: Collection<string, unknown>) => boolean): number {
    if (typeof filter !== 'function') {
      throw new DiscordjsTypeError('INVALID_TYPE', 'filter', 'function');
    }
    let channels = 0;
    let messages = 0;
    let reactions = 0;

    for (const rawChannel of this.client.channels.cache.values()) {
      const channel = rawChannel as { isText?: () => boolean; messages?: { cache: Collection<string, { reactions?: { cache: Collection<string, unknown> } }> } };
      if (!channel.isText?.() || !channel.messages) continue;
      channels++;

      for (const message of channel.messages.cache.values()) {
        messages++;
        if (message.reactions) {
          reactions += message.reactions.cache.sweep(filter);
        }
      }
    }
    this.client.emit(
      Events.CACHE_SWEEP,
      `Swept ${reactions} reactions on ${messages} messages in ${channels} text-based channels.`,
    );
    return reactions;
  }

  public sweepStageInstances(filter: (value: unknown, key: string, collection: Collection<string, unknown>) => boolean): number {
    return this._sweepGuildDirectProp('stageInstances', filter, { outputName: 'stage instances' }).items;
  }

  public sweepStickers(filter: (value: unknown, key: string, collection: Collection<string, unknown>) => boolean): number {
    return this._sweepGuildDirectProp('stickers', filter).items;
  }

  public sweepThreadMembers(filter: (value: unknown, key: string, collection: Collection<string, unknown>) => boolean): number {
    if (typeof filter !== 'function') {
      throw new DiscordjsTypeError('INVALID_TYPE', 'filter', 'function');
    }

    let threads = 0;
    let members = 0;
    for (const rawChannel of this.client.channels.cache.values()) {
      const channel = rawChannel as { type: string | number; members?: { cache: Collection<string, unknown> } };
      if (!ThreadChannelTypes.includes(String(channel.type))) continue;
      threads++;
      if (channel.members) {
        members += channel.members.cache.sweep(filter);
      }
    }
    this.client.emit(Events.CACHE_SWEEP, `Swept ${members} thread members in ${threads} threads.`);
    return members;
  }

  public sweepThreads(filter: (value: unknown, key: string, collection: Collection<string, unknown>) => boolean): number {
    if (typeof filter !== 'function') {
      throw new DiscordjsTypeError('INVALID_TYPE', 'filter', 'function');
    }

    let threads = 0;
    for (const [key, rawVal] of this.client.channels.cache.entries()) {
      const val = rawVal as { type: string | number };
      if (!ThreadChannelTypes.includes(String(val.type))) continue;
      if (filter(val, key, this.client.channels.cache as unknown as Collection<string, unknown>)) {
        threads++;
        this.client.channels._remove?.(key);
      }
    }
    this.client.emit(Events.CACHE_SWEEP, `Swept ${threads} threads.`);
    return threads;
  }

  public sweepUsers(filter: (value: unknown, key: string, collection: Collection<string, unknown>) => boolean): number {
    if (typeof filter !== 'function') {
      throw new DiscordjsTypeError('INVALID_TYPE', 'filter', 'function');
    }

    const users = this.client.users.cache.sweep(filter);
    this.client.emit(Events.CACHE_SWEEP, `Swept ${users} users.`);
    return users;
  }

  public sweepVoiceStates(filter: (value: unknown, key: string, collection: Collection<string, unknown>) => boolean): number {
    return this._sweepGuildDirectProp('voiceStates', filter, { outputName: 'voice states' }).items;
  }

  public destroy(): void {
    for (const key of SweeperKeys) {
      if (this.intervals[key]) {
        clearInterval(this.intervals[key]!);
        this.intervals[key] = null;
      }
    }
  }

  public static filterByLifetime<K = unknown, V = unknown>({
    lifetime = 14400,
    getComparisonTimestamp = (e: V) => (e as { createdTimestamp?: number })?.createdTimestamp,
    excludeFromSweep = () => false,
  }: LifetimeFilterOptions<K, V> = {}): GlobalSweepFilter<K, V> {
    if (typeof lifetime !== 'number') {
      throw new DiscordjsTypeError('INVALID_TYPE', 'lifetime', 'number');
    }
    if (typeof getComparisonTimestamp !== 'function') {
      throw new DiscordjsTypeError('INVALID_TYPE', 'getComparisonTimestamp', 'function');
    }
    if (typeof excludeFromSweep !== 'function') {
      throw new DiscordjsTypeError('INVALID_TYPE', 'excludeFromSweep', 'function');
    }
    return () => {
      if (lifetime <= 0) return null;
      const lifetimeMs = lifetime * 1_000;
      const now = Date.now();
      return (entry: V, key: K, coll: Collection<K, V>) => {
        if (excludeFromSweep(entry, key, coll)) {
          return false;
        }
        const comparisonTimestamp = getComparisonTimestamp(entry, key, coll);
        if (!comparisonTimestamp || typeof comparisonTimestamp !== 'number') return false;
        return now - comparisonTimestamp > lifetimeMs;
      };
    };
  }

  public static archivedThreadSweepFilter(lifetime = 14400): GlobalSweepFilter<unknown, { archived?: boolean; archiveTimestamp?: number }> {
    return this.filterByLifetime({
      lifetime,
      getComparisonTimestamp: e => e.archiveTimestamp,
      excludeFromSweep: e => !e.archived,
    });
  }

  public static expiredInviteSweepFilter(lifetime = 14400): GlobalSweepFilter<unknown, { expiresTimestamp?: number }> {
    return this.filterByLifetime({
      lifetime,
      getComparisonTimestamp: i => i.expiresTimestamp,
    });
  }

  public static outdatedMessageSweepFilter(lifetime = 3600): GlobalSweepFilter<unknown, { editedTimestamp?: number; createdTimestamp?: number }> {
    return this.filterByLifetime({
      lifetime,
      getComparisonTimestamp: m => m.editedTimestamp ?? m.createdTimestamp,
    });
  }

  private _sweepGuildDirectProp(
    key: string,
    filter: (value: unknown, key: string, collection: Collection<string, unknown>) => boolean,
    { emit = true, outputName }: SweepEventOptions = {},
  ): { guilds: number; items: number } {
    if (typeof filter !== 'function') {
      throw new DiscordjsTypeError('INVALID_TYPE', 'filter', 'function');
    }

    let guilds = 0;
    let items = 0;

    for (const rawGuild of this.client.guilds.cache.values()) {
      const guild = rawGuild as Record<string, { cache?: Collection<string, unknown> } | undefined>;
      const prop = guild[key];
      if (!prop?.cache) continue;

      guilds++;
      items += prop.cache.sweep(filter);
    }

    if (emit) {
      this.client.emit(Events.CACHE_SWEEP, `Swept ${items} ${outputName ?? key} in ${guilds} guilds.`);
    }

    return { guilds, items };
  }

  private _validateProperties(key: string): void {
    const props = this.options[key] as Record<string, unknown> | undefined;
    if (typeof props !== 'object' || props === null) {
      throw new DiscordjsTypeError('INVALID_TYPE', `sweepers.${key}`, 'object', true);
    }
    if (typeof props.interval !== 'number') {
      throw new DiscordjsTypeError('INVALID_TYPE', `sweepers.${key}.interval`, 'number');
    }
    if (['invites', 'messages', 'threads'].includes(key) && !('filter' in props)) {
      if (typeof props.lifetime !== 'number') {
        throw new DiscordjsTypeError('INVALID_TYPE', `sweepers.${key}.lifetime`, 'number');
      }
      return;
    }
    if (typeof props.filter !== 'function') {
      throw new DiscordjsTypeError('INVALID_TYPE', `sweepers.${key}.filter`, 'function');
    }
  }

  private _initInterval(intervalKey: SweeperKey, sweepKey: keyof this, opts: SweeperOptionInfo): void {
    if (opts.interval <= 0 || opts.interval === Infinity) return;
    this.intervals[intervalKey] = setInterval(() => {
      const sweepFn = opts.filter?.();
      if (sweepFn === null || sweepFn === undefined) return;
      if (typeof sweepFn !== 'function') throw new DiscordjsTypeError('SWEEP_FILTER_RETURN');
      const method = this[sweepKey];
      if (typeof method === 'function') {
        (method as (fn: unknown) => void).call(this, sweepFn);
      }
    }, opts.interval * 1_000).unref();
  }
}

export default Sweepers;
