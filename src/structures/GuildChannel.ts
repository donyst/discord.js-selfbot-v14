import Channel, { type APIChannelData } from './Channel.js';
import { Error as DjsError } from '../errors/index.js';
import PermissionOverwriteManager from '../managers/PermissionOverwriteManager.js';
import { VoiceBasedChannelTypes } from '../util/Constants.js';
import Permissions from '../util/Permissions.js';
import Util from '../util/Util.js';
import type { Snowflake } from '../types/index.js';
import type { Client } from '../client/Client.js';
import type { Guild } from './Guild.js';
import type { GuildMember } from './GuildMember.js';
import type { Role } from './Role.js';
import type { CategoryChannel } from './CategoryChannel.js';
import type { Collection } from '@discordjs/collection';
import type PermissionOverwrites from './PermissionOverwrites.js';

export interface ChannelData {
  name?: string;
  type?: number | string;
  position?: number;
  topic?: string | null;
  nsfw?: boolean;
  bitrate?: number;
  userLimit?: number;
  parent?: Snowflake | CategoryChannel | null;
  lockPermissions?: boolean;
  permissionOverwrites?: (PermissionOverwrites | Record<string, unknown> | unknown)[];
  rateLimitPerUser?: number;
  reason?: string;
  [key: string]: unknown;
}

export interface SetParentOptions {
  lockPermissions?: boolean;
  reason?: string;
}

export interface SetChannelPositionOptions {
  relative?: boolean;
  reason?: string;
}

export interface OverwritesFor {
  everyone?: PermissionOverwrites;
  roles: PermissionOverwrites[];
  member?: PermissionOverwrites;
}

export abstract class GuildChannel extends Channel {
  public guild: Guild;
  public guildId: Snowflake;
  public _parentId: Snowflake | null = null;
  public get parentId(): Snowflake | null {
    return this._parentId;
  }
  public set parentId(val: Snowflake | null) {
    this._parentId = val;
  }
  public permissionOverwrites: PermissionOverwriteManager;
  public name!: string;
  public rawPosition!: number;

  public constructor(guild: Guild, data: APIChannelData, client?: Client, immediatePatch: boolean = true) {
    super(guild?.client ?? client!, data, false);

    this.guild = guild;
    this.guildId = guild?.id ?? data.guild_id!;
    this.permissionOverwrites = new PermissionOverwriteManager(this);

    if (data && immediatePatch) this._patch(data);
  }

  public override _patch(data: APIChannelData): this {
    super._patch(data);

    if ('name' in data && data.name != null) {
      this.name = String(data.name);
    }

    if ('position' in data && data.position != null) {
      this.rawPosition = Number(data.position);
    }

    if ('guild_id' in data && data.guild_id) {
      this.guildId = data.guild_id;
    }

    if ('parent_id' in data) {
      this.parentId = (data.parent_id as Snowflake) ?? null;
    }

    if ('permission_overwrites' in data && Array.isArray(data.permission_overwrites)) {
      this.permissionOverwrites.cache.clear();
      for (const overwrite of data.permission_overwrites) {
        (this.permissionOverwrites as unknown as { _add(o: unknown): unknown })._add(overwrite);
      }
    }

    return this;
  }

  public override _clone(): this {
    const clone = super._clone();
    clone.permissionOverwrites = new PermissionOverwriteManager(clone, this.permissionOverwrites.cache.values());
    return clone;
  }

  public get parent(): CategoryChannel | null {
    if (!this.parentId) return null;
    return (this.guild.channels as unknown as { resolve(id: Snowflake): CategoryChannel | null }).resolve(
      this.parentId,
    );
  }

  public get permissionsLocked(): boolean | null {
    if (!this.parent) return null;

    const overwriteIds = new Set([
      ...this.permissionOverwrites.cache.keys(),
      ...this.parent.permissionOverwrites.cache.keys(),
    ]);

    return [...overwriteIds].every(key => {
      const channelVal = this.permissionOverwrites.cache.get(key);
      const parentVal = this.parent!.permissionOverwrites.cache.get(key);

      if (
        (!channelVal &&
          parentVal &&
          parentVal.deny.bitfield === Permissions.defaultBit &&
          parentVal.allow.bitfield === Permissions.defaultBit) ||
        (!parentVal &&
          channelVal &&
          channelVal.deny.bitfield === Permissions.defaultBit &&
          channelVal.allow.bitfield === Permissions.defaultBit)
      ) {
        return true;
      }

      return (
        typeof channelVal !== 'undefined' &&
        typeof parentVal !== 'undefined' &&
        channelVal.deny.bitfield === parentVal.deny.bitfield &&
        channelVal.allow.bitfield === parentVal.allow.bitfield
      );
    });
  }

  public get position(): number {
    const selfIsCategory = this.type === 'GUILD_CATEGORY';
    const types = Util.getSortableGroupTypes(this.type);

    let count = 0;
    for (const channel of this.guild.channels.cache.values()) {
      if (!types.includes(channel.type)) continue;
      if (!selfIsCategory && (channel as GuildChannel).parentId !== this.parentId) continue;
      if (this.rawPosition === (channel as GuildChannel).rawPosition) {
        if (BigInt(channel.id) < BigInt(this.id)) count++;
      } else if (this.rawPosition > (channel as GuildChannel).rawPosition) {
        count++;
      }
    }

    return count;
  }

  public permissionsFor(memberOrRole: GuildMember | Role | Snowflake, checkAdmin: boolean = true): Readonly<Permissions> | null {
    const member = this.guild.members.resolve(memberOrRole as Snowflake);
    if (member) return this.memberPermissions(member, checkAdmin);
    const role = this.guild.roles.resolve(memberOrRole as Snowflake);
    return role ? this.rolePermissions(role, checkAdmin) : null;
  }

  public overwritesFor(
    member: GuildMember | Snowflake,
    verified: boolean = false,
    roles: Collection<Snowflake, Role> | null = null,
  ): OverwritesFor {
    const resolvedMember = verified ? (member as GuildMember) : this.guild.members.resolve(member as Snowflake);
    if (!resolvedMember) return { roles: [] };

    const memberRoles = roles ?? (resolvedMember.roles.cache as Collection<Snowflake, Role>);
    const roleOverwrites: PermissionOverwrites[] = [];
    let memberOverwrites: PermissionOverwrites | undefined;
    let everyoneOverwrites: PermissionOverwrites | undefined;

    for (const overwrite of this.permissionOverwrites.cache.values()) {
      if (overwrite.id === this.guild.id) {
        everyoneOverwrites = overwrite;
      } else if (memberRoles.has(overwrite.id)) {
        roleOverwrites.push(overwrite);
      } else if (overwrite.id === resolvedMember.id) {
        memberOverwrites = overwrite;
      }
    }

    return {
      everyone: everyoneOverwrites,
      roles: roleOverwrites,
      member: memberOverwrites,
    };
  }

  private memberPermissions(member: GuildMember, checkAdmin: boolean): Readonly<Permissions> {
    if (checkAdmin && member.id === this.guild.ownerId) return new Permissions(Permissions.ALL).freeze();

    const roles = member.roles.cache as Collection<Snowflake, Role>;
    const permissions = new Permissions(roles.map(role => role.permissions));

    if (checkAdmin && permissions.has(Permissions.FLAGS.ADMINISTRATOR)) {
      return new Permissions(Permissions.ALL).freeze();
    }

    const overwrites = this.overwritesFor(member, true, roles);

    return permissions
      .remove(overwrites.everyone?.deny ?? Permissions.defaultBit)
      .add(overwrites.everyone?.allow ?? Permissions.defaultBit)
      .remove(overwrites.roles.length > 0 ? overwrites.roles.map(role => role.deny) : Permissions.defaultBit)
      .add(overwrites.roles.length > 0 ? overwrites.roles.map(role => role.allow) : Permissions.defaultBit)
      .remove(overwrites.member?.deny ?? Permissions.defaultBit)
      .add(overwrites.member?.allow ?? Permissions.defaultBit)
      .freeze();
  }

  public rolePermissions(role: Role, checkAdmin: boolean): Readonly<Permissions> {
    if (checkAdmin && role.permissions.has(Permissions.FLAGS.ADMINISTRATOR)) {
      return new Permissions(Permissions.ALL).freeze();
    }

    const basePermissions = new Permissions([role.permissions, role.guild.roles.everyone?.permissions ?? 0n]);
    const everyoneOverwrites = this.permissionOverwrites.cache.get(this.guild.id);
    const roleOverwrites = this.permissionOverwrites.cache.get(role.id);

    return basePermissions
      .remove(everyoneOverwrites?.deny ?? Permissions.defaultBit)
      .add(everyoneOverwrites?.allow ?? Permissions.defaultBit)
      .remove(roleOverwrites?.deny ?? Permissions.defaultBit)
      .add(roleOverwrites?.allow ?? Permissions.defaultBit)
      .freeze();
  }

  public async lockPermissions(): Promise<this> {
    if (!this.parent) throw new DjsError('GUILD_CHANNEL_ORPHAN');
    const permissionOverwrites = this.parent.permissionOverwrites.cache.map((overwrite: PermissionOverwrites) => overwrite.toJSON());
    return this.edit({ permissionOverwrites });
  }

  public get members(): Collection<Snowflake, GuildMember> {
    return this.guild.members.cache.filter((m: GuildMember) => (this.permissionsFor(m)?.has(Permissions.FLAGS.VIEW_CHANNEL, false) ?? false));
  }

  public edit(data: ChannelData, reason?: string): Promise<this> {
    return (this.guild.channels as unknown as { edit(ch: GuildChannel, d: ChannelData, r?: string): Promise<GuildChannel> }).edit(
      this,
      data,
      reason,
    ) as Promise<this>;
  }

  public setName(name: string, reason?: string): Promise<this> {
    return this.edit({ name }, reason);
  }

  public setParent(channel: CategoryChannel | Snowflake | null, { lockPermissions = true, reason }: SetParentOptions = {}): Promise<this> {
    return this.edit(
      {
        parent: channel ?? null,
        lockPermissions,
      },
      reason,
    );
  }

  public setPosition(position: number, options: SetChannelPositionOptions = {}): Promise<this> {
    return (this.guild.channels as unknown as { setPosition(ch: GuildChannel, pos: number, opts: SetChannelPositionOptions): Promise<GuildChannel> }).setPosition(
      this,
      position,
      options,
    ) as Promise<this>;
  }

  public clone(options: Record<string, unknown> = {}): Promise<GuildChannel> {
    return (this.guild.channels as unknown as { create(name: string, opts: Record<string, unknown>): Promise<GuildChannel> }).create(
      (options.name as string) ?? this.name,
      {
        permissionOverwrites: this.permissionOverwrites.cache,
        type: this.type,
        parent: this.parent,
        position: this.rawPosition,
        reason: null,
        ...options,
      },
    );
  }

  public equals(channel: GuildChannel): boolean {
    let equal =
      Boolean(channel) &&
      this.id === channel.id &&
      this.type === channel.type &&
      this.position === channel.position &&
      this.name === channel.name;

    if (equal) {
      if (this.permissionOverwrites && channel.permissionOverwrites) {
        equal = this.permissionOverwrites.cache.equals(channel.permissionOverwrites.cache);
      } else {
        equal = !this.permissionOverwrites && !channel.permissionOverwrites;
      }
    }

    return equal;
  }

  public get deletable(): boolean {
    return (
      this.manageable &&
      (this.guild as unknown as { rulesChannelId?: Snowflake; publicUpdatesChannelId?: Snowflake }).rulesChannelId !== this.id &&
      (this.guild as unknown as { rulesChannelId?: Snowflake; publicUpdatesChannelId?: Snowflake }).publicUpdatesChannelId !== this.id
    );
  }

  public get manageable(): boolean {
    if (this.client.user?.id === this.guild.ownerId) return true;
    if (!this.client.user) return false;
    const permissions = this.permissionsFor(this.client.user.id);
    if (!permissions) return false;

    if (permissions.has(Permissions.FLAGS.ADMINISTRATOR, false)) return true;
    if ((this.guild.members.me?.communicationDisabledUntilTimestamp ?? 0) > Date.now()) return false;

    const bitfield = (VoiceBasedChannelTypes as readonly string[]).includes(this.type)
      ? Permissions.FLAGS.MANAGE_CHANNELS | Permissions.FLAGS.CONNECT
      : Permissions.FLAGS.VIEW_CHANNEL | Permissions.FLAGS.MANAGE_CHANNELS;
    return permissions.has(bitfield, false);
  }

  public get viewable(): boolean {
    if (this.client.user?.id === this.guild.ownerId) return true;
    if (!this.client.user) return false;
    const permissions = this.permissionsFor(this.client.user.id);
    if (!permissions) return false;
    return permissions.has(Permissions.FLAGS.VIEW_CHANNEL, false);
  }

  public override async delete(reason?: string): Promise<this> {
    await this.guild.channels.delete(this.id, reason);
    return this;
  }
}

export default GuildChannel;
