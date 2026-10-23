import EventEmitter from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { setTimeout as sleep } from 'node:timers/promises';
import { Collection } from '@discordjs/collection';
import { Shard } from './Shard.js';
import { DiscordjsError as Error, DiscordjsTypeError as TypeError, DiscordjsRangeError as RangeError } from '../errors/index.js';
import Util from '../util/Util.js';
import type { Client } from '../client/Client.js';
import type { BroadcastEvalOptions, MultipleShardRespawnOptions, ShardingManagerMode } from './ShardClientUtil.js';

export interface ShardingManagerOptions {
  totalShards?: number | 'auto';
  shardList?: number[] | 'auto';
  mode?: ShardingManagerMode;
  respawn?: boolean;
  shardArgs?: string[];
  execArgv?: string[];
  token?: string;
}

export interface MultipleShardSpawnOptions {
  amount?: number | 'auto';
  delay?: number;
  timeout?: number;
}

/**
 * Utility class that makes multi-process sharding of a bot an easy experience.
 * @extends {EventEmitter}
 */
export class ShardingManager extends EventEmitter {
  public file: string;
  public shardList: number[] | 'auto';
  public totalShards: number | 'auto';
  public mode: ShardingManagerMode;
  public respawn: boolean;
  public shardArgs: string[];
  public execArgv: string[];
  public token: string | null;
  public shards: Collection<number, Shard>;

  public constructor(file: string, options: ShardingManagerOptions = {}) {
    super();

    const mergedOptions: ShardingManagerOptions = Util.mergeDefault(
      {
        totalShards: 'auto',
        mode: 'process',
        respawn: true,
        shardArgs: [],
        execArgv: [],
        token: process.env.DISCORD_TOKEN,
      },
      options as Record<string, unknown>,
    ) as ShardingManagerOptions;

    this.file = file;
    if (!file) throw new Error('CLIENT_INVALID_OPTION', 'File', 'specified.');
    if (!path.isAbsolute(file)) this.file = path.resolve(process.cwd(), file);
    const stats = fs.statSync(this.file);
    if (!stats.isFile()) throw new Error('CLIENT_INVALID_OPTION', 'File', 'a file');

    this.shardList = mergedOptions.shardList ?? 'auto';
    if (this.shardList !== 'auto') {
      if (!Array.isArray(this.shardList)) {
        throw new TypeError('CLIENT_INVALID_OPTION', 'shardList', 'an array.');
      }
      this.shardList = [...new Set(this.shardList)];
      if (this.shardList.length < 1) throw new RangeError('CLIENT_INVALID_OPTION', 'shardList', 'at least 1 id.');
      if (
        this.shardList.some(
          (shardId) => typeof shardId !== 'number' || isNaN(shardId) || !Number.isInteger(shardId) || shardId < 0,
        )
      ) {
        throw new TypeError('CLIENT_INVALID_OPTION', 'shardList', 'an array of positive integers.');
      }
    }

    this.totalShards = mergedOptions.totalShards || 'auto';
    if (this.totalShards !== 'auto') {
      if (typeof this.totalShards !== 'number' || isNaN(this.totalShards)) {
        throw new TypeError('CLIENT_INVALID_OPTION', 'Amount of shards', 'a number.');
      }
      if (this.totalShards < 1) throw new RangeError('CLIENT_INVALID_OPTION', 'Amount of shards', 'at least 1.');
      if (!Number.isInteger(this.totalShards)) {
        throw new RangeError('CLIENT_INVALID_OPTION', 'Amount of shards', 'an integer.');
      }
    }

    this.mode = mergedOptions.mode ?? 'process';
    if (this.mode !== 'process' && this.mode !== 'worker') {
      throw new RangeError('CLIENT_INVALID_OPTION', 'Sharding mode', '"process" or "worker"');
    }

    this.respawn = mergedOptions.respawn ?? true;
    this.shardArgs = mergedOptions.shardArgs ?? [];
    this.execArgv = mergedOptions.execArgv ?? [];
    this.token = mergedOptions.token?.replace(/^Bot\s*/i, '') ?? null;
    this.shards = new Collection();

    process.env.SHARDING_MANAGER = 'true';
    process.env.SHARDING_MANAGER_MODE = this.mode;
    if (this.token) process.env.DISCORD_TOKEN = this.token;
  }

  /**
   * Creates a single shard.
   */
  public createShard(id: number = this.shards.size): Shard {
    const shard = new Shard(this, id);
    this.shards.set(id, shard);
    this.emit('shardCreate', shard);
    return shard;
  }

  /**
   * Spawns multiple shards.
   */
  public async spawn({
    amount = this.totalShards,
    delay = 5500,
    timeout = 30_000,
  }: MultipleShardSpawnOptions = {}): Promise<Collection<number, Shard>> {
    let resolvedAmount: number;
    if (amount === 'auto') {
      resolvedAmount = 1;
    } else {
      if (typeof amount !== 'number' || isNaN(amount)) {
        throw new TypeError('CLIENT_INVALID_OPTION', 'Amount of shards', 'a number.');
      }
      if (amount < 1) throw new RangeError('CLIENT_INVALID_OPTION', 'Amount of shards', 'at least 1.');
      if (!Number.isInteger(amount)) {
        throw new TypeError('CLIENT_INVALID_OPTION', 'Amount of shards', 'an integer.');
      }
      resolvedAmount = amount;
    }

    if (this.shards.size >= resolvedAmount) throw new Error('SHARDING_ALREADY_SPAWNED', this.shards.size);
    if (this.shardList === 'auto' || this.totalShards === 'auto' || this.totalShards !== resolvedAmount) {
      this.shardList = [...Array(resolvedAmount).keys()];
    }
    if (this.totalShards === 'auto' || this.totalShards !== resolvedAmount) {
      this.totalShards = resolvedAmount;
    }

    if (this.shardList.some((shardId) => shardId >= resolvedAmount)) {
      throw new RangeError(
        'CLIENT_INVALID_OPTION',
        'Amount of shards',
        'bigger than the highest shardId in the shardList option.',
      );
    }

    for (const shardId of this.shardList) {
      const promises: Promise<unknown>[] = [];
      const shard = this.createShard(shardId);
      promises.push(shard.spawn(timeout));
      if (delay > 0 && this.shards.size !== this.shardList.length) promises.push(sleep(delay));
      await Promise.all(promises);
    }

    return this.shards;
  }

  /**
   * Sends a message to all shards.
   */
  public broadcast(message: unknown): Promise<Shard[]> {
    const promises: Promise<Shard>[] = [];
    for (const shard of this.shards.values()) promises.push(shard.send(message));
    return Promise.all(promises);
  }

  /**
   * Evaluates a script on all shards, or a given shard, in the context of the Clients.
   */
  public async broadcastEval<T = unknown>(
    script: ((client: Client, context?: unknown) => unknown) | string,
    options: BroadcastEvalOptions = {},
  ): Promise<T[]> {
    if (typeof script !== 'function' && typeof script !== 'string') {
      throw new TypeError('SHARDING_INVALID_EVAL_BROADCAST');
    }
    const evalScript =
      typeof script === 'function'
        ? `(${script})(this, ${JSON.stringify(options.context)})`
        : script;

    return this._performOnShards<T>('eval', [evalScript], options.shard) as Promise<T[]>;
  }

  /**
   * Fetches a client property value of each shard, or a given shard.
   */
  public fetchClientValues<T = unknown>(prop: string, shard?: number): Promise<T | T[]> {
    return this._performOnShards<T>('fetchClientValue', [prop], shard);
  }

  /**
   * Runs a method with given arguments on all shards, or a given shard.
   */
  public async _performOnShards<T = unknown>(method: 'eval' | 'fetchClientValue', args: unknown[], shard?: number): Promise<T | T[]> {
    if (this.shards.size === 0) throw new Error('SHARDING_NO_SHARDS');

    if (typeof shard === 'number') {
      if (this.shards.has(shard)) {
        const targetShard = this.shards.get(shard)!;
        return (targetShard[method] as (...a: unknown[]) => Promise<T>)(...args);
      }
      throw new Error('SHARDING_SHARD_NOT_FOUND', shard);
    }

    if (this.shardList !== 'auto' && this.shards.size !== this.shardList.length) {
      throw new Error('SHARDING_IN_PROCESS');
    }

    const promises: Promise<T>[] = [];
    for (const sh of this.shards.values()) {
      promises.push((sh[method] as (...a: unknown[]) => Promise<T>)(...args));
    }
    return Promise.all(promises);
  }

  /**
   * Kills all running shards and respawns them.
   */
  public async respawnAll({
    shardDelay = 5_000,
    respawnDelay = 500,
    timeout = 30_000,
  }: MultipleShardRespawnOptions = {}): Promise<Collection<number, Shard>> {
    let s = 0;
    for (const shard of this.shards.values()) {
      const promises: Promise<unknown>[] = [shard.respawn({ delay: respawnDelay, timeout })];
      if (++s < this.shards.size && shardDelay > 0) promises.push(sleep(shardDelay));
      await Promise.all(promises);
    }
    return this.shards;
  }
}

export default ShardingManager;
