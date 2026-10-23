import EventEmitter from 'node:events';
import net from 'node:net';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import type { Client } from './Client.js';
import type { PresenceData } from '../structures/ClientPresence.js';

export enum IPCOpcodes {
  HANDSHAKE = 0,
  FRAME = 1,
  CLOSE = 2,
  PING = 3,
  PONG = 4,
}

export interface IPCPacket<T = unknown> {
  op: IPCOpcodes;
  data: T;
}

export interface ActivityPayload {
  details?: string;
  state?: string;
  timestamps?: {
    start?: number;
    end?: number;
  };
  assets?: {
    large_image?: string;
    large_text?: string;
    small_image?: string;
    small_text?: string;
  };
  party?: {
    id?: string;
    size?: [number, number];
  };
  secrets?: {
    join?: string;
    spectate?: string;
    match?: string;
  };
  buttons?: Array<{ label: string; url: string }>;
  type?: number;
  instance?: boolean;
  name?: string;
}

export interface IPCFramePayload {
  cmd: string;
  args?: {
    pid?: number;
    activity?: ActivityPayload;
    [key: string]: unknown;
  };
  evt?: string | null;
  nonce?: string | null;
  data?: unknown;
}

export interface DiscordIPCServerOptions {
  pipeIndex?: number;
  autoSetActivity?: boolean;
}

/**
 * Embedded Virtual Discord IPC Server.
 * Listens on the official Discord Desktop Named Pipe (\\.\pipe\discord-ipc-0..9 on Windows,
 * /tmp/discord-ipc-0..9 on POSIX) allowing local external applications (games, Spotify,
 * media players, IDE rich presence plugins) to connect and update Rich Presence on the selfbot.
 */
export class DiscordIPCServer extends EventEmitter {
  public readonly client: Client;
  public server: net.Server | null = null;
  public socketPath: string | null = null;
  public activeConnections: Set<net.Socket> = new Set();
  public autoSetActivity: boolean;

  public constructor(client: Client, options: DiscordIPCServerOptions = {}) {
    super();
    this.client = client;
    this.autoSetActivity = options.autoSetActivity ?? true;
  }

  /**
   * Starts listening on the Discord IPC named pipe or Unix socket.
   */
  public async listen(pipeIndex = 0): Promise<string> {
    const isWindows = process.platform === 'win32';
    const basePath = isWindows
      ? '\\\\?\\pipe\\discord-ipc'
      : path.join(process.env.XDG_RUNTIME_DIR || process.env.TMPDIR || os.tmpdir(), 'discord-ipc');

    let currentPipe = pipeIndex;
    let bound = false;

    while (currentPipe <= 9 && !bound) {
      const candidatePath = `${basePath}-${currentPipe}`;
      if (!isWindows && fs.existsSync(candidatePath)) {
        try {
          fs.unlinkSync(candidatePath);
        } catch {
          currentPipe++;
          continue;
        }
      }

      try {
        await new Promise<void>((resolve, reject) => {
          const srv = net.createServer(this._handleSocket.bind(this));
          srv.once('error', reject);
          srv.listen(candidatePath, () => {
            srv.removeListener('error', reject);
            this.server = srv;
            this.socketPath = candidatePath;
            bound = true;
            resolve();
          });
        });
      } catch {
        currentPipe++;
      }
    }

    if (!bound || !this.socketPath) {
      throw new Error(`Failed to bind Discord IPC Named Pipe (pipes 0-9 were unavailable)`);
    }

    this.emit('listening', this.socketPath);
    return this.socketPath;
  }

  /**
   * Stops the Discord IPC Server.
   */
  public async close(): Promise<void> {
    for (const socket of this.activeConnections) {
      try {
        socket.destroy();
      } catch {}
    }
    this.activeConnections.clear();

    if (this.server) {
      await new Promise<void>(resolve => {
        this.server?.close(() => resolve());
      });
      if (process.platform !== 'win32' && this.socketPath && fs.existsSync(this.socketPath)) {
        try {
          fs.unlinkSync(this.socketPath);
        } catch {}
      }
      this.server = null;
      this.socketPath = null;
    }
  }

  private _handleSocket(socket: net.Socket): void {
    this.activeConnections.add(socket);
    let buffer = Buffer.alloc(0);

    socket.on('data', chunk => {
      buffer = Buffer.concat([buffer, chunk]);

      while (buffer.length >= 8) {
        const op = buffer.readInt32LE(0);
        const length = buffer.readInt32LE(4);

        if (buffer.length < 8 + length) {
          break;
        }

        const payloadBuffer = buffer.subarray(8, 8 + length);
        buffer = buffer.subarray(8 + length);

        try {
          const json = JSON.parse(payloadBuffer.toString('utf-8')) as unknown;
          this._handlePacket(socket, op, json);
        } catch (err) {
          this.emit('error', err);
        }
      }
    });

    socket.on('close', () => {
      this.activeConnections.delete(socket);
    });

    socket.on('error', err => {
      this.emit('error', err);
    });
  }

  private _sendPacket(socket: net.Socket, op: IPCOpcodes, data: unknown): void {
    if (socket.destroyed) return;
    const jsonStr = JSON.stringify(data);
    const body = Buffer.from(jsonStr, 'utf-8');
    const header = Buffer.alloc(8);
    header.writeInt32LE(op, 0);
    header.writeInt32LE(body.length, 4);
    socket.write(Buffer.concat([header, body]));
  }

  private _handlePacket(socket: net.Socket, op: IPCOpcodes, data: unknown): void {
    switch (op) {
      case IPCOpcodes.HANDSHAKE: {
        const handshake = data as { client_id?: string; v?: number };
        this.emit('handshake', handshake);
        // Respond with DISPATCH READY
        const user = this.client.user;
        this._sendPacket(socket, IPCOpcodes.FRAME, {
          cmd: 'DISPATCH',
          evt: 'READY',
          data: {
            v: handshake.v ?? 1,
            config: {
              cdn_host: 'cdn.discordapp.com',
              api_endpoint: '//discord.com/api',
              environment: 'production',
            },
            user: user
              ? {
                  id: user.id,
                  username: user.username,
                  discriminator: user.discriminator,
                  avatar: user.avatar,
                }
              : null,
          },
        });
        break;
      }

      case IPCOpcodes.PING: {
        this._sendPacket(socket, IPCOpcodes.PONG, data);
        break;
      }

      case IPCOpcodes.FRAME: {
        const frame = data as IPCFramePayload;
        if (frame.cmd === 'SET_ACTIVITY') {
          const activity = frame.args?.activity;
          this.emit('activity', activity, frame.args?.pid);

          if (this.autoSetActivity && activity && this.client.user) {
            void this.client.user.setPresence({
              activities: [
                {
                  name: activity.name || activity.details || 'Playing Game',
                  type: activity.type ?? 0,
                  details: activity.details,
                  state: activity.state,
                  timestamps: activity.timestamps,
                  assets: activity.assets,
                  party: activity.party,
                  buttons: activity.buttons?.map(b => b.label),
                },
              ],
            } as PresenceData);
          }

          // Acknowledge SET_ACTIVITY back to caller
          this._sendPacket(socket, IPCOpcodes.FRAME, {
            cmd: 'SET_ACTIVITY',
            data: activity ?? {},
            evt: null,
            nonce: frame.nonce,
          });
        }
        break;
      }

      case IPCOpcodes.CLOSE: {
        socket.destroy();
        break;
      }
    }
  }
}

export default DiscordIPCServer;
