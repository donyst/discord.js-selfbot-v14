import Base from './Base.js';
import Role from './Role.js';
import { TypeError as DjsTypeError } from '../errors/index.js';
import { OverwriteTypes } from '../util/Constants.js';
import Permissions, { type PermissionResolvable } from '../util/Permissions.js';
import type { Snowflake } from '../types/index.js';
import type { Client } from '../client/Client.js';
import type { Guild } from './Guild.js';
import type { GuildChannel } from './GuildChannel.js';

export type OverwriteType = keyof typeof OverwriteTypes;

export type PermissionOverwriteOptions = Record<string, boolean | null>;

export interface ResolvedOverwriteOptions {
  allow: Permissions;
  deny: Permissions;
}

export interface RawOverwriteData {
  id: Snowflake;
  type: number | OverwriteType;
  allow: string;
  deny: string;
}

export interface OverwriteData {
  id: Snowflake | { id: Snowflake };
  allow?: PermissionResolvable;
  deny?: PermissionResolvable;
  type?: OverwriteType | number;
}

export type OverwriteResolvable = PermissionOverwrites | OverwriteData;

export class PermissionOverwrites extends Base {
  public readonly channel!: GuildChannel;
  public type!: OverwriteType;
  public deny!: Readonly<Permissions>;
  public allow!: Readonly<Permissions>;

  public constructor(client: Client, data?: RawOverwriteData, channel?: GuildChannel) {
    super(client);
    Object.defineProperty(this, 'channel', { value: channel });
    if (data) this._patch(data);
  }

  public _patch(data: RawOverwriteData): void {
    this.id = data.id;

    if ('type' in data && data.type != null) {
      this.type = typeof data.type === 'number'
        ? ((OverwriteTypes as Record<number, OverwriteType>)[data.type] ?? 'role')
        : (data.type as OverwriteType);
    }

    if ('deny' in data && data.deny != null) {
      this.deny = new Permissions(BigInt(data.deny)).freeze();
    }

    if ('allow' in data && data.allow != null) {
      this.allow = new Permissions(BigInt(data.allow)).freeze();
    }
  }

  public async edit(options: PermissionOverwriteOptions, reason?: string): Promise<this> {
    await (this.channel.permissionOverwrites as unknown as {
      upsert(
        id: Snowflake,
        options: PermissionOverwriteOptions,
        extra: { type: number | OverwriteType; reason?: string },
        instance: unknown,
      ): Promise<unknown>;
    }).upsert(
      this.id,
      options,
      { type: (OverwriteTypes as Record<string, number>)[this.type] ?? this.type, reason },
      this,
    );
    return this;
  }

  public async delete(reason?: string): Promise<this> {
    await (this.channel.permissionOverwrites as unknown as {
      delete(id: Snowflake, reason?: string): Promise<unknown>;
    }).delete(this.id, reason);
    return this;
  }

  public override toJSON(): RawOverwriteData {
    return {
      id: this.id,
      type: (OverwriteTypes as Record<string, number>)[this.type] ?? this.type,
      allow: this.allow.bitfield.toString(),
      deny: this.deny.bitfield.toString(),
    };
  }

  public static resolveOverwriteOptions(
    options: PermissionOverwriteOptions,
    { allow, deny }: { allow?: PermissionResolvable; deny?: PermissionResolvable } = {},
  ): ResolvedOverwriteOptions {
    const resolvedAllow = new Permissions(allow);
    const resolvedDeny = new Permissions(deny);

    for (const [perm, value] of Object.entries(options)) {
      if (value === true) {
        resolvedAllow.add(perm as Parameters<typeof resolvedAllow.add>[0]);
        resolvedDeny.remove(perm as Parameters<typeof resolvedDeny.remove>[0]);
      } else if (value === false) {
        resolvedAllow.remove(perm as Parameters<typeof resolvedAllow.remove>[0]);
        resolvedDeny.add(perm as Parameters<typeof resolvedDeny.add>[0]);
      } else if (value === null) {
        resolvedAllow.remove(perm as Parameters<typeof resolvedAllow.remove>[0]);
        resolvedDeny.remove(perm as Parameters<typeof resolvedDeny.remove>[0]);
      }
    }

    return { allow: resolvedAllow, deny: resolvedDeny };
  }

  public static resolve(overwrite: OverwriteResolvable, guild?: Guild): RawOverwriteData {
    if (overwrite instanceof PermissionOverwrites) return overwrite.toJSON();
    const id = typeof overwrite.id === 'string' ? overwrite.id : overwrite.id.id;
    const typeStr = typeof overwrite.type === 'string' ? overwrite.type : undefined;

    if (id && typeStr && typeStr in OverwriteTypes) {
      return {
        id,
        type: (OverwriteTypes as Record<string, number>)[typeStr],
        allow: Permissions.resolve(overwrite.allow ?? Permissions.defaultBit).toString(),
        deny: Permissions.resolve(overwrite.deny ?? Permissions.defaultBit).toString(),
      };
    }

    if (!guild) {
      throw new DjsTypeError('INVALID_TYPE', 'parameter', 'cached User or Role');
    }

    const userOrRole = guild.roles.resolve(id) ?? guild.client.users.resolve(id);
    if (!userOrRole) {
      throw new DjsTypeError('INVALID_TYPE', 'parameter', 'cached User or Role');
    }
    const type = userOrRole instanceof Role ? OverwriteTypes.role : OverwriteTypes.member;

    return {
      id: userOrRole.id,
      type,
      allow: Permissions.resolve(overwrite.allow ?? Permissions.defaultBit).toString(),
      deny: Permissions.resolve(overwrite.deny ?? Permissions.defaultBit).toString(),
    };
  }
}

export default PermissionOverwrites;
