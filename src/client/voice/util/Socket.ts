import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import process from 'node:process';
import type { Readable, Writable } from 'node:stream';

let counter = 0;

export class UnixStream {
  public socketPath: string;
  public url: string;

  public constructor(stream: Readable | Writable, onSocket: (socket: net.Socket) => void) {
    if (process.platform === 'win32') {
      const pipePrefix = '\\\\.\\pipe\\';
      const pipeName = `node-webrtc.${++counter}.sock`;
      this.socketPath = path.join(pipePrefix, pipeName);
      this.url = this.socketPath;
    } else {
      this.socketPath = `./${++counter}.sock`;
      this.url = `unix:${this.socketPath}`;
    }

    try {
      fs.statSync(this.socketPath);
      fs.unlinkSync(this.socketPath);
    } catch {
      // Null
    }

    const server = net.createServer(onSocket);
    stream.on('finish', () => {
      server.close();
    });
    server.listen(this.socketPath);
  }
}

export function StreamInput(stream: Readable): UnixStream {
  return new UnixStream(stream, socket => stream.pipe(socket));
}

export function StreamOutput(stream: Writable): UnixStream {
  return new UnixStream(stream, socket => socket.pipe(stream));
}

export default { StreamOutput, StreamInput, UnixStream };
