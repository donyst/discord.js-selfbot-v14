import Base from './Base.js';
import IntegrationApplication, { type APIIntegrationApplicationData } from './IntegrationApplication.js';
import InviteGuild, { type InviteGuildData } from './InviteGuild.js';
import InviteStageInstance, { type APIInviteStageInstanceData } from './InviteStageInstance.js';
import { Error as DjsError } from '../errors/index.js';
import { Endpoints } from '../util/Constants.js';
import InviteFlags from '../util/InviteFlags.js';
import Permissions from '../util/Permissions.js';
import type { Snowflake } from '../types/index.js';
import type { Client } from '../client/Client.js';
import type { Guild } from './Guild.js';
import { GuildScheduledEvent, type RawGuildScheduledEventData } from './GuildScheduledEvent.js';
import type { User, APIUserData } from './User.js';
import type { Channel } from './Channel.js';

export interface APIInviteData {
  code: string;
  guild?: InviteGuildData;
  approximate_presence_count?: number;
  approximate_member_count?: number;
  temporary?: boolean;
  max_age?: number;
  uses?: number;
  max_uses?: number;
  inviter_id?: Snowflake;
  inviter?: APIUserData;
  target_user?: APIUserData;
  target_application?: APIIntegrationApplicationData;
  target_type?: number;
  type?: number;
  channel_id?: Snowflake;
  channel?: { id: Snowflake; [key: string]: unknown } | null;
  created_at?: string;
  expires_at?: string | null;
  stage_instance?: APIInviteStageInstanceData;
  guild_scheduled_event?: RawGuildScheduledEventData;
  flags?: number;
  [key: string]: unknown;
}

export interface CreateInviteOptions {
  temporary?: boolean;
  maxAge?: number;
  maxUses?: number;
  unique?: boolean;
  targetUser?: unknown;
  targetApplication?: unknown;
  targetType?: number;
  reason?: string;
}

export class Invite extends Base {
  public guild: Guild | InviteGuild | null = null;
  public code!: string;
  public presenceCount: number | null = null;
  public memberCount: number | null = null;
  public temporary: boolean | null = null;
  public maxAge: number | null = null;
  public uses: number | null = null;
  public maxUses: number | null = null;
  public inviterId: Snowflake | null = null;
  public inviter: User | null = null;
  public targetUser: User | null = null;
  public targetApplication: IntegrationApplication | null = null;
  public targetType: number | null = null;
  public type: number | null = null;
  public channelId: Snowflake | null = null;
  public channel: Channel | null = null;
  public createdTimestamp: number | null = null;
  private _expiresTimestamp: number | null = null;
  public stageInstance: InviteStageInstance | null = null;
  public guildScheduledEvent: GuildScheduledEvent | null = null;
  public flags: Readonly<InviteFlags> = new InviteFlags().freeze();

  public static INVITES_PATTERN = /discord(?:(?:app)?\.com\/invite|\.gg(?:\/invite)?)\/([\w-]{2,255})/gi;

  public constructor(client: Client, data: APIInviteData) {
    super(client);
    this._patch(data);
  }

  public override _patch(data: APIInviteData): this {
    if (data.guild) {
      const guildsCache = (this.client.guilds as unknown as { cache?: { get(id: Snowflake): Guild | undefined } })?.cache;
      this.guild =
        guildsCache?.get(data.guild.id) ??
        new InviteGuild(this.client, data.guild);
    }

    if ('code' in data) {
      this.code = data.code;
    }

    if ('approximate_presence_count' in data) {
      this.presenceCount = data.approximate_presence_count ?? null;
    } else {
      this.presenceCount ??= null;
    }

    if ('approximate_member_count' in data) {
      this.memberCount = data.approximate_member_count ?? null;
    } else {
      this.memberCount ??= null;
    }

    if ('temporary' in data) {
      this.temporary = data.temporary ?? null;
    } else {
      this.temporary ??= null;
    }

    if ('max_age' in data) {
      this.maxAge = data.max_age ?? null;
    } else {
      this.maxAge ??= null;
    }

    if ('uses' in data) {
      this.uses = data.uses ?? null;
    } else {
      this.uses ??= null;
    }

    if ('max_uses' in data) {
      this.maxUses = data.max_uses ?? null;
    } else {
      this.maxUses ??= null;
    }

    if ('inviter_id' in data) {
      this.inviterId = data.inviter_id ?? null;
      this.inviter = (this.client.users as unknown as { resolve(id: Snowflake | null): User | null }).resolve(
        data.inviter_id ?? null,
      );
    } else {
      this.inviterId ??= null;
    }

    if ('inviter' in data && data.inviter) {
      this.inviter ??= (this.client.users as unknown as { _add(u: unknown): User })._add(data.inviter);
      this.inviterId = data.inviter.id;
    } else {
      this.inviter ??= null;
    }

    if ('target_user' in data && data.target_user) {
      this.targetUser = (this.client.users as unknown as { _add(u: unknown): User })._add(data.target_user);
    } else {
      this.targetUser ??= null;
    }

    if ('target_application' in data && data.target_application) {
      this.targetApplication = new IntegrationApplication(this.client, data.target_application);
    } else {
      this.targetApplication ??= null;
    }

    if ('target_type' in data) {
      this.targetType = data.target_type ?? null;
    } else {
      this.targetType ??= null;
    }

    if ('type' in data) {
      this.type = data.type ?? null;
    } else {
      this.type ??= null;
    }

    if ('channel_id' in data && data.channel_id) {
      this.channelId = data.channel_id;
      const channelsCache = (this.client as unknown as { channels?: { cache?: { get(id: Snowflake): Channel | undefined } } }).channels?.cache;
      this.channel = channelsCache?.get(data.channel_id) ?? null;
    }

    if ('channel' in data && data.channel !== null && data.channel) {
      this.channel ??= (this.client.channels as unknown as {
        _add(d: unknown, g: unknown, opts: { cache: boolean }): Channel;
      })._add(data.channel, this.guild, { cache: false });
      this.channelId ??= data.channel.id;
    }

    if ('created_at' in data && data.created_at) {
      this.createdTimestamp = new Date(data.created_at).getTime();
    } else {
      this.createdTimestamp ??= null;
    }

    if ('expires_at' in data) {
      this._expiresTimestamp = data.expires_at ? Date.parse(data.expires_at) : null;
    } else {
      this._expiresTimestamp ??= null;
    }

    if ('stage_instance' in data && data.stage_instance && this.channel && this.guild) {
      this.stageInstance = new InviteStageInstance(
        this.client,
        data.stage_instance,
        this.channel.id,
        this.guild.id,
      );
    } else {
      this.stageInstance ??= null;
    }

    if ('guild_scheduled_event' in data && data.guild_scheduled_event) {
      this.guildScheduledEvent = new GuildScheduledEvent(this.client, data.guild_scheduled_event);
    } else {
      this.guildScheduledEvent ??= null;
    }

    if ('flags' in data && data.flags != null) {
      this.flags = new InviteFlags(data.flags).freeze();
    } else {
      this.flags ??= new InviteFlags().freeze();
    }

    return this;
  }

  public get createdAt(): Date | null {
    return this.createdTimestamp ? new Date(this.createdTimestamp) : null;
  }

  public get deletable(): boolean {
    const guild = this.guild;
    const guildsCache = (this.client.guilds as unknown as { cache?: { has(id: Snowflake): boolean } })?.cache;
    if (!guild || !guildsCache?.has(guild.id)) return false;
    const g = guild as Guild;
    if (!g.members?.me) throw new DjsError('GUILD_UNCACHED_ME');
    return (
      (this.channel as unknown as { permissionsFor(u: unknown): { has(flag: bigint, checkAdmin?: boolean): boolean } })
        ?.permissionsFor(this.client.user)
        ?.has(Permissions.FLAGS.MANAGE_CHANNELS, false) ||
      g.members.me.permissions.has(Permissions.FLAGS.MANAGE_GUILD)
    );
  }

  public get expiresTimestamp(): number | null {
    return (
      this._expiresTimestamp ??
      (this.createdTimestamp && this.maxAge ? this.createdTimestamp + this.maxAge * 1_000 : null)
    );
  }

  public get expiresAt(): Date | null {
    const { expiresTimestamp } = this;
    return expiresTimestamp ? new Date(expiresTimestamp) : null;
  }

  public get url(): string {
    const httpInvite = (this.client.options as unknown as { http?: { invite?: string } }).http?.invite;
    return Endpoints.invite(httpInvite ?? 'https://discord.gg', this.code);
  }

  public async delete(reason?: string): Promise<this> {
    await (this.client as unknown as { api: { invites: Record<string, { delete(opts: { reason?: string }): Promise<unknown> }> } })
      .api.invites[this.code].delete({ reason });
    return this;
  }

  public override toString(): string {
    return this.url;
  }

  public override toJSON(): unknown {
    return super.toJSON({
      url: true,
      expiresTimestamp: true,
      presenceCount: false,
      memberCount: false,
      uses: false,
      channel: 'channelId',
      inviter: 'inviterId',
      guild: 'guildId',
    });
  }

  public override valueOf(): string {
    return this.code;
  }
}

export default Invite;
