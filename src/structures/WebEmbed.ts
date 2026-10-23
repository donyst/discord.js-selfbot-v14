import { RangeError as DjsRangeError } from '../errors/index.js';
import Util, { type ColorResolvable } from '../util/Util.js';

const baseURL = 'https://webembed-sb.onrender.com/embed?';
export const hiddenCharter =
  '||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||||​||';

export const hiddenEmbed = hiddenCharter;

export interface WebEmbedImage {
  url?: string;
  proxyURL?: string;
  height?: number;
  width?: number;
}

export interface WebEmbedThumbnail {
  url?: string;
  proxyURL?: string;
  height?: number;
  width?: number;
}

export interface WebEmbedVideo {
  url?: string;
  proxyURL?: string;
  height?: number;
  width?: number;
}

export interface WebEmbedAuthor {
  name?: string;
  url?: string;
}

export interface WebEmbedProvider {
  name?: string;
  url?: string;
}

export interface WebEmbedOptions {
  title?: string | null;
  description?: string | null;
  url?: string | null;
  color?: ColorResolvable | null;
  author?: WebEmbedAuthor | null;
  thumbnail?: WebEmbedThumbnail | null;
  image?: WebEmbedImage | null;
  video?: WebEmbedVideo | null;
  provider?: WebEmbedProvider | null;
  redirect?: string | null;
  [key: string]: unknown;
}

export class WebEmbed {
  public imageType: 'thumbnail' | 'image' = 'thumbnail';
  public title: string | null = null;
  public description: string | null = null;
  public url: string | null = null;
  public color: number | null = null;
  public image: WebEmbedImage | null = null;
  public thumbnail: WebEmbedThumbnail | null = null;
  public readonly video: WebEmbedVideo | null = null;
  public author: WebEmbedAuthor | null = null;
  public provider: WebEmbedProvider | null = null;
  public redirect?: string | null;

  public constructor(data: WebEmbed | WebEmbedOptions = {}) {
    this._setup(data as Record<string, unknown>);
  }

  public _setup(data: Record<string, unknown>): void {
    this.imageType = 'thumbnail';
    this.title = (data.title as string) ?? null;
    this.description = (data.description as string) ?? null;
    this.url = (data.url as string) ?? null;
    this.color = 'color' in data && data.color != null ? Util.resolveColor(data.color as ColorResolvable) : null;

    const img = data.image as Record<string, unknown> | undefined;
    this.image = img
      ? {
          url: img.url as string,
          proxyURL: (img.proxyURL ?? img.proxy_url) as string,
          height: img.height as number,
          width: img.width as number,
        }
      : null;

    const thumb = data.thumbnail as Record<string, unknown> | undefined;
    this.thumbnail = thumb
      ? {
          url: thumb.url as string,
          proxyURL: (thumb.proxyURL ?? thumb.proxy_url) as string,
          height: thumb.height as number,
          width: thumb.width as number,
        }
      : null;

    const vid = data.video as Record<string, unknown> | undefined;
    (this as { video: WebEmbedVideo | null }).video = vid
      ? {
          url: vid.url as string,
          proxyURL: (vid.proxyURL ?? vid.proxy_url) as string,
          height: vid.height as number,
          width: vid.width as number,
        }
      : null;

    const auth = data.author as Record<string, unknown> | undefined;
    this.author = auth
      ? {
          name: auth.name as string,
          url: auth.url as string,
        }
      : null;

    const prov = data.provider as Record<string, unknown> | undefined;
    this.provider = prov
      ? {
          name: prov.name as string,
          url: prov.url as string,
        }
      : null;

    this.redirect = (data.redirect as string) ?? null;
  }

  public setAuthor(options: string | WebEmbedAuthor | null): this {
    if (options === null) {
      this.author = null;
      return this;
    }
    if (typeof options === 'string') {
      this.author = {
        name: Util.verifyString(options, DjsRangeError, 'EMBED_AUTHOR_NAME'),
      };
      return this;
    }
    const { name, url } = options;
    this.author = {
      name: name ? Util.verifyString(name, DjsRangeError, 'EMBED_AUTHOR_NAME') : undefined,
      url,
    };
    return this;
  }

  public setProvider(options: string | WebEmbedProvider | null): this {
    if (options === null) {
      this.provider = null;
      return this;
    }
    if (typeof options === 'string') {
      this.provider = {
        name: Util.verifyString(options, DjsRangeError, 'EMBED_PROVIDER_NAME'),
      };
      return this;
    }
    const { name, url } = options;
    this.provider = {
      name: name ? Util.verifyString(name, DjsRangeError, 'EMBED_PROVIDER_NAME') : undefined,
      url,
    };
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

  public setImage(url: string): this {
    if (this.thumbnail && this.thumbnail.url) {
      console.warn('You can only set image or thumbnail per embed.');
      this.thumbnail.url = undefined;
    }
    this.imageType = 'image';
    this.image = { url };
    return this;
  }

  public setThumbnail(url: string): this {
    if (this.image && this.image.url) {
      console.warn('You can only set image or thumbnail per embed.');
      this.image.url = undefined;
    }
    this.imageType = 'thumbnail';
    this.thumbnail = { url };
    return this;
  }

  public setVideo(url: string): this {
    (this as { video: WebEmbedVideo | null }).video = { url };
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

  public setRedirect(url: string): this {
    this.redirect = url;
    return this;
  }

  public toString(): string {
    const url = new URL(baseURL);
    url.searchParams.set('image_type', this.imageType);
    if (this.title) url.searchParams.set('title', this.title);
    if (this.description) url.searchParams.set('description', this.description);
    if (this.url) url.searchParams.set('url', this.url);
    if (this.color != null) url.searchParams.set('color', `#${this.color.toString(16)}`);
    if (this.image?.url) url.searchParams.set('image', this.image.url);
    if (this.video?.url) url.searchParams.set('video', this.video.url);
    if (this.author) {
      if (this.author.name) url.searchParams.set('author_name', this.author.name);
      if (this.author.url) url.searchParams.set('author_url', this.author.url);
    }
    if (this.provider) {
      if (this.provider.name) url.searchParams.set('provider_name', this.provider.name);
      if (this.provider.url) url.searchParams.set('provider_url', this.provider.url);
    }
    if (this.thumbnail?.url) url.searchParams.set('image', this.thumbnail.url);
    if (this.redirect) url.searchParams.set('redirect', this.redirect);
    return url.toString();
  }
}

export default WebEmbed;
