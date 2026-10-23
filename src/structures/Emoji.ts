import process from 'node:process';
import Base from './Base.js';
import SnowflakeUtil from '../util/SnowflakeUtil.js';
import type { Snowflake } from '../types/index.js';
import type { Client } from '../client/Client.js';

export const deletedEmojis = new WeakSet<Emoji>();
let deprecationEmittedForDeleted = false;

export interface APIEmojiData {
  id?: Snowflake | null;
  name?: string | null;
  animated?: boolean | null;
  [key: string]: unknown;
}

export type RawEmoji = APIEmojiData;

/**
 * Represents an emoji, see {@link GuildEmoji} and {@link ReactionEmoji}.
 */
export class Emoji extends Base<Snowflake | null> {
  public animated: boolean | null = null;
  public name: string | null = null;
  public override id: Snowflake | null = null;

  public constructor(client: Client | unknown, emoji: APIEmojiData) {
    super(client as Client);

    this.animated = emoji.animated ?? null;
    this.name = emoji.name ?? null;
    this.id = emoji.id ?? null;
  }

  public get deleted(): boolean {
    if (!deprecationEmittedForDeleted) {
      deprecationEmittedForDeleted = true;
      process.emitWarning(
        'Emoji#deleted is deprecated, see https://github.com/discordjs/discord.js/issues/7091.',
        'DeprecationWarning',
      );
    }
    return deletedEmojis.has(this);
  }

  public set deleted(value: boolean) {
    if (!deprecationEmittedForDeleted) {
      deprecationEmittedForDeleted = true;
      process.emitWarning(
        'Emoji#deleted is deprecated, see https://github.com/discordjs/discord.js/issues/7091.',
        'DeprecationWarning',
      );
    }

    if (value) deletedEmojis.add(this);
    else deletedEmojis.delete(this);
  }

  public get identifier(): string {
    if (this.id) return `${this.animated ? 'a:' : ''}${this.name}:${this.id}`;
    return encodeURIComponent(this.name ?? '');
  }

  public get url(): string | null {
    return this.id
      ? (this.client as unknown as { rest: { cdn: { Emoji(id: Snowflake, format: string): string } } }).rest.cdn.Emoji(
          this.id,
          this.animated ? 'gif' : 'png',
        )
      : null;
  }

  public get createdTimestamp(): number | null {
    return this.id ? SnowflakeUtil.timestampFrom(this.id) : null;
  }

  public get createdAt(): Date | null {
    return this.createdTimestamp ? new Date(this.createdTimestamp) : null;
  }

  public override toString(): string {
    return this.id ? `<${this.animated ? 'a' : ''}:${this.name}:${this.id}>` : (this.name ?? '');
  }

  public override toJSON(): unknown {
    return super.toJSON({
      guild: 'guildId',
      createdTimestamp: true,
      url: true,
      identifier: true,
    });
  }
}

export default Emoji;
