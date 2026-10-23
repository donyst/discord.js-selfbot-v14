import CachedManager from './CachedManager.js';
import { Error as DjsError } from '../errors/index.js';
import GuildMember from '../structures/GuildMember.js';
import User, { type APIUserData } from '../structures/User.js';
import type { Snowflake } from '../types/index.js';
import type { Client } from '../client/Client.js';
import { Message } from '../structures/Message.js';
import { ThreadMember } from '../structures/ThreadMember.js';
import type { DMChannel } from '../structures/DMChannel.js';
import type { MessagePayload, BaseMessageOptions } from '../structures/MessagePayload.js';

export type UserResolvable = User | Snowflake | Message | GuildMember | ThreadMember;

export interface BaseFetchOptions {
  cache?: boolean;
  force?: boolean;
}

export class UserManager extends CachedManager<Snowflake, User, UserResolvable> {
  public constructor(client: Client, iterable?: Iterable<APIUserData | User>) {
    super(client, User, iterable as unknown as Iterable<User>);
  }

  public dmChannel(userId: Snowflake): DMChannel | null {
    return (
      (this.client.channels.cache as unknown as {
        find(fn: (c: { type: string; recipient?: { id: Snowflake } }) => boolean): DMChannel | undefined;
      }).find(c => c.type === 'DM' && c.recipient?.id === userId) ?? null
    );
  }

  public async createDM(user: UserResolvable, { cache = true, force = false }: BaseFetchOptions = {}): Promise<DMChannel> {
    const id = this.resolveId(user);
    if (!id) throw new DjsError('INVALID_TYPE', 'user', 'UserResolvable');

    if (!force) {
      const dm = this.dmChannel(id);
      if (dm && !dm.partial) return dm;
    }

    const data = await (this.client as unknown as {
      api: { users: { '@me': { channels: { post(opts: { data: { recipients: Snowflake[] }; DiscordContext: Record<string, unknown> }): Promise<unknown> } } } };
    }).api.users['@me'].channels.post({
      data: {
        recipients: [id],
      },
      DiscordContext: {},
    });

    const dm_channel = await (this.client.channels as unknown as {
      _add(d: unknown, g: unknown, opts: { cache: boolean }): Promise<DMChannel & { sync(): void }>;
    })._add(data, null, { cache });

    dm_channel.sync?.();
    return dm_channel;
  }

  public async deleteDM(user: UserResolvable): Promise<DMChannel> {
    const id = this.resolveId(user);
    if (!id) throw new DjsError('INVALID_TYPE', 'user', 'UserResolvable');

    const dmChannel = this.dmChannel(id);
    if (!dmChannel) throw new DjsError('USER_NO_DM_CHANNEL');

    await (this.client as unknown as { api: { channels(cid: Snowflake): { delete(): Promise<unknown> } } })
      .api.channels(dmChannel.id)
      .delete();
    (this.client.channels as unknown as { _remove(id: Snowflake): void })._remove(dmChannel.id);
    return dmChannel;
  }

  public async fetch(user: UserResolvable, { cache = true, force = false }: BaseFetchOptions = {}): Promise<User> {
    const id = this.resolveId(user);
    if (!id) throw new DjsError('INVALID_TYPE', 'user', 'UserResolvable');

    if (!force) {
      const existing = this.cache.get(id);
      if (existing && !existing.partial) return existing;
    }

    const data = await (this.client as unknown as { api: { users(uid: Snowflake): { get(): Promise<APIUserData> } } })
      .api.users(id)
      .get();
    return this._add(data, cache);
  }

  public async send(user: UserResolvable, options: string | MessagePayload | BaseMessageOptions): Promise<Message> {
    const dm = await this.createDM(user);
    return (dm as unknown as { send(opts: unknown): Promise<Message> }).send(options);
  }

  public override resolve(user: User): User;
  public override resolve(user: UserResolvable): User | null;
  public override resolve(user: unknown): User | null {
    if (user instanceof GuildMember) return user.user;
    if (user instanceof ThreadMember) return user.user;
    if (user instanceof Message) return user.author;
    return super.resolve(user as UserResolvable);
  }

  public override resolveId(user: Snowflake | User): Snowflake;
  public override resolveId(user: UserResolvable): Snowflake | null;
  public override resolveId(user: unknown): Snowflake | null {
    if (user instanceof ThreadMember) return user.id;
    if (user instanceof GuildMember) return user.user.id;
    if (user instanceof Message) return user.author?.id ?? null;
    return super.resolveId(user as UserResolvable);
  }
}

export default UserManager;
