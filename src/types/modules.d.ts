declare module 'tree-kill' {
  function kill(pid: number, signal?: string | number, callback?: (error?: Error) => void): void;
  export = kill;
}

declare module 'find-process' {
  interface ProcessItem {
    pid: number;
    ppid: number;
    name: string;
    cmd: string;
    bin?: string;
  }
  function findProcess(by: 'name' | 'pid' | 'port', value: string | number, strict?: boolean): Promise<ProcessItem[]>;
  export = findProcess;
}

declare module 'erlpack' {
  export function pack(data: unknown): import('node:buffer').Buffer;
  export function unpack(data: import('node:buffer').Buffer): unknown;
}

declare module 'zlib-sync' {
  export interface Inflate {
    push(chunk: import('node:buffer').Buffer | Uint8Array, flush: number): void;
    result?: string | import('node:buffer').Buffer | Uint8Array;
  }
  export const Inflate: new (opts: { chunkSize: number; flush: number; to: string }) => Inflate;
  export const Z_SYNC_FLUSH: number;
}
