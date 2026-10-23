import process from 'node:process';
import { RangeError as DjsRangeError } from '../errors/index.js';
import Util, { type ColorResolvable } from '../util/Util.js';

let deprecationEmittedForSetAuthor = false;
let deprecationEmittedForSetFooter = false;
let deprecationEmittedForAddField = false;

export interface EmbedField {
  name: string;
  value: string;
  inline: boolean;
}

export interface EmbedFieldData {
  name: string;
  value: string;
  inline?: boolean;
}

export interface MessageEmbedThumbnail {
  url?: string;
  proxyURL?: string;
  height?: number;
  width?: number;
}

export interface MessageEmbedImage {
  url?: string;
  proxyURL?: string;
  height?: number;
  width?: number;
}

export interface MessageEmbedVideo {
  url?: string;
  proxyURL?: string;
  height?: number;
  width?: number;
}

export interface MessageEmbedAuthor {
  name?: string;
  url?: string;
  iconURL?: string;
  proxyIconURL?: string;
}

export interface MessageEmbedProvider {
  name?: string;
  url?: string;
}

export interface MessageEmbedFooter {
  text?: string;
  iconURL?: string;
  proxyIconURL?: string;
}

export interface EmbedAuthorData {
  name: string;
  url?: string;
  iconURL?: string;
}

export interface EmbedFooterData {
  text: string;
  iconURL?: string;
}

export interface APIEmbed {
  title?: string | null;
  type?: string;
  description?: string | null;
  url?: string | null;
  timestamp?: string | number | Date | null;
  color?: number | null;
  fields?: EmbedField[];
  thumbnail?: {
    url?: string;
    proxy_url?: string;
    proxyURL?: string;
    height?: number;
    width?: number;
  } | null;
  image?: {
    url?: string;
    proxy_url?: string;
    proxyURL?: string;
    height?: number;
    width?: number;
  } | null;
  video?: {
    url?: string;
    proxy_url?: string;
    proxyURL?: string;
    height?: number;
    width?: number;
  } | null;
  author?: {
    name?: string;
    url?: string;
    icon_url?: string;
    iconURL?: string;
    proxy_icon_url?: string;
    proxyIconURL?: string;
  } | null;
  provider?: {
    name?: string;
    url?: string;
  } | null;
  footer?: {
    text?: string;
    icon_url?: string;
    iconURL?: string;
    proxy_icon_url?: string;
    proxyIconURL?: string;
  } | null;
}

export interface MessageEmbedOptions {
  title?: string | null;
  description?: string | null;
  url?: string | null;
  timestamp?: Date | number | string | null;
  color?: ColorResolvable | null;
  fields?: EmbedFieldData[];
  author?: EmbedAuthorData | MessageEmbedAuthor | null;
  thumbnail?: MessageEmbedThumbnail | null;
  image?: MessageEmbedImage | null;
  video?: MessageEmbedVideo | null;
  footer?: EmbedFooterData | MessageEmbedFooter | null;
  provider?: MessageEmbedProvider | null;
  type?: string;
}

export class MessageEmbed {
  public type: string = 'rich';
  public title: string | null = null;
  public description: string | null = null;
  public url: string | null = null;
  public color: number | null = null;
  public timestamp: number | null = null;
  public fields: EmbedField[] = [];
  public thumbnail: MessageEmbedThumbnail | null = null;
  public image: MessageEmbedImage | null = null;
  public readonly video: MessageEmbedVideo | null = null;
  public author: MessageEmbedAuthor | null = null;
  public provider: MessageEmbedProvider | null = null;
  public footer: MessageEmbedFooter | null = null;

  public constructor(data: MessageEmbed | MessageEmbedOptions | APIEmbed = {}, skipValidation = false) {
    this.setup(data as APIEmbed, skipValidation);
  }

  public setup(data: APIEmbed, skipValidation: boolean): void {
    this.type = data.type ?? 'rich';
    this.title = data.title ?? null;
    this.description = data.description ?? null;
    this.url = data.url ?? null;
    this.color = 'color' in data && data.color != null ? Util.resolveColor(data.color as ColorResolvable) : null;
    this.timestamp = 'timestamp' in data && data.timestamp != null ? new Date(data.timestamp).getTime() : null;

    this.fields = [];
    if (data.fields) {
      this.fields = skipValidation
        ? (data.fields.map(Util.cloneObject) as EmbedField[])
        : MessageEmbed.normalizeFields(data.fields);
    }

    this.thumbnail = data.thumbnail
      ? {
          url: data.thumbnail.url,
          proxyURL: data.thumbnail.proxyURL ?? data.thumbnail.proxy_url,
          height: data.thumbnail.height,
          width: data.thumbnail.width,
        }
      : null;

    this.image = data.image
      ? {
          url: data.image.url,
          proxyURL: data.image.proxyURL ?? data.image.proxy_url,
          height: data.image.height,
          width: data.image.width,
        }
      : null;

    (this as { video: MessageEmbedVideo | null }).video = data.video
      ? {
          url: data.video.url,
          proxyURL: data.video.proxyURL ?? data.video.proxy_url,
          height: data.video.height,
          width: data.video.width,
        }
      : null;

    this.author = data.author
      ? {
          name: data.author.name,
          url: data.author.url,
          iconURL: data.author.iconURL ?? data.author.icon_url,
          proxyIconURL: data.author.proxyIconURL ?? data.author.proxy_icon_url,
        }
      : null;

    this.provider = data.provider
      ? {
          name: data.provider.name,
          url: data.provider.url,
        }
      : null;

    this.footer = data.footer
      ? {
          text: data.footer.text,
          iconURL: data.footer.iconURL ?? data.footer.icon_url,
          proxyIconURL: data.footer.proxyIconURL ?? data.footer.proxy_icon_url,
        }
      : null;
  }

  public get createdAt(): Date | null {
    return this.timestamp ? new Date(this.timestamp) : null;
  }

  public get hexColor(): string | null {
    return this.color ? `#${this.color.toString(16).padStart(6, '0')}` : null;
  }

  public get length(): number {
    return (
      (this.title?.length ?? 0) +
      (this.description?.length ?? 0) +
      (this.fields.length >= 1
        ? this.fields.reduce((prev, curr) => prev + curr.name.length + curr.value.length, 0)
        : 0) +
      (this.footer?.text?.length ?? 0) +
      (this.author?.name?.length ?? 0)
    );
  }

  public equals(embed: MessageEmbed | APIEmbed): boolean {
    const otherAuthorIcon = 'iconURL' in (embed.author ?? {})
      ? (embed.author as MessageEmbedAuthor)?.iconURL
      : (embed.author as { icon_url?: string })?.icon_url;

    const otherFooterIcon = 'iconURL' in (embed.footer ?? {})
      ? (embed.footer as MessageEmbedFooter)?.iconURL
      : (embed.footer as { icon_url?: string })?.icon_url;

    return (
      this.type === embed.type &&
      this.author?.name === embed.author?.name &&
      this.author?.url === embed.author?.url &&
      this.author?.iconURL === otherAuthorIcon &&
      this.color === embed.color &&
      this.title === embed.title &&
      this.description === embed.description &&
      this.url === embed.url &&
      this.timestamp === (typeof embed.timestamp === 'number' ? embed.timestamp : embed.timestamp ? new Date(embed.timestamp).getTime() : null) &&
      this.fields.length === (embed.fields?.length ?? 0) &&
      this.fields.every((field, i) => this._fieldEquals(field, embed.fields![i])) &&
      this.footer?.text === embed.footer?.text &&
      this.footer?.iconURL === otherFooterIcon &&
      this.image?.url === embed.image?.url &&
      this.thumbnail?.url === embed.thumbnail?.url &&
      this.video?.url === embed.video?.url &&
      this.provider?.name === embed.provider?.name &&
      this.provider?.url === embed.provider?.url
    );
  }

  private _fieldEquals(field: EmbedFieldData, other: EmbedFieldData): boolean {
    return field.name === other.name && field.value === other.value && Boolean(field.inline) === Boolean(other.inline);
  }

  public addField(name: string, value: string, inline: boolean = false): this {
    if (!deprecationEmittedForAddField) {
      process.emitWarning(
        'MessageEmbed#addField is deprecated and will be removed in the next major update. Use MessageEmbed#addFields instead.',
        'DeprecationWarning',
      );
      deprecationEmittedForAddField = true;
    }
    return this.addFields({ name, value, inline });
  }

  public addFields(...fields: (EmbedFieldData | EmbedFieldData[])[]): this {
    this.fields.push(...MessageEmbed.normalizeFields(...fields));
    return this;
  }

  public spliceFields(
    index: number,
    deleteCount: number,
    ...fields: (EmbedFieldData | EmbedFieldData[])[]
  ): this {
    this.fields.splice(index, deleteCount, ...MessageEmbed.normalizeFields(...fields));
    return this;
  }

  public setFields(...fields: (EmbedFieldData | EmbedFieldData[])[]): this {
    this.spliceFields(0, this.fields.length, ...fields);
    return this;
  }

  public setAuthor(
    options: string | EmbedAuthorData | null,
    deprecatedIconURL?: string,
    deprecatedURL?: string,
  ): this {
    if (options === null) {
      this.author = null;
      return this;
    }

    if (typeof options === 'string') {
      if (!deprecationEmittedForSetAuthor) {
        process.emitWarning(
          'Passing strings for MessageEmbed#setAuthor is deprecated. Pass a sole object instead.',
          'DeprecationWarning',
        );
        deprecationEmittedForSetAuthor = true;
      }
      options = { name: options, url: deprecatedURL, iconURL: deprecatedIconURL };
    }

    const { name, url, iconURL } = options;
    this.author = { name: Util.verifyString(name, DjsRangeError, 'EMBED_AUTHOR_NAME'), url, iconURL };
    return this;
  }

  public setColor(color: ColorResolvable): this {
    this.color = Util.resolveColor(color);
    return this;
  }

  public setDescription(description: string): this {
    this.description = Util.verifyString(description, DjsRangeError, 'EMBED_DESCRIPTION');
    return this;
  }

  public setFooter(options: string | EmbedFooterData | null, deprecatedIconURL?: string): this {
    if (options === null) {
      this.footer = null;
      return this;
    }

    if (typeof options === 'string') {
      if (!deprecationEmittedForSetFooter) {
        process.emitWarning(
          'Passing strings for MessageEmbed#setFooter is deprecated. Pass a sole object instead.',
          'DeprecationWarning',
        );
        deprecationEmittedForSetFooter = true;
      }
      options = { text: options, iconURL: deprecatedIconURL };
    }

    const { text, iconURL } = options;
    this.footer = { text: Util.verifyString(text, DjsRangeError, 'EMBED_FOOTER_TEXT'), iconURL };
    return this;
  }

  public setImage(url: string): this {
    this.image = { url };
    return this;
  }

  public setThumbnail(url: string): this {
    this.thumbnail = { url };
    return this;
  }

  public setTimestamp(timestamp: Date | number | null = Date.now()): this {
    if (timestamp instanceof Date) timestamp = timestamp.getTime();
    this.timestamp = timestamp;
    return this;
  }

  public setTitle(title: string): this {
    this.title = Util.verifyString(title, DjsRangeError, 'EMBED_TITLE');
    return this;
  }

  public setURL(url: string): this {
    this.url = url;
    return this;
  }

  public toJSON(): APIEmbed {
    return {
      title: this.title,
      type: this.type,
      description: this.description,
      url: this.url,
      timestamp: this.timestamp ? new Date(this.timestamp).toISOString() : undefined,
      color: this.color ?? undefined,
      fields: this.fields,
      thumbnail: this.thumbnail,
      image: this.image,
      author: this.author && {
        name: this.author.name,
        url: this.author.url,
        icon_url: this.author.iconURL,
      },
      video: this.video && {
        url: this.video.url,
        proxyURL: this.video.proxyURL,
        height: this.video.height,
        width: this.video.width,
      },
      provider: this.provider && {
        name: this.provider.name,
        url: this.provider.url,
      },
      footer: this.footer && {
        text: this.footer.text,
        icon_url: this.footer.iconURL,
      },
    };
  }

  public static normalizeField(name: string, value: string, inline: boolean = false): EmbedField {
    return {
      name: Util.verifyString(name, DjsRangeError, 'EMBED_FIELD_NAME', false),
      value: Util.verifyString(value, DjsRangeError, 'EMBED_FIELD_VALUE', false),
      inline,
    };
  }

  public static normalizeFields(...fields: (EmbedFieldData | EmbedFieldData[])[]): EmbedField[] {
    return (fields.flat(2) as EmbedFieldData[]).map(field =>
      this.normalizeField(field.name, field.value, typeof field.inline === 'boolean' ? field.inline : false),
    );
  }
}

export default MessageEmbed;
