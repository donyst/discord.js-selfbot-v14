import type { Snowflake } from 'discord-api-types/v10';
import { PartialTypes } from '../../util/Constants.js';
import type { Client } from '../Client.js';
import type { Guild } from '../../structures/Guild.js';
import type { Message } from '../../structures/Message.js';
import type { User } from '../../structures/User.js';
import type { GuildMember } from '../../structures/GuildMember.js';
import type { MessageReaction } from '../../structures/MessageReaction.js';
import type { GuildScheduledEvent } from '../../structures/GuildScheduledEvent.js';
import type { Channel } from '../../structures/Channel.js';

export interface ActionPayloadData {
  id?: Snowflake;
  channel_id?: Snowflake;
  guild_id?: Snowflake;
  message_id?: Snowflake;
  user_id?: Snowflake;
  guild_scheduled_event_id?: Snowflake;
  author?: { id: Snowflake; [key: string]: unknown };
  user?: { id: Snowflake; [key: string]: unknown };
  member?: { user?: Record<string, unknown>; [key: string]: unknown };
  emoji?: { id?: Snowflake | null; name: string };
  recipients?: unknown[];
  [key: string]: unknown;
}

export interface ActionCacheManager<T> {
  cache: {
    get(id: unknown): T | undefined;
    has(id: unknown): boolean;
  };
  _add(data: unknown, cache?: boolean): T;
}

/**
 * Generic base action class.
 */
export class GenericAction {
  public client: Client;

  public constructor(client: Client) {
    this.client = client;
  }

  public handle(...args: unknown[]): unknown {
    return args[0];
  }

  public getPayload<T>(
    data: unknown,
    manager: ActionCacheManager<T>,
    id: unknown,
    partialType: string,
    cache?: boolean,
  ): T | undefined {
    const existing = manager.cache.get(id);
    if (!existing && (this.client.options.partials as readonly string[]).includes(partialType)) {
      return manager._add(data, cache);
    }
    return existing;
  }

  public getChannel(data: ActionPayloadData): Channel | undefined {
    const payloadData: Record<string, unknown> = {};
    const id = data.channel_id ?? data.id;

    if (!('recipients' in data)) {
      const recipient = data.author ?? data.user ?? (data.user_id ? { id: data.user_id } : undefined);
      if (recipient && recipient.id !== (this.client.user as any)?.id) {
        payloadData.recipients = [recipient];
      }
    }

    if (id !== undefined) payloadData.id = id;

    return (
      (data as Record<symbol, Channel>)[(this.client.actions as any).injectedChannel] ??
      this.getPayload(
        { ...data, ...payloadData },
        this.client.channels as unknown as ActionCacheManager<Channel>,
        id,
        PartialTypes.CHANNEL,
      )
    );
  }

  public getMessage(data: ActionPayloadData, channel: { id: Snowflake; guild?: Guild | null; messages: ActionCacheManager<Message> }, cache?: boolean): Message | undefined {
    const id = data.message_id ?? data.id;
    return (
      (data as Record<symbol, Message>)[(this.client.actions as any).injectedMessage] ??
      this.getPayload(
        {
          id,
          channel_id: channel.id,
          guild_id: data.guild_id ?? channel.guild?.id,
        },
        channel.messages,
        id,
        PartialTypes.MESSAGE,
        cache,
      )
    );
  }

  public getReaction(data: { emoji: { id?: Snowflake | null; name: string } }, message: { partial?: boolean; reactions: ActionCacheManager<MessageReaction> }, user?: { id?: Snowflake }): MessageReaction | undefined {
    const id = data.emoji.id ?? decodeURIComponent(data.emoji.name);
    return this.getPayload(
      {
        emoji: data.emoji,
        count: message.partial ? null : 0,
        me: user?.id === (this.client.user as any)?.id,
      },
      message.reactions,
      id,
      PartialTypes.REACTION,
    );
  }

  public getMember(data: ActionPayloadData & { user: { id: Snowflake } }, guild: { members: ActionCacheManager<GuildMember> }): GuildMember | undefined {
    return this.getPayload(data, guild.members, data.user.id, PartialTypes.GUILD_MEMBER);
  }

  public getUser(data: ActionPayloadData): User | undefined {
    const id = data.user_id;
    return (
      (data as Record<symbol, User>)[(this.client.actions as any).injectedUser] ??
      this.getPayload({ id }, this.client.users as unknown as ActionCacheManager<User>, id, PartialTypes.USER)
    );
  }

  public getUserFromMember(data: ActionPayloadData): User | undefined {
    if (data.guild_id && data.member?.user) {
      const guild = this.client.guilds.cache.get(data.guild_id);
      if (guild) {
        return (guild.members._add(data.member) as unknown as { user: User }).user;
      }
      return this.client.users._add(data.member.user);
    }
    return this.getUser(data);
  }

  public getScheduledEvent(data: ActionPayloadData, guild: { id: Snowflake; scheduledEvents: ActionCacheManager<GuildScheduledEvent> }): GuildScheduledEvent | undefined {
    const id = data.guild_scheduled_event_id ?? data.id;
    return this.getPayload(
      { id, guild_id: data.guild_id ?? guild.id },
      guild.scheduledEvents,
      id,
      PartialTypes.GUILD_SCHEDULED_EVENT,
    );
  }
}

export default GenericAction;
