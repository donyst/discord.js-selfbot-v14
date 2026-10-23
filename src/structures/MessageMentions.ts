import { Collection } from '@discordjs/collection';
import { ChannelTypes } from '../util/Constants.js';
import Util from '../util/Util.js';
import type { Snowflake } from '../types/index.js';
import type { Client } from '../client/Client.js';
import type { Guild } from './Guild.js';
import type { GuildMember } from './GuildMember.js';
import type { Role } from './Role.js';
import type { User } from './User.js';
import type { Channel } from './Channel.js';
import type { Message } from './Message.js';

export interface CrosspostedChannel {
  channelId: Snowflake;
  guildId: Snowflake;
  type: string;
  name: string;
}

export interface APIMentionUser {
  id: Snowflake;
  username: string;
  discriminator: string;
  avatar?: string | null;
  bot?: boolean;
  member?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface APICrosspostedChannel {
  id: Snowflake;
  guild_id: Snowflake;
  type: number;
  name: string;
}

export interface MessageMentionsHasOptions {
  ignoreDirect?: boolean;
  ignoreRoles?: boolean;
  ignoreRepliedUser?: boolean;
  ignoreEveryone?: boolean;
}

export class MessageMentions {
  public readonly client: Client;
  public readonly guild: Guild | null;
  private readonly _content: string;
  public everyone: boolean;
  public users: Collection<Snowflake, User>;
  public roles: Collection<Snowflake, Role>;
  public crosspostedChannels: Collection<Snowflake, CrosspostedChannel>;
  public repliedUser: User | null;

  private _members: Collection<Snowflake, GuildMember> | null = null;
  private _channels: Collection<Snowflake, Channel> | null = null;
  private _parsedUsers: Collection<Snowflake, User> | null = null;

  public static EVERYONE_PATTERN = /@(everyone|here)/g;
  public static USERS_PATTERN = /<@!?(\d{17,19})>/g;
  public static ROLES_PATTERN = /<@&(\d{17,19})>/g;
  public static CHANNELS_PATTERN = /<#(\d{17,19})>/g;

  public constructor(
    message: Message,
    users?: Collection<Snowflake, User> | APIMentionUser[] | null,
    roles?: Collection<Snowflake, Role> | Snowflake[] | null,
    everyone?: boolean | null,
    crosspostedChannels?: Collection<Snowflake, CrosspostedChannel> | APICrosspostedChannel[] | null,
    repliedUser?: APIMentionUser | User | null,
  ) {
    this.client = (message as unknown as { client: Client }).client;
    this.guild = (message as unknown as { guild: Guild | null }).guild;
    this._content = (message as unknown as { content: string }).content;
    this.everyone = Boolean(everyone);

    if (users) {
      if (users instanceof Collection) {
        this.users = new Collection(users);
      } else {
        this.users = new Collection();
        for (const mention of users) {
          if (mention.member && this.guild) {
            (this.guild.members as unknown as { _add(data: unknown): unknown })._add(
              Object.assign({}, mention.member, { user: mention }),
            );
          }
          const user = (this.client.users as unknown as { _add(data: unknown): User })._add(mention);
          this.users.set(user.id, user);
        }
      }
    } else {
      this.users = new Collection();
    }

    if (roles instanceof Collection) {
      this.roles = new Collection(roles);
    } else if (roles) {
      this.roles = new Collection();
      const guild = this.guild;
      if (guild) {
        for (const mention of roles) {
          const role = guild.roles.cache.get(mention);
          if (role) this.roles.set(role.id, role);
        }
      }
    } else {
      this.roles = new Collection();
    }

    if (crosspostedChannels) {
      if (crosspostedChannels instanceof Collection) {
        this.crosspostedChannels = new Collection(crosspostedChannels);
      } else {
        this.crosspostedChannels = new Collection();
        const channelTypes = Object.keys(ChannelTypes);
        for (const d of crosspostedChannels) {
          const type = (channelTypes as unknown as Record<number, string>)[d.type];
          this.crosspostedChannels.set(d.id, {
            channelId: d.id,
            guildId: d.guild_id,
            type: type ?? 'UNKNOWN',
            name: d.name,
          });
        }
      }
    } else {
      this.crosspostedChannels = new Collection();
    }

    this.repliedUser = repliedUser
      ? (this.client.users as unknown as { _add(data: unknown): User })._add(repliedUser)
      : null;
  }

  public get members(): Collection<Snowflake, GuildMember> | null {
    if (this._members) return this._members;
    if (!this.guild) return null;
    this._members = new Collection();
    this.users.forEach(user => {
      const member = this.guild!.members.resolve(user);
      if (member) this._members!.set(member.user.id, member);
    });
    return this._members;
  }

  public get channels(): Collection<Snowflake, Channel> {
    if (this._channels) return this._channels;
    this._channels = new Collection();
    let matches: RegExpExecArray | null;
    while ((matches = MessageMentions.CHANNELS_PATTERN.exec(this._content)) !== null) {
      const chan = (this.client.channels.cache as Collection<Snowflake, Channel>).get(matches[1]);
      if (chan) this._channels.set(chan.id, chan);
    }
    return this._channels;
  }

  public get parsedUsers(): Collection<Snowflake, User> {
    if (this._parsedUsers) return this._parsedUsers;
    this._parsedUsers = new Collection();
    let matches: RegExpExecArray | null;
    while ((matches = MessageMentions.USERS_PATTERN.exec(this._content)) !== null) {
      const user = (this.client.users.cache as Collection<Snowflake, User>).get(matches[1]);
      if (user) this._parsedUsers.set(user.id, user);
    }
    return this._parsedUsers;
  }

  public has(
    data: unknown,
    {
      ignoreDirect = false,
      ignoreRoles = false,
      ignoreRepliedUser = false,
      ignoreEveryone = false,
    }: MessageMentionsHasOptions = {},
  ): boolean {
    const user = (this.client.users as unknown as { resolve(d: unknown): User | null }).resolve(data);

    if (!ignoreEveryone && user && this.everyone) return true;

    const userWasRepliedTo = user && this.repliedUser?.id === user.id;

    if (!ignoreRepliedUser && userWasRepliedTo && this.users.has(user.id)) return true;

    if (!ignoreDirect) {
      if (user && (!ignoreRepliedUser || this.parsedUsers.has(user.id)) && this.users.has(user.id)) return true;

      const role = this.guild?.roles.resolve(data as Snowflake);
      if (role && this.roles.has(role.id)) return true;

      const channel = (this.client.channels as unknown as { resolve(d: unknown): Channel | null }).resolve(data);
      if (channel && this.channels.has(channel.id)) return true;
    }

    if (!ignoreRoles) {
      const member = this.guild?.members.resolve(data as Snowflake);
      if (member) {
        for (const mentionedRole of this.roles.values()) {
          if ((member.roles.cache as Collection<Snowflake, Role>).has(mentionedRole.id)) return true;
        }
      }
    }

    return false;
  }

  public toJSON(): Record<string, unknown> {
    return Util.flatten(this, {
      members: true,
      channels: true,
    }) as Record<string, unknown>;
  }
}

export default MessageMentions;
