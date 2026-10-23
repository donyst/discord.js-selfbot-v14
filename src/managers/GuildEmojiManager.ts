import { Collection } from '@discordjs/collection';
import { BaseGuildEmojiManager, type EmojiResolvable } from './BaseGuildEmojiManager.js';
import { DiscordjsError as DJSError, DiscordjsTypeError as DJSTypeError } from '../errors/index.js';
import DataResolver from '../util/DataResolver.js';
import Permissions from '../util/Permissions.js';
import type { Snowflake, BaseFetchOptions, BufferResolvable, RoleResolvable } from '../types/index.js';
import type { Guild } from '../structures/Guild.js';
import type { GuildEmoji, APIGuildEmojiData } from '../structures/GuildEmoji.js';
import type { User } from '../structures/User.js';
import type { Role } from '../structures/Role.js';

export interface GuildEmojiCreateOptions {
  roles?: Collection<Snowflake, Role> | RoleResolvable[];
  reason?: string;
}

export interface GuildEmojiEditData {
  name?: string;
  roles?: (RoleResolvable | Snowflake)[];
}

/**
 * Manages API methods for GuildEmojis and stores their cache.
 * @extends {BaseGuildEmojiManager}
 */
export class GuildEmojiManager extends BaseGuildEmojiManager {
  /**
   * The guild this manager belongs to
   */
  public guild: Guild;

  public constructor(guild: Guild, iterable?: Iterable<GuildEmoji>) {
    super(guild.client, iterable);
    this.guild = guild;
  }

  public override _add(data: APIGuildEmojiData, cache?: boolean): GuildEmoji {
    return super._add(data, cache, { extras: [this.guild] });
  }

  /**
   * Creates a new custom emoji in the guild.
   */
  public async create(
    attachment: BufferResolvable | unknown,
    name: string,
    { roles, reason }: GuildEmojiCreateOptions = {},
  ): Promise<GuildEmoji> {
    const resolvedAttachment = await DataResolver.resolveImage(attachment as Parameters<typeof DataResolver.resolveImage>[0]);
    if (!resolvedAttachment) throw new DJSTypeError('REQ_RESOURCE_TYPE');

    const data: { image: unknown; name: string; roles?: Snowflake[] } = {
      image: resolvedAttachment,
      name,
    };

    if (roles) {
      if (!Array.isArray(roles) && !(roles instanceof Collection)) {
        throw new DJSTypeError('INVALID_TYPE', 'options.roles', 'Array or Collection of Roles or Snowflakes', true);
      }
      data.roles = [];
      const roleList = roles instanceof Collection ? [...roles.values()] : roles;
      for (const role of roleList) {
        const resolvedRole = (this.guild.roles as unknown as { resolveId(r: unknown): Snowflake | null }).resolveId(role);
        if (!resolvedRole) throw new DJSTypeError('INVALID_ELEMENT', 'Array or Collection', 'options.roles', role);
        data.roles.push(resolvedRole);
      }
    }

    const api = this.client.api as unknown as {
      guilds(guildId: Snowflake): {
        emojis: {
          post(opts: { data: unknown; reason?: string }): Promise<APIGuildEmojiData>;
        };
      };
    };

    const emojiData = await api.guilds(this.guild.id).emojis.post({ data, reason });
    const actions = this.client.actions as unknown as {
      GuildEmojiCreate: {
        handle(guild: Guild, emoji: unknown): { emoji: GuildEmoji };
      };
    };
    return actions.GuildEmojiCreate.handle(this.guild, emojiData).emoji;
  }

  /**
   * Obtains one or more emojis from Discord, or the emoji cache if they're already available.
   */
  public fetch(id: Snowflake, options?: BaseFetchOptions): Promise<GuildEmoji>;
  public fetch(id?: undefined, options?: BaseFetchOptions): Promise<Collection<Snowflake, GuildEmoji>>;
  public async fetch(
    id?: Snowflake,
    { cache = true, force = false }: BaseFetchOptions = {},
  ): Promise<GuildEmoji | Collection<Snowflake, GuildEmoji>> {
    const api = this.client.api as unknown as {
      guilds(guildId: Snowflake): {
        emojis: {
          get(): Promise<APIGuildEmojiData[]>;
          (emojiId: Snowflake): {
            get(): Promise<APIGuildEmojiData>;
          };
        };
      };
    };

    if (id) {
      if (!force) {
        const existing = this.cache.get(id);
        if (existing) return existing;
      }
      const emoji = await api.guilds(this.guild.id).emojis(id).get();
      return this._add(emoji, cache);
    }

    const data = await api.guilds(this.guild.id).emojis.get();
    const emojis = new Collection<Snowflake, GuildEmoji>();
    for (const emoji of data) {
      if (emoji.id) {
        emojis.set(emoji.id, this._add(emoji, cache));
      }
    }
    return emojis;
  }

  /**
   * Deletes an emoji.
   */
  public async delete(emoji: EmojiResolvable, reason?: string): Promise<void> {
    const id = this.resolveId(emoji);
    if (!id) throw new DJSTypeError('INVALID_TYPE', 'emoji', 'EmojiResolvable', true);

    const api = this.client.api as unknown as {
      guilds(guildId: Snowflake): {
        emojis(emojiId: Snowflake): {
          delete(opts: { reason?: string }): Promise<void>;
        };
      };
    };

    await api.guilds(this.guild.id).emojis(id).delete({ reason });
  }

  /**
   * Edits an emoji.
   */
  public async edit(emoji: EmojiResolvable, data: GuildEmojiEditData, reason?: string): Promise<GuildEmoji> {
    const id = this.resolveId(emoji);
    if (!id) throw new DJSTypeError('INVALID_TYPE', 'emoji', 'EmojiResolvable', true);

    const rolesMgr = this.guild.roles as unknown as { resolveId(r: unknown): Snowflake | null };
    const roles = data.roles?.map(r => rolesMgr.resolveId(r));

    const api = this.client.api as unknown as {
      guilds(guildId: Snowflake): {
        emojis(emojiId: Snowflake): {
          patch(opts: { data: unknown; reason?: string }): Promise<APIGuildEmojiData>;
        };
      };
    };

    const newData = await api
      .guilds(this.guild.id)
      .emojis(id)
      .patch({
        data: {
          name: data.name,
          roles,
        },
        reason,
      });

    const existing = this.cache.get(id);
    if (existing) {
      const clone = (existing as unknown as { _clone(): GuildEmoji })._clone();
      (clone as unknown as { _patch(d: unknown): void })._patch(newData);
      return clone;
    }
    return this._add(newData);
  }

  /**
   * Fetches the author for this emoji
   */
  public async fetchAuthor(emoji: EmojiResolvable): Promise<User | null> {
    const resolvedEmoji = this.resolve(emoji);
    if (!resolvedEmoji) throw new DJSTypeError('INVALID_TYPE', 'emoji', 'EmojiResolvable', true);
    if (resolvedEmoji.managed) {
      throw new DJSError('EMOJI_MANAGED');
    }

    const me = (this.guild.members as unknown as { me?: { permissions: Permissions } }).me;
    if (!me) throw new DJSError('GUILD_UNCACHED_ME');
    if (!me.permissions.has(Permissions.FLAGS.MANAGE_EMOJIS_AND_STICKERS)) {
      throw new DJSError('MISSING_MANAGE_EMOJIS_AND_STICKERS_PERMISSION', this.guild);
    }

    const api = this.client.api as unknown as {
      guilds(guildId: Snowflake): {
        emojis(emojiId: Snowflake): {
          get(): Promise<APIGuildEmojiData>;
        };
      };
    };

    if (!resolvedEmoji.id) return null;
    const data = await api.guilds(this.guild.id).emojis(resolvedEmoji.id).get();
    (resolvedEmoji as unknown as { _patch(d: unknown): void })._patch(data);
    return resolvedEmoji.author;
  }
}

export default GuildEmojiManager;
