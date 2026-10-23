import process from 'node:process';
import Base from './Base.js';
import ChannelFlags from '../util/ChannelFlags.js';
import { ChannelTypes, ThreadChannelTypes, VoiceBasedChannelTypes } from '../util/Constants.js';
import SnowflakeUtil from '../util/SnowflakeUtil.js';
import type { Snowflake } from '../types/index.js';
import type { Client } from '../client/Client.js';
import type { Guild } from './Guild.js';

export type ChannelCreator = (
  client: Client,
  data: APIChannelData,
  guild?: Guild | null,
  options?: { allowUnknownGuild?: boolean },
) => Channel | null;

let channelCreator: ChannelCreator | null = null;

export function setChannelCreator(creator: ChannelCreator): void {
  channelCreator = creator;
}

export type ChannelType = keyof typeof ChannelTypes;

export const deletedChannels = new WeakSet<Channel>();
let deprecationEmittedForDeleted = false;

export interface APIChannelData {
  id?: Snowflake;
  type?: number | ChannelType;
  flags?: number;
  guild_id?: Snowflake;
  recipients?: Record<string, unknown>[];
  [key: string]: unknown;
}

export abstract class Channel extends Base {
  public type: ChannelType | 'UNKNOWN';
  public flags: Readonly<ChannelFlags> = new ChannelFlags().freeze();

  public constructor(client: Client, data?: APIChannelData, immediatePatch: boolean = true) {
    super(client);

    const rawType = data?.type;
    const typeStr =
      typeof rawType === 'number'
        ? (ChannelTypes as Record<number, ChannelType>)[rawType]
        : (rawType as ChannelType | undefined);

    this.type = typeStr ?? 'UNKNOWN';

    if (data && immediatePatch) this._patch(data);
  }

  public override _patch(data: APIChannelData): this {
    if (data.id) this.id = data.id;

    if ('flags' in data && data.flags != null) {
      this.flags = new ChannelFlags(data.flags).freeze();
    } else {
      this.flags ??= new ChannelFlags().freeze();
    }

    return this;
  }

  public get createdTimestamp(): number | null {
    return this.id ? SnowflakeUtil.timestampFrom(this.id) : null;
  }

  public get createdAt(): Date | null {
    return this.createdTimestamp ? new Date(this.createdTimestamp) : null;
  }

  public get deleted(): boolean {
    if (!deprecationEmittedForDeleted) {
      deprecationEmittedForDeleted = true;
      process.emitWarning(
        'Channel#deleted is deprecated, see https://github.com/discordjs/discord.js/issues/7091.',
        'DeprecationWarning',
      );
    }
    return deletedChannels.has(this);
  }

  public set deleted(value: boolean) {
    if (!deprecationEmittedForDeleted) {
      deprecationEmittedForDeleted = true;
      process.emitWarning(
        'Channel#deleted is deprecated, see https://github.com/discordjs/discord.js/issues/7091.',
        'DeprecationWarning',
      );
    }
    if (value) deletedChannels.add(this);
    else deletedChannels.delete(this);
  }

  public get partial(): boolean {
    return false;
  }

  public override toString(): string {
    return `<#${this.id}>`;
  }

  public async delete(): Promise<this> {
    await (this.client as unknown as { api: { channels(id: Snowflake): { delete(): Promise<unknown> } } })
      .api.channels(this.id)
      .delete();
    return this;
  }

  public fetch(force = true): Promise<Channel> {
    return (this.client.channels as unknown as { fetch(id: Snowflake, opts: { force: boolean }): Promise<Channel> }).fetch(
      this.id,
      { force },
    );
  }

  public isText(): boolean {
    return 'messages' in this;
  }

  public isVoice(): boolean {
    return (VoiceBasedChannelTypes as readonly string[]).includes(this.type);
  }

  public isThread(): boolean {
    return (ThreadChannelTypes as readonly string[]).includes(this.type);
  }

  public isThreadOnly(): boolean {
    return 'availableTags' in this;
  }

  public isDirectory(): boolean {
    return this.type === 'GUILD_DIRECTORY';
  }

  public static create(
    client: Client,
    data: APIChannelData,
    guild?: Guild | null,
    options?: { allowUnknownGuild?: boolean },
  ): Channel | null {
    if (!channelCreator) {
      throw new Error('ChannelCreator has not been initialized.');
    }
    return channelCreator(client, data, guild, options);
  }

  public override toJSON(...props: Record<string, boolean | string>[]): unknown {
    return super.toJSON({ createdTimestamp: true }, ...props);
  }
}

export default Channel;
