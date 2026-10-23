import { Buffer } from 'node:buffer';
import ws from 'ws';

interface Erlpack {
  pack(data: unknown): Buffer;
  unpack(data: Buffer): unknown;
}

let erlpack: Erlpack | null = null;
try {
  const mod = (await import('erlpack')) as unknown as Partial<Erlpack> | undefined;
  if (typeof mod?.pack === 'function') erlpack = mod as Erlpack;
} catch {}

export const WebSocket = ws;

const ab = new TextDecoder();

export const encoding: 'etf' | 'json' = erlpack ? 'etf' : 'json';

export const pack = (data: unknown): Buffer | string => {
  return erlpack ? erlpack.pack(data) : JSON.stringify(data);
};

export const unpack = (data: string | ArrayBuffer | Buffer | Uint8Array, type?: string): unknown => {
  if (encoding === 'json' || type === 'json') {
    let text: string;
    if (typeof data !== 'string') {
      text = ab.decode(data);
    } else {
      text = data;
    }
    return JSON.parse(text);
  }
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(new Uint8Array(data as ArrayBuffer));
  return erlpack ? erlpack.unpack(buf) : JSON.parse(ab.decode(buf));
};

export const create = (gateway: string, query: Record<string, string | number | boolean> = {}, ...args: unknown[]): ws => {
  const [g, q] = gateway.split('?');
  const searchParams = new URLSearchParams(query as Record<string, string>);
  searchParams.set('encoding', encoding);
  if (q) {
    new URLSearchParams(q).forEach((v, k) => searchParams.set(k, v));
  }
  const WebSocketCtor = ws as unknown as new (url: string, ...rest: unknown[]) => ws;
  return new WebSocketCtor(`${g}?${searchParams.toString()}`, ...args);
};

export const CONNECTING = ws.CONNECTING;
export const OPEN = ws.OPEN;
export const CLOSING = ws.CLOSING;
export const CLOSED = ws.CLOSED;

export default {
  WebSocket,
  encoding,
  pack,
  unpack,
  create,
  CONNECTING,
  OPEN,
  CLOSING,
  CLOSED,
};
