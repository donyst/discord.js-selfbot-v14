import Base from './Base.js';
import VoiceState from './VoiceState.js';
import TextBasedChannel from './interfaces/TextBasedChannel.js';
import { Error as DjsError } from '../errors/index.js';
import { RelationshipTypes } from '../util/Constants.js';
import SnowflakeUtil from '../util/SnowflakeUtil.js';
import UserFlags from '../util/UserFlags.js';
import Util from '../util/Util.js';
import type { Snowflake } from '../types/index.js';
import type { Client } from '../client/Client.js';
import type { DMChannel } from './DMChannel.js';
import type { Guild } from './Guild.js';

export interface AvatarDecorationData {
  asset: string;
  skuId: Snowflake;
}

export interface UserPrimaryGuild {
  identityGuildId?: Snowflake | null;
  identityEnabled?: boolean | null;
  tag?: string | null;
  badge?: string | null;
}

export interface NameplateData {
  skuId: Snowflake;
  asset: string;
  label: string;
  palette: unknown;
}

export interface Collectibles {
  nameplate: NameplateData | null;
}

export interface APIUserData {
  id: Snowflake;
  username?: string | null;
  global_name?: string | null;
  bot?: boolean;
  discriminator?: string | null;
  avatar?: string | null;
  banner?: string | null;
  banner_color?: string | null;
  accent_color?: number | null;
  system?: boolean;
  public_flags?: number;
  avatar_decoration_data?: {
    asset: string;
    sku_id: Snowflake;
  } | null;
  primary_guild?: {
    identity_guild_id?: Snowflake | null;
    identity_enabled?: boolean | null;
    tag?: string | null;
    badge?: string | null;
  } | null;
  collectibles?: {
    nameplate?: {
      sku_id: Snowflake;
      asset: string;
      label: string;
      palette: unknown;
    } | null;
  } | null;
  [key: string]: unknown;
}

export interface ImageURLOptions {
  format?: string;
  size?: number;
  dynamic?: boolean;
}

export interface User extends Base, TextBasedChannel {}

export class User extends Base {
  public bot: boolean | null = null;
  public system: boolean | null = null;
  public flags: UserFlags | null = null;
  public username: string | null = null;
  public globalName: string | null = null;
  public discriminator: string | null = null;
  public avatar: string | null = null;
  public banner?: string | null;
  public bannerColor?: string | null;
  public accentColor?: number | null;
  public avatarDecorationData: AvatarDecorationData | null = null;
  public primaryGuild: UserPrimaryGuild | null = null;
  public collectibles: Collectibles | null = null;

  public constructor(client: Client, data: APIUserData) {
    super(client);
    this.id = data.id;
    this._patch(data);
  }

  public override _patch(data: APIUserData): this {
    if ('username' in data) {
      this.username = data.username ?? null;
    }

    if ('global_name' in data) {
      this.globalName = data.global_name ?? null;
    }

    if ('bot' in data) {
      this.bot = Boolean(data.bot);
    } else if (!this.partial && typeof this.bot !== 'boolean') {
      this.bot = false;
    }

    if ('discriminator' in data) {
      this.discriminator = data.discriminator ?? null;
    }

    if ('avatar' in data) {
      this.avatar = data.avatar ?? null;
    }

    if ('banner' in data) {
      this.banner = data.banner ?? null;
    } else if (this.banner !== null) {
      this.banner ??= undefined;
    }

    if ('banner_color' in data) {
      this.bannerColor = data.banner_color ?? null;
    } else if (this.bannerColor !== null) {
      this.bannerColor ??= undefined;
    }

    if ('accent_color' in data) {
      this.accentColor = data.accent_color ?? null;
    } else if (this.accentColor !== null) {
      this.accentColor ??= undefined;
    }

    if ('system' in data) {
      this.system = Boolean(data.system);
    } else if (!this.partial && typeof this.system !== 'boolean') {
      this.system = false;
    }

    if ('public_flags' in data && data.public_flags != null) {
      this.flags = new UserFlags(BigInt(data.public_flags as number | string | bigint));
    }

    if (data.avatar_decoration_data) {
      this.avatarDecorationData = {
        asset: data.avatar_decoration_data.asset,
        skuId: data.avatar_decoration_data.sku_id,
      };
    } else if ('avatar_decoration_data' in data) {
      this.avatarDecorationData = null;
    }

    if ('primary_guild' in data) {
      if (data.primary_guild) {
        this.primaryGuild = {
          identityGuildId: data.primary_guild.identity_guild_id,
          identityEnabled: data.primary_guild.identity_enabled,
          tag: data.primary_guild.tag,
          badge: data.primary_guild.badge,
        };
      } else {
        this.primaryGuild = null;
      }
    }

    if (data.collectibles) {
      if (data.collectibles.nameplate) {
        this.collectibles = {
          nameplate: {
            skuId: data.collectibles.nameplate.sku_id,
            asset: data.collectibles.nameplate.asset,
            label: data.collectibles.nameplate.label,
            palette: data.collectibles.nameplate.palette,
          },
        };
      } else {
        this.collectibles = { nameplate: null };
      }
    }

    return this;
  }

  public get clan(): UserPrimaryGuild | null {
    return this.primaryGuild;
  }

  public get avatarDecoration(): string | null {
    return this.avatarDecorationData?.asset ?? null;
  }

  public get partial(): boolean {
    return typeof this.username !== 'string';
  }

  public get createdTimestamp(): number {
    return SnowflakeUtil.timestampFrom(this.id);
  }

  public get createdAt(): Date {
    return new Date(this.createdTimestamp);
  }

  public avatarURL({ format, size, dynamic }: ImageURLOptions = {}): string | null {
    if (!this.avatar) return null;
    return (this.client.rest as unknown as { cdn: { Avatar(id: Snowflake, avatar: string, format?: string, size?: number, dynamic?: boolean): string } }).cdn.Avatar(
      this.id,
      this.avatar,
      format,
      size,
      dynamic,
    );
  }

  public avatarDecorationURL(): string | null {
    if (!this.avatarDecorationData) return null;
    return (this.client.rest as unknown as { cdn: { AvatarDecoration(asset: string): string } }).cdn.AvatarDecoration(
      this.avatarDecorationData.asset,
    );
  }

  public clanBadgeURL(): string | null {
    return this.guildTagBadgeURL();
  }

  public guildTagBadgeURL(): string | null {
    if (!this.primaryGuild?.identityGuildId || !this.primaryGuild.badge) return null;
    return (this.client.rest as unknown as { cdn: { GuildTagBadge(guildId: Snowflake, badge: string): string } }).cdn.GuildTagBadge(
      this.primaryGuild.identityGuildId,
      this.primaryGuild.badge,
    );
  }

  public get defaultAvatarURL(): string {
    const index =
      this.discriminator === '0' || this.discriminator === '0000'
        ? Util.calculateUserDefaultAvatarIndex(this.id)
        : Number(this.discriminator) % 5;
    return (this.client.rest as unknown as { cdn: { DefaultAvatar(index: number): string } }).cdn.DefaultAvatar(index);
  }

  public displayAvatarURL(options?: ImageURLOptions): string {
    return this.avatarURL(options) ?? this.defaultAvatarURL;
  }

  public get hexAccentColor(): string | null {
    if (typeof this.accentColor !== 'number') return null;
    return `#${this.accentColor.toString(16).padStart(6, '0')}`;
  }

  public bannerURL({ format, size, dynamic }: ImageURLOptions = {}): string | null {
    if (typeof this.banner === 'undefined') throw new DjsError('USER_BANNER_NOT_FETCHED');
    if (!this.banner) return null;
    return (this.client.rest as unknown as { cdn: { Banner(id: Snowflake, banner: string, format?: string, size?: number, dynamic?: boolean): string } }).cdn.Banner(
      this.id,
      this.banner,
      format,
      size,
      dynamic,
    );
  }

  public get tag(): string | null {
    return typeof this.username === 'string'
      ? this.discriminator === '0' || this.discriminator === '0000'
        ? this.username
        : `${this.username}#${this.discriminator}`
      : null;
  }

  public get displayName(): string | null {
    return this.globalName ?? this.username;
  }

  public get dmChannel(): DMChannel | null {
    return (this.client.users as unknown as { dmChannel(id: Snowflake): DMChannel | null }).dmChannel(this.id);
  }

  public createDM(force = false): Promise<DMChannel> {
    return (this.client.users as unknown as { createDM(id: Snowflake, force: boolean): Promise<DMChannel> }).createDM(
      this.id,
      force,
    );
  }

  public deleteDM(): Promise<DMChannel> {
    return (this.client.users as unknown as { deleteDM(id: Snowflake): Promise<DMChannel> }).deleteDM(this.id);
  }

  public equals(user: User): boolean {
    return (
      Boolean(user) &&
      this.id === user.id &&
      this.username === user.username &&
      this.discriminator === user.discriminator &&
      this.globalName === user.globalName &&
      this.avatar === user.avatar &&
      this.flags?.bitfield === user.flags?.bitfield &&
      this.banner === user.banner &&
      this.accentColor === user.accentColor &&
      this.avatarDecorationData?.asset === user.avatarDecorationData?.asset &&
      this.avatarDecorationData?.skuId === user.avatarDecorationData?.skuId &&
      this.collectibles?.nameplate?.skuId === user.collectibles?.nameplate?.skuId &&
      this.collectibles?.nameplate?.asset === user.collectibles?.nameplate?.asset &&
      this.collectibles?.nameplate?.label === user.collectibles?.nameplate?.label &&
      this.collectibles?.nameplate?.palette === user.collectibles?.nameplate?.palette &&
      this.primaryGuild?.identityGuildId === user.primaryGuild?.identityGuildId &&
      this.primaryGuild?.identityEnabled === user.primaryGuild?.identityEnabled &&
      this.primaryGuild?.tag === user.primaryGuild?.tag &&
      this.primaryGuild?.badge === user.primaryGuild?.badge
    );
  }

  public _equals(user: APIUserData | { [key: string]: unknown }): boolean {
    return (
      Boolean(user) &&
      this.id === user.id &&
      this.username === user.username &&
      this.discriminator === user.discriminator &&
      this.avatar === user.avatar &&
      this.flags?.bitfield === BigInt(((user as APIUserData).public_flags as number | string | bigint) ?? 0) &&
      ('banner' in user ? this.banner === user.banner : true) &&
      ('accent_color' in user ? this.accentColor === user.accent_color : true)
    );
  }

  public fetch(force = true): Promise<User> {
    return (this.client.users as unknown as { fetch(id: Snowflake, opts?: { force?: boolean }): Promise<User> }).fetch(
      this.id,
      { force },
    );
  }

  public getProfile(guildId?: Snowflake): Promise<unknown> {
    return (this.client as unknown as { api: { users(id: Snowflake): { profile: { get(opts: unknown): Promise<unknown> } } } }).api
      .users(this.id)
      .profile.get({
        query: {
          with_mutual_guilds: true,
          with_mutual_friends: true,
          with_mutual_friends_count: true,
          guild_id: guildId,
        },
      });
  }

  public override toString(): string {
    return `<@${this.id}>`;
  }

  public override toJSON(...props: Record<string, boolean | string>[]): unknown {
    const json = super.toJSON(
      {
        createdTimestamp: true,
        defaultAvatarURL: true,
        hexAccentColor: true,
        tag: true,
      },
      ...props,
    ) as Record<string, unknown>;
    json.avatarURL = this.avatarURL();
    json.displayAvatarURL = this.displayAvatarURL();
    json.bannerURL = this.banner ? this.bannerURL() : this.banner;
    json.guildTagBadgeURL = this.guildTagBadgeURL();
    return json;
  }

  public async setNote(note: string | null = null): Promise<this> {
    await (this.client as unknown as { notes: { updateNote(id: Snowflake, note: string | null): Promise<unknown> } }).notes.updateNote(
      this.id,
      note,
    );
    return this;
  }

  public get note(): string | undefined {
    return (this.client as unknown as { notes: { cache: { get(id: Snowflake): string | undefined } } }).notes.cache.get(
      this.id,
    );
  }

  public get voice(): VoiceState {
    const clientVs = (this.client as unknown as { voiceStates?: { cache: { get(id: Snowflake): VoiceState | undefined } } }).voiceStates?.cache.get(this.id);
    if (clientVs) return clientVs;

    const guildsCache = (this.client.guilds as unknown as { cache?: { find(fn: (g: { voiceStates?: { cache: { get(id: Snowflake): VoiceState | undefined } } }) => boolean): { voiceStates?: { cache: { get(id: Snowflake): VoiceState | undefined } } } | undefined } })?.cache;
    const guildVs = guildsCache
      ?.find(g => Boolean(g?.voiceStates?.cache?.get(this.id)))
      ?.voiceStates?.cache?.get(this.id);

    return guildVs ?? new VoiceState({ client: this.client } as unknown as Guild, { user_id: this.id });
  }

  public sendFriendRequest(): Promise<boolean> {
    return (this.client as unknown as { relationships: { sendFriendRequest(u: User): Promise<boolean> } }).relationships.sendFriendRequest(this);
  }

  public deleteRelationship(): Promise<boolean> {
    return (this.client as unknown as { relationships: { deleteRelationship(u: User): Promise<boolean> } }).relationships.deleteRelationship(this);
  }

  public get relationship(): string {
    const relManager = (this.client as unknown as { relationships: { cache: { get(id: Snowflake): string | number | undefined } } }).relationships;
    const i = relManager.cache.get(this.id) ?? 0;
    return (RelationshipTypes as Record<number, string>)[parseInt(String(i))] ?? 'NONE';
  }

  public get friendNickname(): string | undefined {
    return (this.client as unknown as { relationships: { friendNicknames: { get(id: Snowflake): string | undefined } } }).relationships.friendNicknames.get(this.id);
  }
}

TextBasedChannel.applyToClass(User);

export default User;
