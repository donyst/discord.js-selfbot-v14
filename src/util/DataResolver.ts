import { Buffer } from 'node:buffer';
import fs from 'node:fs';
import path from 'node:path';
import stream from 'node:stream';
import { fetch } from 'undici';
import { DiscordjsError, DiscordjsTypeError } from '../errors/index.js';

export const INVITES_PATTERN = /discord(?:(?:app)?\.com\/invite|\.gg(?:\/invite)?)\/([\w-]{2,255})/gi;
export const GUILD_TEMPLATES_PATTERN = /discord(?:app)?\.(?:com\/template|new)\/([\w-]{2,255})/gi;

import type { InviteResolvable, GuildTemplateResolvable, BufferResolvable } from '../types/index.js';
export type { InviteResolvable, GuildTemplateResolvable };
export type Base64Resolvable = BufferResolvable;
export type FileResolvable = string | Buffer | stream.Readable;

/**
 * The DataResolver identifies different objects and tries to resolve a specific piece of information from them.
 */
export class DataResolver {
  private constructor() {}

  /**
   * Resolves the string to a code based on the passed regex.
   */
  public static resolveCode(data: string, regex: RegExp): string {
    return new RegExp(regex.source, regex.flags).exec(data)?.[1] ?? data;
  }

  /**
   * Resolves InviteResolvable to an invite code.
   */
  public static resolveInviteCode(data: InviteResolvable): string {
    const code = typeof data === 'string' ? data : (data as { code?: string }).code ?? '';
    return this.resolveCode(code, INVITES_PATTERN);
  }

  /**
   * Resolves GuildTemplateResolvable to a template code.
   */
  public static resolveGuildTemplateCode(data: GuildTemplateResolvable): string {
    const code = typeof data === 'string' ? data : (data as { code?: string }).code ?? '';
    return this.resolveCode(code, GUILD_TEMPLATES_PATTERN);
  }

  /**
   * Resolves a Base64Resolvable, a string, or a Buffer to a Base 64 image string.
   */
  public static async resolveImage(image: Base64Resolvable | null | undefined): Promise<string | null> {
    if (!image) return null;
    if (typeof image === 'string' && image.startsWith('data:')) {
      return image;
    }
    const file = await this.resolveFileAsBuffer(image);
    return DataResolver.resolveBase64(file);
  }

  /**
   * Resolves a Base64Resolvable to a Base 64 image data URI.
   */
  public static resolveBase64(data: Base64Resolvable): string {
    if (typeof data === 'string') return data;
    const buffer = Buffer.isBuffer(data)
      ? data
      : ArrayBuffer.isView(data)
      ? Buffer.from(data.buffer, data.byteOffset, data.byteLength)
      : Buffer.from(data as ArrayBuffer);
    return `data:image/jpg;base64,${buffer.toString('base64')}`;
  }

  /**
   * Resolves a FileResolvable to a Buffer or a Stream.
   */
  public static async resolveFile(resource: FileResolvable): Promise<Buffer | stream.Readable> {
    if (Buffer.isBuffer(resource) || resource instanceof stream.Readable) return resource;
    if (typeof resource === 'string') {
      if (/^https?:\/\//.test(resource)) {
        const res = await fetch(resource);
        if (res.ok && res.body) {
          return stream.Readable.fromWeb(res.body as import('node:stream/web').ReadableStream);
        }
        throw new DiscordjsError('FILE_NOT_FOUND', resource);
      }

      return new Promise<stream.Readable>((resolve, reject) => {
        const file = path.resolve(resource);
        fs.stat(file, (err, stats) => {
          if (err) return reject(err);
          if (!stats.isFile()) return reject(new DiscordjsError('FILE_NOT_FOUND', file));
          return resolve(fs.createReadStream(file));
        });
      });
    }

    throw new DiscordjsTypeError('REQ_RESOURCE_TYPE');
  }

  /**
   * Resolves a FileResolvable or BufferResolvable to a Buffer.
   */
  public static async resolveFileAsBuffer(resource: BufferResolvable | stream.Readable): Promise<Buffer> {
    if (Buffer.isBuffer(resource)) return resource;
    if (resource instanceof stream.Readable) {
      const buffers: Buffer[] = [];
      for await (const data of resource) {
        buffers.push(Buffer.isBuffer(data) ? data : Buffer.from(data as Uint8Array));
      }
      return Buffer.concat(buffers);
    }
    if (ArrayBuffer.isView(resource)) {
      return Buffer.from(resource.buffer, resource.byteOffset, resource.byteLength);
    }
    if (resource instanceof ArrayBuffer) {
      return Buffer.from(resource);
    }
    const file = await this.resolveFile(resource as FileResolvable);
    return this.resolveFileAsBuffer(file);
  }
}

export default DataResolver;
