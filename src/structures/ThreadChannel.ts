import { Collection } from '@discordjs/collection';
import { Channel, type APIChannelData } from './Channel.js';
import TextBasedChannel from './interfaces/TextBasedChannel.js';
import { DiscordjsRangeError as DjsRangeError } from '../errors/index.js';
import MessageManager from '../managers/MessageManager.js';
import ThreadMemberManager from '../managers/ThreadMemberManager.js';
import ChannelFlags from '../util/ChannelFlags.js';
import Permissions from '../util/Permissions.js';
import Util from '../util/Util.js';
import type { Snowflake, BaseFetchOptions } from '../types/index.js';
import type { Guild } from './Guild.js';
import type { GuildMember } from './GuildMember.js';
import type { Message } from './Message.js';
import type { ThreadMember } from './ThreadMember.js';
import type { Client } from '../client/Client.js';
import type { GuildMemberResolvable } from '../managers/GuildMemberManager.js';
import type { RoleResolvable } from '../managers/RoleManager.js';

export interface APIThreadMetadata {
  locked?: boolean;
  invitable?: boolean;
  archived?: boolean;
  auto_archive_duration?: number;
  archive_timestamp?: string;
  create_timestamp?: string;
}

export interface APIThreadData extends APIChannelData {
  owner_id?: Snowflake;
  guild_id?: Snowflake;
  thread_metadata?: APIThreadMetadata;
  last_message_id?: Snowflake | null;
  last_pin_timestamp?: string | null;
  rate_limit_per_user?: number;
  message_count?: number;
  member_count?: number;
  total_message_sent?: number;
  applied_tags?: Snowflake[];
  member?: unknown;
  messages?: unknown[];
}

export interface ThreadEditData {
  name?: string;
  archived?: boolean;
  autoArchiveDuration?: number | 'MAX';
  rateLimitPerUser?: number;
  locked?: boolean;
  invitable?: boolean;
  appliedTags?: Snowflake[];
  flags?: unknown;
}

export interface ThreadChannel extends Channel, TextBasedChannel {
  guild: Guild;
}

/**
 * Represents a thread channel on Discord.
 */
export class ThreadChannel extends Channel {
  public guild: Guild;
  public ownerId: Snowflake;
  public guildId: Snowflake;
  public messages: MessageManager;
  public members: ThreadMemberManager;
  public name: string = '';
  public parentId: Snowflake | null = null;
  public locked: boolean | null = null;
  public invitable: boolean | null = null;
  public archived: boolean | null = null;
  public autoArchiveDuration: number | null = null;
  public archiveTimestamp: number | null = null;
  public _createdTimestamp: number | null = null;
  public lastMessageId: Snowflake | null = null;
  public lastPinTimestamp: number | null = null;
  public rateLimitPerUser: number | null = null;
  public messageCount: number | null = null;
  public memberCount: number | null = null;
  public totalMessageSent: number | null = null;
  public appliedTags: Snowflake[] = [];

  public constructor(guild: Guild, data: APIThreadData, client?: Client) {
    super(guild?.client ?? client, data, false);

    this.guild = guild;
    this.ownerId = data.owner_id!;
    this.guildId = guild?.id ?? data.guild_id!;
    this.messages = new MessageManager(this);
    this.members = new ThreadMemberManager(this);

    if (data) this._patch(data);
  }

  public override _patch(data: APIThreadData, partial = false): this {
    super._patch(data);

    if ('name' in data && data.name != null) {
      this.name = String(data.name);
    }

    if ('guild_id' in data && data.guild_id) {
      this.guildId = data.guild_id;
    }

    if ('parent_id' in data) {
      this.parentId = (data.parent_id as Snowflake) ?? null;
    } else {
      this.parentId ??= null;
    }

    if (data.thread_metadata) {
      this.locked = data.thread_metadata.locked ?? false;
      this.invitable = this.type === 'GUILD_PRIVATE_THREAD' ? data.thread_metadata.invitable ?? false : null;
      this.archived = data.thread_metadata.archived ?? null;
      this.autoArchiveDuration = data.thread_metadata.auto_archive_duration ?? null;
      this.archiveTimestamp = data.thread_metadata.archive_timestamp
        ? Date.parse(data.thread_metadata.archive_timestamp)
        : null;

      if (data.thread_metadata.create_timestamp) {
        this._createdTimestamp = Date.parse(data.thread_metadata.create_timestamp);
      }
    } else {
      this.locked ??= null;
      this.archived ??= null;
      this.autoArchiveDuration ??= null;
      this.archiveTimestamp ??= null;
      this.invitable ??= null;
    }

    this._createdTimestamp ??= this.type === 'GUILD_PRIVATE_THREAD' ? super.createdTimestamp : null;

    if ('last_message_id' in data) {
      this.lastMessageId = data.last_message_id ?? null;
    } else {
      this.lastMessageId ??= null;
    }

    if ('last_pin_timestamp' in data) {
      this.lastPinTimestamp = data.last_pin_timestamp ? new Date(data.last_pin_timestamp).getTime() : null;
    } else {
      this.lastPinTimestamp ??= null;
    }

    if ('rate_limit_per_user' in data || !partial) {
      this.rateLimitPerUser = data.rate_limit_per_user ?? 0;
    } else {
      this.rateLimitPerUser ??= null;
    }

    if ('message_count' in data) {
      this.messageCount = data.message_count ?? null;
    } else {
      this.messageCount ??= null;
    }

    if ('member_count' in data) {
      this.memberCount = data.member_count ?? null;
    } else {
      this.memberCount ??= null;
    }

    if ('total_message_sent' in data) {
      this.totalMessageSent = data.total_message_sent ?? null;
    } else {
      this.totalMessageSent ??= null;
    }

    if ('applied_tags' in data && Array.isArray(data.applied_tags)) {
      this.appliedTags = data.applied_tags;
    } else {
      this.appliedTags ??= [];
    }

    if (data.member && this.client.user) {
      this.members._add({ user_id: this.client.user.id, ...(data.member as Record<string, unknown>) });
    }

    if (data.messages && Array.isArray(data.messages)) {
      for (const message of data.messages) {
        (this.messages as unknown as { _add(m: unknown): void })._add(message);
      }
    }

    return this;
  }

  public override get createdTimestamp(): number | null {
    return this._createdTimestamp;
  }

  public get guildMembers(): Collection<Snowflake, GuildMember | null> {
    return this.members.cache.mapValues(member => member.guildMember);
  }

  public get archivedAt(): Date | null {
    return this.archiveTimestamp ? new Date(this.archiveTimestamp) : null;
  }

  public override get createdAt(): Date | null {
    return this.createdTimestamp ? new Date(this.createdTimestamp) : null;
  }

  public get parent(): Channel | null {
    return (this.guild.channels as unknown as { resolve(id: Snowflake | null): Channel | null }).resolve(this.parentId);
  }

  public async join(): Promise<this> {
    await this.members.add('@me');
    return this;
  }

  public async leave(): Promise<this> {
    await this.members.remove('@me');
    return this;
  }

  public permissionsFor(
    memberOrRole: GuildMemberResolvable | RoleResolvable,
    checkAdmin = true,
  ): Readonly<Permissions> | null {
    return (this.parent as unknown as { permissionsFor?(m: unknown, c?: boolean): Readonly<Permissions> | null } | null)?.permissionsFor?.(
      memberOrRole,
      checkAdmin,
    ) ?? null;
  }

  public async fetchOwner({ cache = true, force = false }: BaseFetchOptions = {}): Promise<ThreadMember | null> {
    if (!force) {
      const existing = this.members.cache.get(this.ownerId);
      if (existing) return existing;
    }
    const members = (await this.members.fetch(cache)) as Collection<Snowflake, ThreadMember>;
    return members.get(this.ownerId) ?? null;
  }

  public async fetchStarterMessage(options?: BaseFetchOptions): Promise<Message | null> {
    const channel = (this.parent as unknown as { type?: string; messages: { fetch(id: Snowflake, opts?: BaseFetchOptions): Promise<Message> } } | null);
    const target = channel?.type === 'GUILD_FORUM' ? this : channel;
    return target ? (target.messages as unknown as { fetch(id: Snowflake, opts?: BaseFetchOptions): Promise<Message> }).fetch(this.id, options) : null;
  }

  public async edit(data: ThreadEditData, reason?: string): Promise<this> {
    let autoArchiveDuration = data.autoArchiveDuration;
    if (autoArchiveDuration === 'MAX') autoArchiveDuration = Util.resolveAutoArchiveMaxLimit();

    const newData = await (this.client as unknown as {
      api: {
        channels(chId: Snowflake): {
          patch(opts: { data: Record<string, unknown>; reason?: string }): Promise<unknown>;
        };
      };
    }).api
      .channels(this.id)
      .patch({
        data: {
          name: data.name,
          archived: data.archived,
          auto_archive_duration: autoArchiveDuration,
          rate_limit_per_user: data.rateLimitPerUser,
          locked: data.locked,
          invitable: this.type === 'GUILD_PRIVATE_THREAD' ? data.invitable : undefined,
          applied_tags: data.appliedTags,
          flags: 'flags' in data ? ChannelFlags.resolve(data.flags as number | bigint | string) : undefined,
        },
        reason,
      });

    return (this.client as unknown as {
      actions: {
        ChannelUpdate: {
          handle(d: unknown): { updated: ThreadChannel };
        };
      };
    }).actions.ChannelUpdate.handle(newData).updated as this;
  }

  public setArchived(archived = true, reason?: string): Promise<this> {
    return this.edit({ archived }, reason);
  }

  public setAutoArchiveDuration(autoArchiveDuration: number | 'MAX', reason?: string): Promise<this> {
    return this.edit({ autoArchiveDuration }, reason);
  }

  public async setInvitable(invitable = true, reason?: string): Promise<this> {
    if (this.type !== 'GUILD_PRIVATE_THREAD') throw new DjsRangeError('THREAD_INVITABLE_TYPE', this.type);
    return this.edit({ invitable }, reason);
  }

  public setLocked(locked = true, reason?: string): Promise<this> {
    return this.edit({ locked }, reason);
  }

  public setName(name: string, reason?: string): Promise<this> {
    return this.edit({ name }, reason);
  }

  public setRateLimitPerUser(rateLimitPerUser: number, reason?: string): Promise<this> {
    return this.edit({ rateLimitPerUser }, reason);
  }

  public pin(reason?: string): Promise<this> {
    const currentFlags = this.flags ? new ChannelFlags(this.flags) : new ChannelFlags();
    return this.edit({ flags: currentFlags.add(ChannelFlags.FLAGS.PINNED) }, reason);
  }

  public unpin(reason?: string): Promise<this> {
    const currentFlags = this.flags ? new ChannelFlags(this.flags) : new ChannelFlags();
    return this.edit({ flags: currentFlags.remove(ChannelFlags.FLAGS.PINNED) }, reason);
  }

  public setAppliedTags(appliedTags: Snowflake[], reason?: string): Promise<this> {
    return this.edit({ appliedTags }, reason);
  }

  public get joined(): boolean {
    const clientUserId = this.client.user?.id;
    return Boolean(clientUserId && this.members.cache.has(clientUserId));
  }

  public get editable(): boolean {
    return (
      (this.ownerId === this.client.user?.id && (this.type !== 'GUILD_PRIVATE_THREAD' || this.joined)) || this.manageable
    );
  }

  public get joinable(): boolean {
    if (!this.client.user) return false;
    return (
      !this.archived &&
      !this.joined &&
      (this.permissionsFor(this.client.user.id)?.has(
        this.type === 'GUILD_PRIVATE_THREAD' ? Permissions.FLAGS.MANAGE_THREADS : Permissions.FLAGS.VIEW_CHANNEL,
        false,
      ) ?? false)
    );
  }

  public get manageable(): boolean {
    if (!this.client.user) return false;
    const permissions = this.permissionsFor(this.client.user.id);
    if (!permissions) return false;

    if (permissions.has(Permissions.FLAGS.ADMINISTRATOR, false)) return true;

    const me = this.guild.members.me;
    const commDisabled = me ? (me.communicationDisabledUntilTimestamp ?? 0) : 0;
    return commDisabled < Date.now() && permissions.has(Permissions.FLAGS.MANAGE_THREADS, false);
  }

  public get viewable(): boolean {
    if (this.client.user?.id === this.guild.ownerId) return true;
    if (!this.client.user) return false;
    const permissions = this.permissionsFor(this.client.user.id);
    if (!permissions) return false;
    return permissions.has(Permissions.FLAGS.VIEW_CHANNEL, false);
  }

  public get sendable(): boolean {
    if (!this.client.user) return false;
    const permissions = this.permissionsFor(this.client.user.id);
    if (!permissions) return false;

    if (permissions.has(Permissions.FLAGS.ADMINISTRATOR, false)) return true;

    const me = this.guild.members.me;
    const commDisabled = me ? (me.communicationDisabledUntilTimestamp ?? 0) : 0;
    return (
      !(this.archived && this.locked && !this.manageable) &&
      (this.type !== 'GUILD_PRIVATE_THREAD' || this.joined || this.manageable) &&
      permissions.has(Permissions.FLAGS.SEND_MESSAGES_IN_THREADS, false) &&
      commDisabled < Date.now()
    );
  }

  public get unarchivable(): boolean {
    return Boolean(this.archived && this.sendable && (!this.locked || this.manageable));
  }

  public isPrivate(): boolean {
    return this.type === 'GUILD_PRIVATE_THREAD';
  }

  public override async delete(reason?: string): Promise<this> {
    await this.guild.channels.delete(this.id, reason);
    return this;
  }
}

TextBasedChannel.applyToClass(ThreadChannel, true, ['fetchWebhooks', 'setRateLimitPerUser', 'setNSFW']);

export default ThreadChannel;
