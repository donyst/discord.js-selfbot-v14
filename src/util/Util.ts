import { Agent } from 'node:http';
import { parse } from 'node:path';
import process from 'node:process';
import { Collection } from '@discordjs/collection';
import { fetch, type Response } from 'undici';
import { Colors, Events } from './Constants.js';
import { Sweepers } from './Sweepers.js';
import { DiscordjsError, DiscordjsRangeError, DiscordjsTypeError } from '../errors/index.js';
import type { Snowflake } from '../types/index.js';

let deprecationEmittedForSplitMessage = false;
let deprecationEmittedForRemoveMentions = false;
let deprecationEmittedForResolveAutoArchiveMaxLimit = false;

const TextSortableGroupTypes: readonly string[] = ['GUILD_TEXT', 'GUILD_ANNOUNCEMENT', 'GUILD_FORUM'] as const;
const VoiceSortableGroupTypes: readonly string[] = ['GUILD_VOICE', 'GUILD_STAGE_VOICE'] as const;
const CategorySortableGroupTypes: readonly string[] = ['GUILD_CATEGORY'] as const;

export interface PayloadType {
  name: string;
  type: string;
  priority: number;
  payload_type: number;
  rtx_payload_type?: number;
  encode?: boolean;
  decode?: boolean;
}

const payloadTypes: readonly PayloadType[] = [
  {
    name: 'opus',
    type: 'audio',
    priority: 1000,
    payload_type: 120,
  },
  {
    name: 'AV1',
    type: 'video',
    priority: 1000,
    payload_type: 101,
    rtx_payload_type: 102,
    encode: false,
    decode: false,
  },
  {
    name: 'H265',
    type: 'video',
    priority: 2000,
    payload_type: 103,
    rtx_payload_type: 104,
    encode: false,
    decode: false,
  },
  {
    name: 'H264',
    type: 'video',
    priority: 3000,
    payload_type: 105,
    rtx_payload_type: 106,
    encode: true,
    decode: true,
  },
  {
    name: 'VP8',
    type: 'video',
    priority: 4000,
    payload_type: 107,
    rtx_payload_type: 108,
    encode: true,
    decode: false,
  },
  {
    name: 'VP9',
    type: 'video',
    priority: 5000,
    payload_type: 109,
    rtx_payload_type: 110,
    encode: false,
    decode: false,
  },
] as const;

export interface SplitOptions {
  maxLength?: number;
  char?: string | string[] | RegExp | RegExp[];
  prepend?: string;
  append?: string;
}

export interface EscapeMarkdownOptions {
  codeBlock?: boolean;
  inlineCode?: boolean;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  spoiler?: boolean;
  codeBlockContent?: boolean;
  inlineCodeContent?: boolean;
  escape?: boolean;
  heading?: boolean;
  bulletedList?: boolean;
  numberedList?: boolean;
  maskedLink?: boolean;
}

export interface MakeErrorOptions {
  name: string;
  message: string;
  stack?: string;
}

export type ColorResolvable =
  | keyof typeof Colors
  | 'RANDOM'
  | 'DEFAULT'
  | string
  | number
  | readonly [number, number, number]
  | number[];

export interface ParsedEmoji {
  animated: boolean;
  name: string;
  id: Snowflake | null;
}

export type EmojiIdentifierResolvable =
  | Snowflake
  | string
  | {
      id?: Snowflake | null;
      name?: string | null;
      animated?: boolean | null;
    };

export interface GuildForumTag {
  id: Snowflake;
  name: string;
  moderated: boolean;
  emoji: { id: Snowflake | null; name: string | null } | null;
}

export interface APIGuildForumTag {
  id: Snowflake;
  name: string;
  moderated: boolean;
  emoji_id: Snowflake | null;
  emoji_name: string | null;
}

export interface DefaultReactionEmoji {
  id: Snowflake | null;
  name: string | null;
}

export interface APIGuildForumDefaultReactionEmoji {
  emoji_id: Snowflake | null;
  emoji_name: string | null;
}

export interface GuildScheduledEventRecurrenceRuleOptions {
  startAt: Date | number | string;
  frequency: number;
  interval: number;
  byWeekday?: number[] | null;
  byNWeekday?: { n: number; day: number }[] | null;
  byMonth?: number[] | null;
  byMonthDay?: number[] | null;
}

export interface APIGuildScheduledEventRecurrenceRule {
  start: string;
  frequency: number;
  interval: number;
  by_weekday?: number[] | null;
  by_n_weekday?: { n: number; day: number }[] | null;
  by_month?: number[] | null;
  by_month_day?: number[] | null;
}

export interface APIIncidentsData {
  invites_disabled_until?: string | null;
  dms_disabled_until?: string | null;
  dm_spam_detected_at?: string | null;
  raid_detected_at?: string | null;
}

export interface IncidentActions {
  invitesDisabledUntil: Date | null;
  dmsDisabledUntil: Date | null;
  dmSpamDetectedAt: Date | null;
  raidDetectedAt: Date | null;
}

function hasOwn(o: object, k: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(o, k);
}

function isObj(d: unknown): d is Record<string, unknown> {
  return typeof d === 'object' && d !== null;
}

/**
 * Contains various general-purpose utility methods.
 */
export class Util {
  private constructor() {}

  /**
   * Flatten an object. Any properties that are collections will get converted to an array of keys.
   */
  public static flatten(obj: unknown, ...props: Record<string, boolean | string>[]): unknown {
    if (!isObj(obj)) return obj;

    const objProps = Object.keys(obj)
      .filter(k => !k.startsWith('_'))
      .map(k => ({ [k]: true }));

    const combinedProps: Record<string, boolean | string> = objProps.length
      ? Object.assign({}, ...objProps, ...props)
      : Object.assign({}, ...props);

    const out: Record<string, unknown> = {};

    for (let [prop, newProp] of Object.entries(combinedProps)) {
      if (!newProp) continue;
      newProp = newProp === true ? prop : newProp;

      const element = obj[prop];
      const elemIsObj = isObj(element);
      const valueOf = elemIsObj && typeof (element as { valueOf?: () => unknown }).valueOf === 'function'
        ? (element as { valueOf: () => unknown }).valueOf()
        : null;
      const hasToJSON = elemIsObj && typeof (element as { toJSON?: () => unknown }).toJSON === 'function';

      if (element instanceof Collection) {
        out[newProp] = Array.from(element.keys());
      } else if (valueOf instanceof Collection) {
        out[newProp] = Array.from(valueOf.keys());
      } else if (Array.isArray(element)) {
        out[newProp] = element.map(e =>
          isObj(e) && typeof (e as { toJSON?: () => unknown }).toJSON === 'function'
            ? (e as { toJSON: () => unknown }).toJSON()
            : Util.flatten(e),
        );
      } else if (typeof valueOf !== 'object' && valueOf !== null) {
        out[newProp] = valueOf;
      } else if (hasToJSON) {
        out[newProp] = (element as { toJSON: () => unknown }).toJSON();
      } else if (typeof element === 'object' && element !== null) {
        out[newProp] = Util.flatten(element);
      } else if (!elemIsObj) {
        out[newProp] = element;
      }
    }

    return out;
  }

  /**
   * Splits a string into multiple chunks at a designated character that do not exceed a specific length.
   * @deprecated
   */
  public static splitMessage(
    text: string,
    { maxLength = 2_000, char = '\n', prepend = '', append = '' }: SplitOptions = {},
  ): string[] {
    if (!deprecationEmittedForSplitMessage) {
      process.emitWarning(
        'The Util.splitMessage method is deprecated and will be removed in the next major version.',
        'DeprecationWarning',
      );
      deprecationEmittedForSplitMessage = true;
    }

    text = Util.verifyString(text);
    if (text.length <= maxLength) return [text];
    let splitText: string[] = [text];
    if (Array.isArray(char)) {
      const charArr = [...char];
      while (charArr.length > 0 && splitText.some(elem => elem.length > maxLength)) {
        const currentChar = charArr.shift()!;
        if (currentChar instanceof RegExp) {
          splitText = splitText.flatMap(chunk => chunk.match(currentChar) ?? []);
        } else {
          splitText = splitText.flatMap(chunk => chunk.split(currentChar));
        }
      }
    } else {
      splitText = text.split(char);
    }
    if (splitText.some(elem => elem.length > maxLength)) throw new DiscordjsRangeError('SPLIT_MAX_LEN');
    const messages: string[] = [];
    let msg = '';
    for (const chunk of splitText) {
      const charStr = typeof char === 'string' ? char : '\n';
      if (msg && (msg + charStr + chunk + append).length > maxLength) {
        messages.push(msg + append);
        msg = prepend;
      }
      msg += (msg && msg !== prepend ? charStr : '') + chunk;
    }
    return messages.concat(msg).filter(m => Boolean(m));
  }

  /**
   * Escapes any Discord-flavour markdown in a string.
   */
  public static escapeMarkdown(
    text: string,
    {
      codeBlock = true,
      inlineCode = true,
      bold = true,
      italic = true,
      underline = true,
      strikethrough = true,
      spoiler = true,
      codeBlockContent = true,
      inlineCodeContent = true,
      escape = true,
      heading = false,
      bulletedList = false,
      numberedList = false,
      maskedLink = false,
    }: EscapeMarkdownOptions = {},
  ): string {
    if (!codeBlockContent) {
      return text
        .split('```')
        .map((subString, index, array) => {
          if (index % 2 && index !== array.length - 1) return subString;
          return Util.escapeMarkdown(subString, {
            inlineCode,
            bold,
            italic,
            underline,
            strikethrough,
            spoiler,
            inlineCodeContent,
            escape,
            heading,
            bulletedList,
            numberedList,
            maskedLink,
          });
        })
        .join(codeBlock ? '\\`\\`\\`' : '```');
    }
    if (!inlineCodeContent) {
      return text
        .split(/(?<=^|[^`])`(?=[^`]|$)/g)
        .map((subString, index, array) => {
          if (index % 2 && index !== array.length - 1) return subString;
          return Util.escapeMarkdown(subString, {
            codeBlock,
            bold,
            italic,
            underline,
            strikethrough,
            spoiler,
            escape,
            heading,
            bulletedList,
            numberedList,
            maskedLink,
          });
        })
        .join(inlineCode ? '\\`' : '`');
    }
    if (escape) text = Util.escapeEscape(text);
    if (inlineCode) text = Util.escapeInlineCode(text);
    if (codeBlock) text = Util.escapeCodeBlock(text);
    if (italic) text = Util.escapeItalic(text);
    if (bold) text = Util.escapeBold(text);
    if (underline) text = Util.escapeUnderline(text);
    if (strikethrough) text = Util.escapeStrikethrough(text);
    if (spoiler) text = Util.escapeSpoiler(text);
    if (heading) text = Util.escapeHeading(text);
    if (bulletedList) text = Util.escapeBulletedList(text);
    if (numberedList) text = Util.escapeNumberedList(text);
    if (maskedLink) text = Util.escapeMaskedLink(text);
    return text;
  }

  public static escapeCodeBlock(text: string): string {
    return text.replaceAll('```', '\\`\\`\\`');
  }

  public static escapeInlineCode(text: string): string {
    return text.replace(/(?<=^|[^`])``?(?=[^`]|$)/g, match => (match.length === 2 ? '\\`\\`' : '\\`'));
  }

  public static escapeItalic(text: string): string {
    let i = 0;
    text = text.replace(/(?<=^|[^*])\*([^*]|\*\*|$)/g, (_, match: string) => {
      if (match === '**') return ++i % 2 ? `\\*${match}` : `${match}\\*`;
      return `\\*${match}`;
    });
    i = 0;
    return text.replace(/(?<=^|[^_])_([^_]|__|$)/g, (_, match: string) => {
      if (match === '__') return ++i % 2 ? `\\_${match}` : `${match}\\_`;
      return `\\_${match}`;
    });
  }

  public static escapeBold(text: string): string {
    let i = 0;
    return text.replace(/\*\*(\*)?/g, (_, match?: string) => {
      if (match) return ++i % 2 ? `${match}\\*\\*` : `\\*\\*${match}`;
      return '\\*\\*';
    });
  }

  public static escapeUnderline(text: string): string {
    let i = 0;
    return text.replace(/__(_)?/g, (_, match?: string) => {
      if (match) return ++i % 2 ? `${match}\\_\\_` : `\\_\\_${match}`;
      return '\\_\\_';
    });
  }

  public static escapeStrikethrough(text: string): string {
    return text.replaceAll('~~', '\\~\\~');
  }

  public static escapeSpoiler(text: string): string {
    return text.replaceAll('||', '\\|\\|');
  }

  public static escapeEscape(text: string): string {
    return text.replaceAll('\\', '\\\\');
  }

  public static escapeHeading(text: string): string {
    return text.replaceAll(/^( {0,2}[*-] +)?(#{1,3} )/gm, '$1\\$2');
  }

  public static escapeBulletedList(text: string): string {
    return text.replaceAll(/^( *)[*-]( +)/gm, '$1\\-$2');
  }

  public static escapeNumberedList(text: string): string {
    return text.replaceAll(/^( *\d+)\./gm, '$1\\.');
  }

  public static escapeMaskedLink(text: string): string {
    return text.replaceAll(/\[.+\]\(.+\)/gm, '\\$&');
  }

  public static fetchRecommendedShards(): Promise<number> {
    throw new DiscordjsError('INVALID_USER_API');
  }

  public static parseEmoji(text: string): ParsedEmoji | null {
    if (text.includes('%')) text = decodeURIComponent(text);
    if (!text.includes(':')) return { animated: false, name: text, id: null };
    const match = text.match(/<?(?:(a):)?(\w{2,32}):(\d{17,19})?>?/);
    return match ? { animated: Boolean(match[1]), name: match[2]!, id: match[3] ?? null } : null;
  }

  public static resolvePartialEmoji(emoji: EmojiIdentifierResolvable): Partial<ParsedEmoji> | null {
    if (!emoji) return null;
    if (typeof emoji === 'string') return /^\d{17,19}$/.test(emoji) ? { id: emoji } : Util.parseEmoji(emoji);
    const { id, name, animated } = emoji;
    if (!id && !name) return null;
    return { id: id ?? null, name: name ?? '', animated: Boolean(animated) };
  }

  public static cloneObject<T extends object>(obj: T): T {
    return Object.assign(Object.create(obj), obj);
  }

  public static mergeDefault<T extends Record<string, unknown>>(def: T, given: Record<string, unknown> | null | undefined): T {
    if (!given) return def;
    const result = { ...given } as Record<string, unknown>;
    for (const key in def) {
      if (!hasOwn(given, key) || given[key] === undefined) {
        result[key] = def[key];
      } else if (isObj(given[key]) && isObj(def[key])) {
        result[key] = Util.mergeDefault(
          def[key] as Record<string, unknown>,
          given[key] as Record<string, unknown>,
        );
      }
    }
    return result as unknown as T;
  }

  public static makeError(obj: MakeErrorOptions): Error {
    const err = new Error(obj.message);
    err.name = obj.name;
    if (obj.stack) err.stack = obj.stack;
    return err;
  }

  public static makePlainError(err: Error): MakeErrorOptions {
    return {
      name: err.name,
      message: err.message,
      stack: err.stack,
    };
  }

  public static moveElementInArray<T>(array: T[], element: T, newIndex: number, offset = false): number {
    const index = array.indexOf(element);
    const targetIndex = (offset ? index : 0) + newIndex;
    if (targetIndex > -1 && targetIndex < array.length) {
      const removedElement = array.splice(index, 1)[0]!;
      array.splice(targetIndex, 0, removedElement);
    }
    return array.indexOf(element);
  }

  public static verifyString(
    data: unknown,
    error: new (msg: string) => Error = Error,
    errorMessage = `Expected a string, got ${data} instead.`,
    allowEmpty = true,
  ): string {
    if (typeof data !== 'string') throw new error(errorMessage);
    if (!allowEmpty && data.length === 0) throw new error(errorMessage);
    return data;
  }

  public static resolveColor(color: ColorResolvable): number {
    let resolved: number;
    if (typeof color === 'string') {
      if (color === 'RANDOM') return Math.floor(Math.random() * (0xffffff + 1));
      if (color === 'DEFAULT') return 0;
      resolved = Colors[color] ?? parseInt(color.replace('#', ''), 16);
    } else if (Array.isArray(color)) {
      resolved = ((color[0] ?? 0) << 16) + ((color[1] ?? 0) << 8) + (color[2] ?? 0);
    } else {
      resolved = color as number;
    }

    if (resolved < 0 || resolved > 0xffffff) throw new DiscordjsRangeError('COLOR_RANGE');
    if (Number.isNaN(resolved)) throw new DiscordjsTypeError('COLOR_CONVERT');

    return resolved;
  }

  public static discordSort<K, V extends { rawPosition: number; id: Snowflake }>(
    collection: Collection<K, V>,
  ): Collection<K, V> {
    const isGuildChannel = (collection.first() as { guild?: unknown })?.guild !== undefined;
    return collection.toSorted(
      isGuildChannel
        ? (a, b) => a.rawPosition - b.rawPosition || Number(BigInt(a.id) - BigInt(b.id))
        : (a, b) => a.rawPosition - b.rawPosition || Number(BigInt(b.id) - BigInt(a.id)),
    );
  }

  public static async setPosition<T extends { id: Snowflake }>(
    item: T,
    position: number,
    relative: boolean,
    sorted: Collection<Snowflake, T>,
    route: { patch: (data: { data: { id: Snowflake; position: number }[]; reason?: string }) => Promise<unknown> },
    reason?: string,
  ): Promise<{ id: Snowflake; position: number }[]> {
    const updatedItems = [...sorted.values()];
    Util.moveElementInArray(updatedItems, item, position, relative);
    const payload = updatedItems.map((r, i) => ({ id: r.id, position: i }));
    await route.patch({ data: payload, reason });
    return payload;
  }

  public static basename(filePath: string, ext?: string): string {
    const res = parse(filePath);
    return ext && res.ext.startsWith(ext) ? res.name : res.base.split('?')[0]!;
  }

  public static removeMentions(str: string): string {
    if (!deprecationEmittedForRemoveMentions) {
      process.emitWarning(
        'The Util.removeMentions method is deprecated. Use MessageOptions#allowedMentions instead.',
        'DeprecationWarning',
      );
      deprecationEmittedForRemoveMentions = true;
    }
    return Util._removeMentions(str);
  }

  public static _removeMentions(str: string): string {
    return str.replaceAll('@', '@\u200b');
  }

  public static cleanContent(
    str: string,
    channel: {
      type: string;
      client: {
        users: { cache: Collection<string, { username: string }> };
        channels: { cache: Collection<string, { name: string }> };
      };
      guild?: {
        members: { cache: Collection<string, { displayName: string }> };
        roles: { cache: Collection<string, { name: string }> };
      };
    },
  ): string {
    return str
      .replace(/<@!?[0-9]+>/g, input => {
        const id = input.replace(/<|!|>|@/g, '');
        if (channel.type === 'DM') {
          const user = channel.client.users.cache.get(id);
          return user ? Util._removeMentions(`@${user.username}`) : input;
        }

        const member = channel.guild?.members.cache.get(id);
        if (member) {
          return Util._removeMentions(`@${member.displayName}`);
        }
        const user = channel.client.users.cache.get(id);
        return user ? Util._removeMentions(`@${user.username}`) : input;
      })
      .replace(/<#[0-9]+>/g, input => {
        const mentionedChannel = channel.client.channels.cache.get(input.replace(/<|#|>/g, ''));
        return mentionedChannel ? `#${mentionedChannel.name}` : input;
      })
      .replace(/<@&[0-9]+>/g, input => {
        if (channel.type === 'DM' || !channel.guild) return input;
        const role = channel.guild.roles.cache.get(input.replace(/<|@|>|&/g, ''));
        return role ? `@${role.name}` : input;
      });
  }

  public static cleanCodeBlockContent(text: string): string {
    return text.replaceAll('```', '`\u200b``');
  }

  public static resolveAutoArchiveMaxLimit(): number {
    if (!deprecationEmittedForResolveAutoArchiveMaxLimit) {
      process.emitWarning(
        "The Util.resolveAutoArchiveMaxLimit method and the 'MAX' option are deprecated and will be removed in the next major version.",
        'DeprecationWarning',
      );
      deprecationEmittedForResolveAutoArchiveMaxLimit = true;
    }
    return 10080;
  }

  public static transformAPIGuildForumTag(tag: APIGuildForumTag): GuildForumTag {
    return {
      id: tag.id,
      name: tag.name,
      moderated: tag.moderated,
      emoji:
        tag.emoji_id ?? tag.emoji_name
          ? {
              id: tag.emoji_id,
              name: tag.emoji_name,
            }
          : null,
    };
  }

  public static transformGuildForumTag(tag: GuildForumTag): APIGuildForumTag {
    return {
      id: tag.id,
      name: tag.name,
      moderated: tag.moderated,
      emoji_id: tag.emoji?.id ?? null,
      emoji_name: tag.emoji?.name ?? null,
    };
  }

  public static transformAPIGuildDefaultReaction(
    defaultReaction: APIGuildForumDefaultReactionEmoji,
  ): DefaultReactionEmoji {
    return {
      id: defaultReaction.emoji_id,
      name: defaultReaction.emoji_name,
    };
  }

  public static transformGuildDefaultReaction(
    defaultReaction: DefaultReactionEmoji,
  ): APIGuildForumDefaultReactionEmoji {
    return {
      emoji_id: defaultReaction.id,
      emoji_name: defaultReaction.name,
    };
  }

  public static transformGuildScheduledEventRecurrenceRule(
    recurrenceRule: GuildScheduledEventRecurrenceRuleOptions,
  ): APIGuildScheduledEventRecurrenceRule {
    return {
      start: new Date(recurrenceRule.startAt).toISOString(),
      frequency: recurrenceRule.frequency,
      interval: recurrenceRule.interval,
      by_weekday: recurrenceRule.byWeekday,
      by_n_weekday: recurrenceRule.byNWeekday,
      by_month: recurrenceRule.byMonth,
      by_month_day: recurrenceRule.byMonthDay,
    };
  }

  public static transformAPIIncidentsData(data: APIIncidentsData): IncidentActions {
    return {
      invitesDisabledUntil: data.invites_disabled_until ? new Date(data.invites_disabled_until) : null,
      dmsDisabledUntil: data.dms_disabled_until ? new Date(data.dms_disabled_until) : null,
      dmSpamDetectedAt: data.dm_spam_detected_at ? new Date(data.dm_spam_detected_at) : null,
      raidDetectedAt: data.raid_detected_at ? new Date(data.raid_detected_at) : null,
    };
  }

  public static getSortableGroupTypes(type: string): readonly string[] {
    switch (type) {
      case 'GUILD_TEXT':
      case 'GUILD_ANNOUNCEMENT':
      case 'GUILD_FORUM':
        return TextSortableGroupTypes;
      case 'GUILD_VOICE':
      case 'GUILD_STAGE_VOICE':
        return VoiceSortableGroupTypes;
      case 'GUILD_CATEGORY':
        return CategorySortableGroupTypes;
      default:
        return [type];
    }
  }

  public static calculateUserDefaultAvatarIndex(userId: Snowflake): number {
    return Number(BigInt(userId) >> 22n) % 6;
  }

  public static async getUploadURL(
    client: { api: { channels: Record<string, { attachments: { post: (opts: { data: { files: unknown[] } }) => Promise<{ attachments: unknown[] }> } }> } },
    channelId: string,
    files: { name: string }[],
  ): Promise<unknown[]> {
    if (!files.length) return [];
    const formattedFiles = files.map((file, i) => ({
      filename: file.name,
      file_size: Math.floor((26_214_400 / 10) * Math.random()),
      id: `${i}`,
    }));
    const { attachments } = await client.api.channels[channelId]!.attachments.post({
      data: {
        files: formattedFiles,
      },
    });
    return attachments;
  }

  public static uploadFile(data: BodyInit, url: string): Promise<Response> {
    return new Promise((resolve, reject) => {
      fetch(url, {
        method: 'PUT',
        body: data,
        duplex: 'half',
      } as import('undici').RequestInit)
        .then(res => {
          if (res.ok) {
            resolve(res);
          } else {
            reject(res);
          }
        })
        .catch(reject);
    });
  }

  public static lazy<T>(cb: () => T): () => T {
    let defaultValue: T | undefined;
    return () => (defaultValue ??= cb());
  }

  public static verifyProxyAgent(object: unknown): boolean {
    return (
      typeof object === 'object' &&
      object !== null &&
      (object as { httpAgent?: unknown }).httpAgent instanceof Agent &&
      (object as { httpsAgent?: unknown }).httpsAgent instanceof Agent
    );
  }

  public static checkUndiciProxyAgent(data: unknown): { uri: string } | false {
    if (typeof data === 'string') {
      return { uri: data };
    }
    if (data instanceof URL) {
      return { uri: data.toString() };
    }
    if (typeof data === 'object' && data !== null && typeof (data as { uri?: unknown }).uri === 'string') {
      return data as { uri: string };
    }
    return false;
  }

  public static createPromiseInteraction(
    client: {
      on: (event: string, handler: (data: unknown) => void) => void;
      removeListener: (event: string, handler: (data: unknown) => void) => void;
      incrementMaxListeners: () => void;
      decrementMaxListeners: () => void;
    },
    nonce: string,
    timeoutMs = 5_000,
    isHandlerDeferUpdate = false,
    parent?: unknown,
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      let dataFromInteractionSuccess: unknown;
      let dataFromNormalEvent: unknown;
      const handler = (dataRaw: unknown) => {
        const data = dataRaw as { nonce?: string; d?: { nonce?: string }; t?: string };
        if (isHandlerDeferUpdate && data.d?.nonce === nonce && data.t === 'INTERACTION_SUCCESS') {
          client.removeListener(Events.MESSAGE_CREATE, handler);
          client.removeListener(Events.UNHANDLED_PACKET, handler);
          client.removeListener(Events.INTERACTION_MODAL_CREATE, handler);
          dataFromInteractionSuccess = parent;
        }
        if (data.nonce !== nonce) return;
        clearTimeout(timeout);
        client.removeListener(Events.MESSAGE_CREATE, handler);
        client.removeListener(Events.INTERACTION_MODAL_CREATE, handler);
        if (isHandlerDeferUpdate) client.removeListener(Events.UNHANDLED_PACKET, handler);
        client.decrementMaxListeners();
        dataFromNormalEvent = data;
        resolve(data);
      };
      const timeout = setTimeout(() => {
        if (dataFromInteractionSuccess || dataFromNormalEvent) {
          resolve(dataFromNormalEvent || dataFromInteractionSuccess);
          return;
        }
        client.removeListener(Events.MESSAGE_CREATE, handler);
        client.removeListener(Events.INTERACTION_MODAL_CREATE, handler);
        if (isHandlerDeferUpdate) client.removeListener(Events.UNHANDLED_PACKET, handler);
        client.decrementMaxListeners();
        reject(new DiscordjsError('INTERACTION_FAILED'));
      }, timeoutMs).unref();
      client.incrementMaxListeners();
      client.on(Events.MESSAGE_CREATE, handler);
      client.on(Events.INTERACTION_MODAL_CREATE, handler);
      if (isHandlerDeferUpdate) client.on(Events.UNHANDLED_PACKET, handler);
    });
  }

  public static clearNullOrUndefinedObject(object: Record<string, unknown>): Record<string, unknown> | undefined {
    const data: Record<string, unknown> = {};
    const keys = Object.keys(object);

    for (const key of keys) {
      const value = object[key];
      if (value === undefined || value === null || (Array.isArray(value) && value.length === 0)) {
        continue;
      } else if (!Array.isArray(value) && typeof value === 'object') {
        const cleanedValue = Util.clearNullOrUndefinedObject(value as Record<string, unknown>);
        if (cleanedValue !== undefined) {
          data[key] = cleanedValue;
        }
      } else {
        data[key] = value;
      }
    }

    return Object.keys(data).length > 0 ? data : undefined;
  }

  public static getAllPayloadType(): readonly PayloadType[] {
    return payloadTypes;
  }

  public static getPayloadType(codecName: string): number {
    const found = payloadTypes.find(p => p.name === codecName);
    if (!found) throw new DiscordjsError('CODEC_NOT_FOUND', codecName);
    return found.payload_type;
  }

  public static getSDPCodecName(portUdpH264: number, portUdpH265: number, portUdpOpus: number): string {
    const payloadTypeH264 = Util.getPayloadType('H264');
    const payloadTypeH265 = Util.getPayloadType('H265');
    const payloadTypeOpus = Util.getPayloadType('opus');
    return `v=0
o=- 0 0 IN IP4 0.0.0.0
s=-
c=IN IP4 0.0.0.0
t=0 0
a=tool:libavformat 61.1.100
m=video ${portUdpH264} RTP/AVP ${payloadTypeH264}
c=IN IP4 127.0.0.1
b=AS:1000
a=rtpmap:${payloadTypeH264} H264/90000
a=fmtp:${payloadTypeH264} profile-level-id=42e01f;sprop-parameter-sets=Z0IAH6tAoAt2AtwEBAaQeJEV,aM4JyA==;packetization-mode=1
${
  portUdpH265
    ? `m=video ${portUdpH265} RTP/AVP ${payloadTypeH265}
c=IN IP4 127.0.0.1
b=AS:1000
a=rtpmap:${payloadTypeH265} H265/90000\n`
    : ''
}m=audio ${portUdpOpus} RTP/AVP ${payloadTypeOpus}
c=IN IP4 127.0.0.1
b=AS:96
a=rtpmap:${payloadTypeOpus} opus/48000/2
a=fmtp:${payloadTypeOpus} minptime=10;useinbandfec=1
a=extmap:1 urn:ietf:params:rtp-hdrext:ssrc-audio-level
a=extmap:2 http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time
a=extmap:3 http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01
a=extmap:4 urn:ietf:params:rtp-hdrext:sdes:mid
a=extmap:5 http://www.webrtc.org/experiments/rtp-hdrext/playout-delay
a=extmap:6 http://www.webrtc.org/experiments/rtp-hdrext/video-content-type
a=extmap:7 http://www.webrtc.org/experiments/rtp-hdrext/video-timing
a=extmap:8 http://www.webrtc.org/experiments/rtp-hdrext/color-space
a=extmap:10 urn:ietf:params:rtp-hdrext:sdes:rtp-stream-id
a=extmap:11 urn:ietf:params:rtp-hdrext:sdes:repaired-rtp-stream-id
a=extmap:13 urn:3gpp:video-orientation
a=extmap:14 urn:ietf:params:rtp-hdrext:toffset
`;
  }

  public static archivedThreadSweepFilter(lifetime = 14400): unknown {
    return Sweepers.archivedThreadSweepFilter(lifetime);
  }
}

export type RawEmoji = Partial<ParsedEmoji>;
export default Util;
