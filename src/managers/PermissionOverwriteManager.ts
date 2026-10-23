import process from 'node:process';
import { Collection } from '@discordjs/collection';
import CachedManager from './CachedManager.js';
import { TypeError as DjsTypeError } from '../errors/index.js';
import PermissionOverwrites, {
  type PermissionOverwriteOptions,
  type OverwriteResolvable,
  type RawOverwriteData,
} from '../structures/PermissionOverwrites.js';
import Role from '../structures/Role.js';
import { OverwriteTypes } from '../util/Constants.js';
import type { Snowflake } from '../types/index.js';
import type { GuildChannel } from '../structures/GuildChannel.js';
import type { User } from '../structures/User.js';

let cacheWarningEmitted = false;

export interface GuildChannelOverwriteOptions {
  reason?: string;
  type?: number;
}

export class PermissionOverwriteManager extends CachedManager<Snowflake, PermissionOverwrites, RawOverwriteData> {
  public channel: GuildChannel;

  public constructor(channel: GuildChannel, iterable?: Iterable<RawOverwriteData | PermissionOverwrites>) {
    super(channel.client, PermissionOverwrites);
    if (!cacheWarningEmitted && this._cache.constructor.name !== 'Collection') {
      cacheWarningEmitted = true;
      process.emitWarning(
        `Overriding the cache handling for ${this.constructor.name} is unsupported and breaks functionality.`,
        'UnsupportedCacheOverwriteWarning',
      );
    }

    this.channel = channel;

    if (iterable) {
      for (const item of iterable) {
        this._add(item);
      }
    }
  }

  public override _add(data: RawOverwriteData | PermissionOverwrites, cache?: boolean): PermissionOverwrites {
    return super._add(data, cache, { extras: [this.channel] });
  }

  public async set(
    overwrites: OverwriteResolvable[] | Collection<Snowflake, OverwriteResolvable>,
    reason?: string,
  ): Promise<GuildChannel> {
    if (!Array.isArray(overwrites) && !(overwrites instanceof Collection)) {
      throw new DjsTypeError('INVALID_TYPE', 'overwrites', 'Array or Collection of Permission Overwrites', true);
    }
    const resolvedOverwrites = (Array.isArray(overwrites) ? overwrites : [...overwrites.values()]).map(o =>
      PermissionOverwrites.resolve(o, this.channel.guild),
    );
    return this.channel.edit({ permissionOverwrites: resolvedOverwrites, reason });
  }

  public async upsert(
    userOrRole: Role | User | Snowflake | { id: Snowflake },
    options: PermissionOverwriteOptions,
    overwriteOptions: GuildChannelOverwriteOptions = {},
    existing?: PermissionOverwrites,
  ): Promise<GuildChannel> {
    const userOrRoleId =
      this.channel.guild.roles.resolveId(userOrRole as Snowflake) ??
      (this.client.users as unknown as { resolveId(u: unknown): Snowflake | null }).resolveId(userOrRole);

    let { type, reason } = overwriteOptions;
    if (typeof type !== 'number') {
      const resolved =
        this.channel.guild.roles.resolve(userOrRole as Snowflake) ??
        (this.client.users as unknown as { resolve(u: unknown): User | null }).resolve(userOrRole);
      if (!resolved) throw new DjsTypeError('INVALID_TYPE', 'parameter', 'User nor a Role');
      type = (resolved instanceof Role ? OverwriteTypes.role : OverwriteTypes.member) as number;
    }

    const { allow, deny } = PermissionOverwrites.resolveOverwriteOptions(options, existing);

    await (this.client as unknown as { api: { channels(cid: Snowflake): { permissions(uid: Snowflake | null): { put(opts: { data: unknown; reason?: string }): Promise<unknown> } } } })
      .api.channels(this.channel.id)
      .permissions(userOrRoleId)
      .put({
        data: { id: userOrRoleId, type, allow: allow.bitfield.toString(), deny: deny.bitfield.toString() },
        reason,
      });
    return this.channel;
  }

  public create(
    userOrRole: Role | User | Snowflake | { id: Snowflake },
    options: PermissionOverwriteOptions,
    overwriteOptions?: GuildChannelOverwriteOptions,
  ): Promise<GuildChannel> {
    return this.upsert(userOrRole, options, overwriteOptions);
  }

  public edit(
    userOrRole: Role | User | Snowflake | { id: Snowflake },
    options: PermissionOverwriteOptions,
    overwriteOptions?: GuildChannelOverwriteOptions,
  ): Promise<GuildChannel> {
    const userOrRoleId =
      this.channel.guild.roles.resolveId(userOrRole as Snowflake) ??
      (this.client.users as unknown as { resolveId(u: unknown): Snowflake | null }).resolveId(userOrRole);
    const existing = userOrRoleId ? this.cache.get(userOrRoleId) : undefined;
    return this.upsert(userOrRole, options, overwriteOptions, existing);
  }

  public async delete(userOrRole: Role | User | Snowflake | { id: Snowflake }, reason?: string): Promise<GuildChannel> {
    const userOrRoleId =
      this.channel.guild.roles.resolveId(userOrRole as Snowflake) ??
      (this.client.users as unknown as { resolveId(u: unknown): Snowflake | null }).resolveId(userOrRole);
    if (!userOrRoleId) throw new DjsTypeError('INVALID_TYPE', 'parameter', 'User nor a Role');

    await (this.client as unknown as { api: { channels(cid: Snowflake): { permissions(uid: Snowflake): { delete(opts: { reason?: string }): Promise<unknown> } } } })
      .api.channels(this.channel.id)
      .permissions(userOrRoleId)
      .delete({ reason });
    return this.channel;
  }
}

export default PermissionOverwriteManager;
