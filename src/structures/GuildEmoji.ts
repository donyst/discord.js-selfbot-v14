import BaseGuildEmoji, { type BaseGuildEmojiData } from './BaseGuildEmoji.js';
import { DiscordjsError as DjsError } from '../errors/index.js';
import GuildEmojiRoleManager from '../managers/GuildEmojiRoleManager.js';
import Permissions from '../util/Permissions.js';
import type { Snowflake } from '../types/index.js';
import type { Guild } from './Guild.js';
import type { User } from './User.js';
import type { Role } from './Role.js';
import type { Client } from '../client/Client.js';
import type { RoleResolvable } from '../managers/RoleManager.js';

export interface GuildEmojiEditData {
  name?: string;
  roles?: (RoleResolvable | Role)[];
}

export interface APIGuildEmojiData extends BaseGuildEmojiData {
  user?: unknown;
  roles?: Snowflake[];
}

/**
 * Represents a custom emoji.
 */
export class GuildEmoji extends BaseGuildEmoji {
  public override guild: Guild;
  public author: User | null = null;
  public _roles: Snowflake[] = [];

  public constructor(client: Client | unknown, data: APIGuildEmojiData, guild: Guild) {
    super(client, data, guild);

    this.guild = guild;
    this.author = null;
    Object.defineProperty(this, '_roles', { value: [], writable: true });

    this._patch(data);
  }

  public override _clone(): this {
    const clone = super._clone();
    clone._roles = this._roles.slice();
    return clone;
  }

  public override _patch(data: APIGuildEmojiData): this {
    super._patch(data);

    if (data.user) {
      this.author = (this.client.users as unknown as { _add(u: unknown): User })._add(data.user);
    }
    if (data.roles && Array.isArray(data.roles)) {
      this._roles = data.roles;
    }

    return this;
  }

  public get deletable(): boolean {
    if (!this.guild.members.me) throw new DjsError('GUILD_UNCACHED_ME');
    return !this.managed && this.guild.members.me.permissions.has(Permissions.FLAGS.MANAGE_EMOJIS_AND_STICKERS);
  }

  public get roles(): GuildEmojiRoleManager {
    return new GuildEmojiRoleManager(this);
  }

  public fetchAuthor(): Promise<User> {
    return (this.guild.emojis as unknown as { fetchAuthor(e: GuildEmoji): Promise<User> }).fetchAuthor(this);
  }

  public async edit(data: GuildEmojiEditData, reason?: string): Promise<this> {
    const roles = data.roles?.map(r => ((r as { id?: Snowflake }).id ?? r));
    const newData = await (this.client as unknown as {
      api: {
        guilds(gId: Snowflake): {
          emojis(eId: Snowflake): {
            patch(opts: { data: { name?: string; roles?: unknown[] }; reason?: string }): Promise<APIGuildEmojiData>;
          };
        };
      };
    }).api
      .guilds(this.guild.id)
      .emojis(this.id!)
      .patch({
        data: {
          name: data.name,
          roles,
        },
        reason,
      });

    const clone = this._clone();
    clone._patch(newData);
    return clone;
  }

  public setName(name: string, reason?: string): Promise<this> {
    return this.edit({ name }, reason);
  }

  public async delete(reason?: string): Promise<this> {
    await (this.guild.emojis as unknown as { delete(e: GuildEmoji, r?: string): Promise<void> }).delete(this, reason);
    return this;
  }

  public equals(other: GuildEmoji | APIGuildEmojiData): boolean {
    if (other instanceof GuildEmoji) {
      return (
        other.id === this.id &&
        other.name === this.name &&
        other.managed === this.managed &&
        other.available === this.available &&
        other.requiresColons === this.requiresColons &&
        other.roles.cache.size === this.roles.cache.size &&
        other.roles.cache.every(role => this.roles.cache.has(role.id))
      );
    }
    const roles = (other.roles ?? []) as Snowflake[];
    return (
      other.id === this.id &&
      other.name === this.name &&
      roles.length === this.roles.cache.size &&
      roles.every(role => this.roles.cache.has(role))
    );
  }
}

export default GuildEmoji;
