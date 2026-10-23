import AttachmentFlags from '../util/AttachmentFlags.js';
import Util from '../util/Util.js';
import type { Snowflake } from '../types/index.js';

export interface APIAttachment {
  id?: Snowflake;
  size?: number;
  url?: string;
  proxy_url?: string;
  height?: number | null;
  width?: number | null;
  content_type?: string | null;
  description?: string | null;
  ephemeral?: boolean;
  duration_secs?: number | null;
  waveform?: string | null;
  flags?: number;
  title?: string | null;
  name?: string | null;
  [key: string]: unknown;
}

export class MessageAttachment {
  public attachment: unknown;
  public name: string | null = null;
  public id!: Snowflake;
  public size?: number;
  public url?: string;
  public proxyURL?: string;
  public height: number | null = null;
  public width: number | null = null;
  public contentType: string | null = null;
  public description: string | null = null;
  public ephemeral: boolean = false;
  public duration: number | null = null;
  public waveform: string | null = null;
  public flags: Readonly<AttachmentFlags> = new AttachmentFlags().freeze();
  public title: string | null = null;

  public constructor(
    attachment?: unknown,
    dataOrName: string | { name?: string; description?: string } | null = null,
    data?: APIAttachment,
  ) {
    this.attachment = attachment;
    if (typeof dataOrName === 'object' && dataOrName !== null) {
      this.name = dataOrName.name ?? null;
      if (dataOrName.description) this.description = dataOrName.description;
    } else {
      this.name = dataOrName;
    }
    if (data) this._patch(data);
  }

  public setDescription(description: string): this {
    this.description = description;
    return this;
  }

  public setFile(attachment: unknown, name: string | null = null): this {
    this.attachment = attachment;
    this.name = name;
    return this;
  }

  public setName(name: string): this {
    this.name = name;
    return this;
  }

  public setSpoiler(spoiler: boolean = true): this {
    if (spoiler === this.spoiler) return this;

    if (!spoiler) {
      while (this.spoiler && this.name) {
        this.name = this.name.slice('SPOILER_'.length);
      }
      return this;
    }
    this.name = `SPOILER_${this.name ?? ''}`;
    return this;
  }

  public _patch(data: APIAttachment): void {
    if (data.id) this.id = data.id;

    if ('size' in data && typeof data.size === 'number') {
      this.size = data.size;
    }

    if ('url' in data && typeof data.url === 'string') {
      this.url = data.url;
    }

    if ('proxy_url' in data && typeof data.proxy_url === 'string') {
      this.proxyURL = data.proxy_url;
    }

    if ('height' in data) {
      this.height = data.height ?? null;
    }

    if ('width' in data) {
      this.width = data.width ?? null;
    }

    if ('content_type' in data) {
      this.contentType = data.content_type ?? null;
    }

    if ('description' in data) {
      this.description = data.description ?? null;
    }

    this.ephemeral = data.ephemeral ?? false;

    if ('duration_secs' in data) {
      this.duration = data.duration_secs ?? null;
    }

    if ('waveform' in data) {
      this.waveform = data.waveform ?? null;
    }

    if ('flags' in data && data.flags != null) {
      this.flags = new AttachmentFlags(data.flags).freeze();
    }

    if ('title' in data) {
      this.title = data.title ?? null;
    }
  }

  public get spoiler(): boolean {
    return Util.basename(this.url ?? this.name ?? '').startsWith('SPOILER_');
  }

  public toJSON(): Record<string, unknown> {
    return Util.flatten(this) as Record<string, unknown>;
  }
}

export const AttachmentBuilder = MessageAttachment;
export default MessageAttachment;
