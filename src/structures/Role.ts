import process from 'node:process';
import Base from './Base.js';
import { Error as DjsError } from '../errors/index.js';
import Permissions, { type PermissionResolvable } from '../util/Permissions.js';
import RoleFlags from '../util/RoleFlags.js';
import SnowflakeUtil from '../util/SnowflakeUtil.js';
import type { Snowflake } from '../types/index.js';
import type { Client } from '../client/Client.js';
import type { Guild } from './Guild.js';
import type { GuildChannel } from './GuildChannel.js';
import type { GuildMember } from './GuildMember.js';
import type { Collection } from '@discordjs/collection';
import type { ColorResolvable } from '../util/Util.js';

let deprecationEmittedForComparePositions = false;
export const deletedRoles = new WeakSet<Role>();
let deprecationEmittedForDeleted = false;

export interface RoleColors {
  primaryColor: number;
  secondaryColor?: number | null;
  tertiaryColor?: number | null;
}

export type RoleColorsResolvable = RoleColors | {
  primaryColor?: ColorResolvable;
  secondaryColor?: ColorResolvable | null;
  tertiaryColor?: ColorResolvable | null;
};

export interface RoleTags {
  botId?: Snowflake;
  integrationId?: Snowflake | string;
  premiumSubscriberRole?: true;
  subscriptionListingId?: Snowflake;
  availableForPurchase?: true;
  guildConnections?: true;
}

export interface APIRoleData {
  id: Snowflake;
  name?: string;
  color?: number;
  colors?: {
    primary_color: number;
    secondary_color?: number | null;
    tertiary_color?: number | null;
  };
  hoist?: boolean;
  position?: number;
  permissions?: string | number | bigint;
  managed?: boolean;
  mentionable?: boolean;
  icon?: string | null;
  unicode_emoji?: string | null;
  tags?: {
    bot_id?: Snowflake;
    integration_id?: Snowflake | string;
    premium_subscriber?: null;
    subscription_listing_id?: Snowflake;
    available_for_purchase?: null;
    guild_connections?: null;
  } | null;
  flags?: number;
  [key: string]: unknown;
}

export interface SetRolePositionOptions {
  relative?: boolean;
  reason?: string;
}

export interface RoleData {
  name?: string;
  color?: ColorResolvable;
  colors?: RoleColorsResolvable;
  hoist?: boolean;
  position?: number;
  permissions?: PermissionResolvable;
  mentionable?: boolean;
  icon?: unknown;
  unicodeEmoji?: string | null;
}

export class Role extends Base {
  public guild: Guild;
  public icon: string | null = null;
  public unicodeEmoji: string | null = null;
  public name!: string;
  public color!: number;
  public colors: RoleColors = { primaryColor: 0, secondaryColor: null, tertiaryColor: null };
  public hoist!: boolean;
  public rawPosition!: number;
  public permissions!: Readonly<Permissions>;
  public managed!: boolean;
  public mentionable!: boolean;
  public tags: RoleTags | null = null;
  public flags: Readonly<RoleFlags> = new RoleFlags().freeze();

  public constructor(client: Client, data: APIRoleData, guild: Guild) {
    super(client);
    this.guild = guild;
    if (data) this._patch(data);
  }

  public override _patch(data: APIRoleData): this {
    this.id = data.id;

    if ('name' in data && data.name != null) {
      this.name = data.name;
    }

    if ('color' in data && data.color != null) {
      this.color = data.color;
    }

    if ('colors' in data && data.colors) {
      this.colors = {
        primaryColor: data.colors.primary_color,
        secondaryColor: data.colors.secondary_color ?? null,
        tertiaryColor: data.colors.tertiary_color ?? null,
      };
    } else if (this.color != null) {
      this.colors = { primaryColor: this.color, secondaryColor: null, tertiaryColor: null };
    }

    if ('hoist' in data && data.hoist != null) {
      this.hoist = data.hoist;
    }

    if ('position' in data && data.position != null) {
      this.rawPosition = data.position;
    }

    if ('permissions' in data && data.permissions != null) {
      this.permissions = new Permissions(BigInt(data.permissions)).freeze();
    }

    if ('managed' in data && data.managed != null) {
      this.managed = data.managed;
    }

    if ('mentionable' in data && data.mentionable != null) {
      this.mentionable = data.mentionable;
    }

    if ('icon' in data) this.icon = data.icon ?? null;
    if ('unicode_emoji' in data) this.unicodeEmoji = data.unicode_emoji ?? null;

    this.tags = data.tags ? {} : null;
    if (data.tags) {
      if ('bot_id' in data.tags && data.tags.bot_id) {
        this.tags!.botId = data.tags.bot_id;
      }
      if ('integration_id' in data.tags && data.tags.integration_id) {
        this.tags!.integrationId = data.tags.integration_id;
      }
      if ('premium_subscriber' in data.tags) {
        this.tags!.premiumSubscriberRole = true;
      }
      if ('subscription_listing_id' in data.tags && data.tags.subscription_listing_id) {
        this.tags!.subscriptionListingId = data.tags.subscription_listing_id;
      }
      if ('available_for_purchase' in data.tags) {
        this.tags!.availableForPurchase = true;
      }
      if ('guild_connections' in data.tags) {
        this.tags!.guildConnections = true;
      }
    }

    if ('flags' in data && data.flags != null) {
      this.flags = new RoleFlags(data.flags).freeze();
    }

    return this;
  }

  public get createdTimestamp(): number {
    return SnowflakeUtil.timestampFrom(this.id);
  }

  public get createdAt(): Date {
    return new Date(this.createdTimestamp);
  }

  public get deleted(): boolean {
    if (!deprecationEmittedForDeleted) {
      deprecationEmittedForDeleted = true;
      process.emitWarning(
        'Role#deleted is deprecated, see https://github.com/discordjs/discord.js/issues/7091.',
        'DeprecationWarning',
      );
    }
    return deletedRoles.has(this);
  }

  public set deleted(value: boolean) {
    if (!deprecationEmittedForDeleted) {
      deprecationEmittedForDeleted = true;
      process.emitWarning(
        'Role#deleted is deprecated, see https://github.com/discordjs/discord.js/issues/7091.',
        'DeprecationWarning',
      );
    }
    if (value) deletedRoles.add(this);
    else deletedRoles.delete(this);
  }

  public get hexColor(): string {
    return `#${this.colors.primaryColor.toString(16).padStart(6, '0')}`;
  }

  public get members(): Collection<Snowflake, GuildMember> {
    return this.guild.members.cache.filter((m: GuildMember) => (m.roles.cache as Collection<Snowflake, Role>).has(this.id));
  }

  public get editable(): boolean {
    if (this.managed) return false;
    const clientMember = this.guild.members.resolve(this.client.user!);
    if (!clientMember?.permissions.has(Permissions.FLAGS.MANAGE_ROLES)) return false;
    return clientMember.roles.highest.comparePositionTo(this) > 0;
  }

  public get position(): number {
    let count = 0;
    for (const role of this.guild.roles.cache.values()) {
      if (this.rawPosition > role.rawPosition) count++;
      else if (this.rawPosition === role.rawPosition && BigInt(this.id) < BigInt(role.id)) count++;
    }
    return count;
  }

  public comparePositionTo(role: Role | Snowflake): number {
    return this.guild.roles.comparePositions(this, role);
  }

  public edit(data: RoleData, reason?: string): Promise<Role> {
    return this.guild.roles.edit(this, data, reason);
  }

  public permissionsIn(channel: GuildChannel | Snowflake, checkAdmin: boolean = true): Readonly<Permissions> {
    const resolvedChannel = this.guild.channels.resolve(channel as Snowflake) as GuildChannel | null;
    if (!resolvedChannel) throw new DjsError('GUILD_CHANNEL_RESOLVE');
    return resolvedChannel.rolePermissions(this, checkAdmin);
  }

  public setName(name: string, reason?: string): Promise<Role> {
    return this.edit({ name }, reason);
  }

  public setColor(color: ColorResolvable, reason?: string): Promise<Role> {
    return this.edit({ color }, reason);
  }

  public setColors(colors: RoleColorsResolvable, reason?: string): Promise<Role> {
    return this.edit({ colors }, reason);
  }

  public setHoist(hoist: boolean = true, reason?: string): Promise<Role> {
    return this.edit({ hoist }, reason);
  }

  public setPermissions(permissions: PermissionResolvable, reason?: string): Promise<Role> {
    return this.edit({ permissions }, reason);
  }

  public setMentionable(mentionable: boolean = true, reason?: string): Promise<Role> {
    return this.edit({ mentionable }, reason);
  }

  public setIcon(icon: unknown, reason?: string): Promise<Role> {
    return this.edit({ icon }, reason);
  }

  public setUnicodeEmoji(unicodeEmoji: string | null, reason?: string): Promise<Role> {
    return this.edit({ unicodeEmoji }, reason);
  }

  public setPosition(position: number, options: SetRolePositionOptions = {}): Promise<Role> {
    return this.guild.roles.setPosition(this, position, options);
  }

  public async delete(reason?: string): Promise<Role> {
    await this.guild.roles.delete(this.id, reason);
    return this;
  }

  public fetchMemberIds(): Promise<Snowflake[]> {
    return this.guild.roles.fetchMemberIds(this.id);
  }

  public iconURL({ format, size }: { format?: string; size?: number } = {}): string | null {
    if (!this.icon) return null;
    return (this.client.rest as unknown as { cdn: { RoleIcon(id: Snowflake, icon: string, format?: string, size?: number): string } }).cdn.RoleIcon(
      this.id,
      this.icon,
      format,
      size,
    );
  }

  public equals(role: Role): boolean {
    return (
      Boolean(role) &&
      this.id === role.id &&
      this.name === role.name &&
      this.colors.primaryColor === role.colors.primaryColor &&
      this.colors.secondaryColor === role.colors.secondaryColor &&
      this.colors.tertiaryColor === role.colors.tertiaryColor &&
      this.hoist === role.hoist &&
      this.position === role.position &&
      this.permissions.bitfield === role.permissions.bitfield &&
      this.managed === role.managed &&
      this.icon === role.icon &&
      this.unicodeEmoji === role.unicodeEmoji
    );
  }

  public override toString(): string {
    if (this.id === this.guild.id) return '@everyone';
    return `<@&${this.id}>`;
  }

  public override toJSON(): unknown {
    return {
      ...(super.toJSON({ createdTimestamp: true }) as Record<string, unknown>),
      permissions: this.permissions.toJSON(),
    };
  }

  public static comparePositions(role1: Role, role2: Role): number {
    if (!deprecationEmittedForComparePositions) {
      process.emitWarning(
        'The Role.comparePositions method is deprecated. Use RoleManager#comparePositions instead.',
        'DeprecationWarning',
      );
      deprecationEmittedForComparePositions = true;
    }
    return role1.guild.roles.comparePositions(role1, role2);
  }
}

export default Role;
