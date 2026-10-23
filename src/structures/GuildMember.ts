import process from 'node:process';
import { Buffer } from 'node:buffer';
import Base from './Base.js';
import VoiceState from './VoiceState.js';
import TextBasedChannel from './interfaces/TextBasedChannel.js';
import { Error as DjsError } from '../errors/index.js';
import GuildMemberRoleManager from '../managers/GuildMemberRoleManager.js';
import GuildMemberFlags from '../util/GuildMemberFlags.js';
import Permissions from '../util/Permissions.js';
import type { Snowflake } from '../types/index.js';
import type { Client } from '../client/Client.js';
import type { Guild } from './Guild.js';
import type { User, APIUserData, ImageURLOptions, AvatarDecorationData } from './User.js';
import type { DMChannel } from './DMChannel.js';
import type { Presence } from './Presence.js';
import type { GuildChannel } from './GuildChannel.js';

export const deletedGuildMembers = new WeakSet<GuildMember>();
let deprecationEmittedForDeleted = false;

export interface APIGuildMemberData {
  user?: APIUserData;
  nick?: string | null;
  avatar?: string | null;
  banner?: string | null;
  joined_at?: string;
  premium_since?: string | null;
  roles?: Snowflake[];
  pending?: boolean;
  communication_disabled_until?: string | null;
  flags?: number;
  avatar_decoration_data?: {
    asset: string;
    sku_id: Snowflake;
  } | null;
  [key: string]: unknown;
}

export interface GuildMemberEditData {
  nick?: string | null;
  roles?: (Snowflake | { id: Snowflake })[];
  mute?: boolean;
  deaf?: boolean;
  channel?: Snowflake | null;
  communicationDisabledUntil?: Date | number | null;
  flags?: number;
  avatar?: unknown;
  banner?: unknown;
  bio?: string | null;
  [key: string]: unknown;
}

export interface BanOptions {
  deleteMessageSeconds?: number;
  deleteMessageDays?: number;
  reason?: string;
}

export interface GuildMember extends Base, TextBasedChannel {}

export class GuildMember extends Base {
  public guild: Guild;
  public joinedTimestamp: number | null = null;
  public premiumSinceTimestamp: number | null = null;
  public nickname: string | null = null;
  public pending: boolean = false;
  public communicationDisabledUntilTimestamp: number | null = null;
  public _roles: Snowflake[] = [];
  public user!: User;
  public avatar: string | null = null;
  public banner: string | null = null;
  public flags: Readonly<GuildMemberFlags> = new GuildMemberFlags().freeze();
  public avatarDecorationData: AvatarDecorationData | null = null;

  public constructor(client: Client, data: APIGuildMemberData, guild: Guild) {
    super(client);
    this.guild = guild;
    if (data) this._patch(data);
  }

  public override _patch(data: APIGuildMemberData): this {
    if ('user' in data && data.user) {
      this.user = (this.client.users as unknown as { _add(u: unknown, cache: boolean): User })._add(data.user, true);
      this.id = this.user.id;
    }

    if ('nick' in data) this.nickname = data.nick ?? null;
    if ('avatar' in data) {
      this.avatar = data.avatar ?? null;
    } else if (typeof this.avatar !== 'string') {
      this.avatar = null;
    }

    if ('banner' in data) {
      this.banner = data.banner ?? null;
    } else {
      this.banner ??= null;
    }

    if ('joined_at' in data && data.joined_at) this.joinedTimestamp = new Date(data.joined_at).getTime();
    if ('premium_since' in data) {
      this.premiumSinceTimestamp = data.premium_since ? new Date(data.premium_since).getTime() : null;
    }
    if ('roles' in data && data.roles) this._roles = data.roles;
    this.pending = data.pending ?? false;

    if ('communication_disabled_until' in data) {
      this.communicationDisabledUntilTimestamp = data.communication_disabled_until
        ? Date.parse(data.communication_disabled_until)
        : null;
    }

    if ('flags' in data && data.flags != null) {
      this.flags = new GuildMemberFlags(data.flags).freeze();
    } else {
      this.flags ??= new GuildMemberFlags().freeze();
    }

    if (data.avatar_decoration_data) {
      this.avatarDecorationData = {
        asset: data.avatar_decoration_data.asset,
        skuId: data.avatar_decoration_data.sku_id,
      };
    } else {
      this.avatarDecorationData = null;
    }

    return this;
  }

  public override _clone(): this {
    const clone = super._clone();
    clone._roles = this._roles.slice();
    return clone;
  }

  public get deleted(): boolean {
    if (!deprecationEmittedForDeleted) {
      deprecationEmittedForDeleted = true;
      process.emitWarning(
        'GuildMember#deleted is deprecated, see https://github.com/discordjs/discord.js/issues/7091.',
        'DeprecationWarning',
      );
    }
    return deletedGuildMembers.has(this);
  }

  public set deleted(value: boolean) {
    if (!deprecationEmittedForDeleted) {
      deprecationEmittedForDeleted = true;
      process.emitWarning(
        'GuildMember#deleted is deprecated, see https://github.com/discordjs/discord.js/issues/7091.',
        'DeprecationWarning',
      );
    }
    if (value) deletedGuildMembers.add(this);
    else deletedGuildMembers.delete(this);
  }

  public get partial(): boolean {
    return this.joinedTimestamp === null;
  }

  public get roles(): GuildMemberRoleManager {
    return new GuildMemberRoleManager(this);
  }

  public get voice(): VoiceState {
    return (
      (this.guild.voiceStates.cache as unknown as { get(id: Snowflake): VoiceState | undefined }).get(this.id) ??
      new VoiceState(this.guild, { user_id: this.id } as unknown as import('./VoiceState.js').RawVoiceStateData)
    );
  }

  public avatarDecorationURL(): string | null {
    if (!this.avatarDecorationData) return null;
    return (this.client.rest as unknown as { cdn: { AvatarDecoration(asset: string): string } }).cdn.AvatarDecoration(
      this.avatarDecorationData.asset,
    );
  }

  public avatarURL({ format, size, dynamic }: ImageURLOptions = {}): string | null {
    if (!this.avatar) return null;
    return (this.client.rest as unknown as { cdn: { GuildMemberAvatar(guildId: Snowflake, id: Snowflake, avatar: string, format?: string, size?: number, dynamic?: boolean): string } }).cdn.GuildMemberAvatar(
      this.guild.id,
      this.id,
      this.avatar,
      format,
      size,
      dynamic,
    );
  }

  public bannerURL({ format, size, dynamic }: ImageURLOptions = {}): string | null {
    if (!this.banner) return null;
    return (this.client.rest as unknown as { cdn: { GuildMemberBanner(guildId: Snowflake, id: Snowflake, banner: string, format?: string, size?: number, dynamic?: boolean): string } }).cdn.GuildMemberBanner(
      this.guild.id,
      this.id,
      this.banner,
      format,
      size,
      dynamic,
    );
  }

  public displayAvatarDecorationURL(): string | null {
    return this.avatarDecorationURL() ?? this.user.avatarDecorationURL();
  }

  public displayAvatarURL(options?: ImageURLOptions): string {
    return this.avatarURL(options) ?? this.user.displayAvatarURL(options);
  }

  public displayBannerURL(options?: ImageURLOptions): string | null {
    return this.bannerURL(options) ?? this.user.bannerURL(options);
  }

  public get joinedAt(): Date | null {
    return this.joinedTimestamp ? new Date(this.joinedTimestamp) : null;
  }

  public get communicationDisabledUntil(): Date | null {
    return this.communicationDisabledUntilTimestamp ? new Date(this.communicationDisabledUntilTimestamp) : null;
  }

  public get premiumSince(): Date | null {
    return this.premiumSinceTimestamp ? new Date(this.premiumSinceTimestamp) : null;
  }

  public get presence(): Presence | null {
    return (this.guild.presences.cache as unknown as { get(id: Snowflake): Presence | undefined }).get(this.id) ?? null;
  }

  public get displayColor(): number {
    return this.roles.color?.colors.primaryColor ?? 0;
  }

  public get displayHexColor(): string {
    return this.roles.color?.hexColor ?? '#000000';
  }

  public get displayName(): string {
    return this.nickname ?? this.user.displayName ?? this.user.username ?? '';
  }

  public get permissions(): Readonly<Permissions> {
    if (this.user.id === this.guild.ownerId) return new Permissions(Permissions.ALL).freeze();
    return new Permissions(this.roles.cache.map(role => role.permissions)).freeze();
  }

  public get manageable(): boolean {
    if (this.user.id === this.guild.ownerId) return false;
    if (this.user.id === this.client.user?.id) return false;
    if (this.client.user?.id === this.guild.ownerId) return true;
    if (!this.guild.members.me) throw new DjsError('GUILD_UNCACHED_ME');
    return this.guild.members.me.roles.highest.comparePositionTo(this.roles.highest) > 0;
  }

  public get kickable(): boolean {
    return this.manageable && (this.guild.members.me?.permissions.has(Permissions.FLAGS.KICK_MEMBERS) ?? false);
  }

  public get bannable(): boolean {
    return this.manageable && (this.guild.members.me?.permissions.has(Permissions.FLAGS.BAN_MEMBERS) ?? false);
  }

  public get moderatable(): boolean {
    return (
      !this.permissions.has(Permissions.FLAGS.ADMINISTRATOR) &&
      this.manageable &&
      (this.guild.members.me?.permissions.has(Permissions.FLAGS.MODERATE_MEMBERS) ?? false)
    );
  }

  public isCommunicationDisabled(): boolean {
    return (this.communicationDisabledUntilTimestamp ?? 0) > Date.now();
  }

  public permissionsIn(channel: GuildChannel | Snowflake): Readonly<Permissions> {
    const chan = this.guild.channels.resolve(channel as Snowflake);
    if (!chan) throw new DjsError('GUILD_CHANNEL_RESOLVE');
    return chan.permissionsFor(this) ?? new Permissions(0n).freeze();
  }

  public edit(data: import('../managers/GuildMemberManager.js').GuildMemberEditData, reason?: string): Promise<GuildMember> {
    return this.guild.members.edit(this, data, reason);
  }

  public setNickname(nick: string | null, reason?: string): Promise<GuildMember> {
    return this.edit({ nick }, reason);
  }

  public setFlags(flags: number, reason?: string): Promise<GuildMember> {
    return this.edit({ flags }, reason);
  }

  public createDM(force = false): Promise<DMChannel> {
    return this.user.createDM(force);
  }

  public deleteDM(): Promise<DMChannel> {
    return this.user.deleteDM();
  }

  public kick(reason?: string): Promise<GuildMember> {
    return this.guild.members.kick(this, reason) as Promise<GuildMember>;
  }

  public ban(options?: BanOptions): Promise<GuildMember> {
    return this.guild.bans.create(this, options) as Promise<GuildMember>;
  }

  public disableCommunicationUntil(communicationDisabledUntil: Date | number | null, reason?: string): Promise<GuildMember> {
    return this.edit({ communicationDisabledUntil }, reason);
  }

  public timeout(timeout: number | null, reason?: string): Promise<GuildMember> {
    return this.disableCommunicationUntil(timeout ? Date.now() + timeout : null, reason);
  }

  public fetch(force = true): Promise<GuildMember> {
    return this.guild.members.fetch({ user: this.id, cache: true, force });
  }

  public equals(member: GuildMember): boolean {
    return (
      member instanceof (this.constructor as typeof GuildMember) &&
      this.id === member.id &&
      this.partial === member.partial &&
      this.guild.id === member.guild.id &&
      this.joinedTimestamp === member.joinedTimestamp &&
      this.nickname === member.nickname &&
      this.avatar === member.avatar &&
      this.banner === member.banner &&
      this.pending === member.pending &&
      this.communicationDisabledUntilTimestamp === member.communicationDisabledUntilTimestamp &&
      this.flags.equals(member.flags) &&
      (this._roles === member._roles ||
        (this._roles.length === member._roles.length && this._roles.every((role, i) => role === member._roles[i]))) &&
      this.avatarDecorationData?.asset === member.avatarDecorationData?.asset &&
      this.avatarDecorationData?.skuId === member.avatarDecorationData?.skuId
    );
  }

  public override toString(): string {
    return `<@${this.nickname ? '!' : ''}${this.user.id}>`;
  }

  public override toJSON(): unknown {
    const json = super.toJSON({
      guild: 'guildId',
      user: 'userId',
      displayName: true,
      roles: true,
    }) as Record<string, unknown>;
    json.avatarURL = this.avatarURL();
    json.bannerURL = this.bannerURL();
    json.displayAvatarURL = this.displayAvatarURL();
    json.displayBannerURL = this.displayBannerURL();
    json.avatarDecorationURL = this.avatarDecorationURL();
    return json;
  }

  public setAvatar(avatar: string | Buffer | null): Promise<GuildMember> {
    return this.edit({ avatar });
  }

  public setBanner(banner: string | Buffer | null): Promise<GuildMember> {
    return this.edit({ banner });
  }

  public setAboutMe(bio: string | null = null): Promise<GuildMember> {
    return this.edit({ bio });
  }
}

TextBasedChannel.applyToClass(GuildMember);

export default GuildMember;
