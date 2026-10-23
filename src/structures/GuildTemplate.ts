import { setTimeout, clearTimeout } from 'node:timers';
import type { Snowflake } from 'discord-api-types/v10';
import Base from './Base.js';
import { Events } from '../util/Constants.js';
import DataResolver from '../util/DataResolver.js';
import type { Client } from '../client/Client.js';
import type { Guild } from './Guild.js';
import type User from './User.js';
import type { BufferResolvable } from '../types/index.js';

export interface EditGuildTemplateOptions {
  name?: string;
  description?: string;
}

export interface RawGuildTemplateData {
  code: string;
  name?: string;
  description?: string | null;
  usage_count?: number;
  creator_id?: Snowflake;
  creator?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
  source_guild_id?: Snowflake;
  serialized_source_guild?: Record<string, unknown>;
  is_dirty?: boolean | null;
}

/**
 * Represents the template for a guild.
 * @extends {Base}
 */
export class GuildTemplate extends Base {
  public static readonly GUILD_TEMPLATES_PATTERN: RegExp =
    /discord(?:app)?\.(?:com\/template|new)\/([\w-]{2,255})/gi;

  /**
   * The unique code of this template
   */
  public code!: string;

  /**
   * The name of this template
   */
  public name!: string;

  /**
   * The description of this template
   */
  public description!: string | null;

  /**
   * The amount of times this template has been used
   */
  public usageCount!: number;

  /**
   * The id of the user that created this template
   */
  public creatorId!: Snowflake;

  /**
   * The user that created this template
   */
  public creator!: User;

  /**
   * The time when this template was created at
   */
  public createdAt!: Date;

  /**
   * The time when this template was last synced to the guild
   */
  public updatedAt!: Date;

  /**
   * The id of the guild that this template belongs to
   */
  public guildId!: Snowflake;

  /**
   * The data of the guild that this template would create
   */
  public serializedGuild!: Record<string, unknown>;

  /**
   * Whether this template has unsynced changes
   */
  public unSynced!: boolean | null;

  public constructor(client: Client, data: RawGuildTemplateData) {
    super(client);
    this._patch(data);
  }

  public _patch(data: Partial<RawGuildTemplateData>): this {
    if ('code' in data && data.code !== undefined) {
      this.code = data.code;
    }

    if ('name' in data && data.name !== undefined) {
      this.name = data.name;
    }

    if ('description' in data) {
      this.description = data.description ?? null;
    }

    if ('usage_count' in data && data.usage_count !== undefined) {
      this.usageCount = data.usage_count;
    }

    if ('creator_id' in data && data.creator_id !== undefined) {
      this.creatorId = data.creator_id;
    }

    if ('creator' in data && data.creator) {
      this.creator = (this.client as unknown as { users: { _add: (u: unknown) => User } }).users._add(data.creator);
    }

    if ('created_at' in data && data.created_at !== undefined) {
      this.createdAt = new Date(data.created_at);
    }

    if ('updated_at' in data && data.updated_at !== undefined) {
      this.updatedAt = new Date(data.updated_at);
    }

    if ('source_guild_id' in data && data.source_guild_id !== undefined) {
      this.guildId = data.source_guild_id;
    }

    if ('serialized_source_guild' in data && data.serialized_source_guild !== undefined) {
      this.serializedGuild = data.serialized_source_guild;
    }

    this.unSynced = 'is_dirty' in data ? Boolean(data.is_dirty) : null;

    return this;
  }

  /**
   * Creates a guild based on this template.
   * @param name The name of the guild
   * @param icon The icon for the guild
   */
  public async createGuild(name: string, icon?: BufferResolvable): Promise<Guild> {
    const client = this.client as unknown as {
      api: { guilds: { templates: (code: string) => { post: (opts: { data: { name: string; icon: string | null } }) => Promise<{ id: Snowflake }> } } };
      guilds: { cache: { has: (id: Snowflake) => boolean; get: (id: Snowflake) => Guild | undefined }; _add: (d: unknown) => Guild };
      off: (evt: string, fn: (g: Guild) => void) => void;
      on: (evt: string, fn: (g: Guild) => void) => void;
      decrementMaxListeners: () => void;
      incrementMaxListeners: () => void;
    };

    const resolvedIcon = icon ? await DataResolver.resolveImage(icon) : null;
    const data = await client.api.guilds.templates(this.code).post({
      data: {
        name,
        icon: resolvedIcon,
      },
    });

    if (client.guilds.cache.has(data.id)) return client.guilds.cache.get(data.id)!;

    return new Promise<Guild>(resolve => {
      let timeout: NodeJS.Timeout;

      const resolveGuild = (guild: Guild) => {
        client.off(Events.GUILD_CREATE, handleGuild);
        client.decrementMaxListeners();
        resolve(guild);
      };

      const handleGuild = (guild: Guild) => {
        if (guild.id === data.id) {
          clearTimeout(timeout);
          resolveGuild(guild);
        }
      };

      client.incrementMaxListeners();
      client.on(Events.GUILD_CREATE, handleGuild);

      timeout = setTimeout(() => resolveGuild(client.guilds._add(data)), 10_000).unref();
    });
  }

  /**
   * Updates the metadata of this template.
   * @param options Options for editing the template
   */
  public async edit({ name, description }: EditGuildTemplateOptions = {}): Promise<this> {
    const api = (this.client as unknown as { api: { guilds: (guildId: Snowflake) => { templates: (code: string) => { patch: (opts: { data: { name?: string; description?: string } }) => Promise<RawGuildTemplateData> } } } }).api;
    const data = await api.guilds(this.guildId).templates(this.code).patch({ data: { name, description } });
    return this._patch(data);
  }

  /**
   * Deletes this template.
   */
  public async delete(): Promise<this> {
    const api = (this.client as unknown as { api: { guilds: (guildId: Snowflake) => { templates: (code: string) => { delete: () => Promise<unknown> } } } }).api;
    await api.guilds(this.guildId).templates(this.code).delete();
    return this;
  }

  /**
   * Syncs this template to the current state of the guild.
   */
  public async sync(): Promise<this> {
    const api = (this.client as unknown as { api: { guilds: (guildId: Snowflake) => { templates: (code: string) => { put: () => Promise<RawGuildTemplateData> } } } }).api;
    const data = await api.guilds(this.guildId).templates(this.code).put();
    return this._patch(data);
  }

  /**
   * The timestamp of when this template was created at
   */
  public get createdTimestamp(): number {
    return this.createdAt.getTime();
  }

  /**
   * The timestamp of when this template was last synced to the guild
   */
  public get updatedTimestamp(): number {
    return this.updatedAt.getTime();
  }

  /**
   * The guild that this template belongs to
   */
  public get guild(): Guild | null {
    return (this.client as unknown as { guilds: { resolve: (id: Snowflake) => Guild | null } }).guilds.resolve(this.guildId);
  }

  /**
   * The URL of this template
   */
  public get url(): string {
    const templateBase = (this.client as unknown as { options: { http: { template: string } } }).options.http.template;
    return `${templateBase}/${this.code}`;
  }

  public override toString(): string {
    return this.code;
  }
}

export default GuildTemplate;
