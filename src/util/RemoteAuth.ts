import { Buffer } from 'node:buffer';
import crypto from 'node:crypto';
import EventEmitter from 'node:events';
import { StringDecoder } from 'node:string_decoder';
import { fetch } from 'undici';
import WebSocket from 'ws';
import qrcode from 'qrcode';
import { UserAgent } from './Constants.js';
import { Options } from './Options.js';
import type { Snowflake } from '../types/index.js';

const defaultClientOptions = Options.createDefault();

const baseURL = 'https://discord.com/ra/';
const wsURL = 'wss://remote-auth-gateway.discord.gg/?v=2';

export const receiveEvent = {
  HELLO: 'hello',
  NONCE_PROOF: 'nonce_proof',
  PENDING_REMOTE_INIT: 'pending_remote_init',
  HEARTBEAT_ACK: 'heartbeat_ack',
  PENDING_TICKET: 'pending_ticket',
  CANCEL: 'cancel',
  PENDING_LOGIN: 'pending_login',
} as const;

export const sendEvent = {
  INIT: 'init',
  NONCE_PROOF: 'nonce_proof',
  HEARTBEAT: 'heartbeat',
} as const;

export const Event = {
  READY: 'ready',
  ERROR: 'error',
  CANCEL: 'cancel',
  WAIT_SCAN: 'pending',
  FINISH: 'finish',
  CLOSED: 'closed',
  DEBUG: 'debug',
} as const;

export interface UserRaw {
  id: Snowflake;
  username: string;
  discriminator: string;
  avatar: string;
}

export interface HelloPayload {
  timeout_ms: number;
  heartbeat_interval: number;
}

export interface NonceProofPayload {
  encrypted_nonce: string;
}

export interface PendingRemoteInitPayload {
  fingerprint: string;
}

export interface PendingTicketPayload {
  encrypted_user_payload: string;
}

export interface PendingLoginPayload {
  ticket: string;
}

export interface RemoteAuthClient {
  login: (token: string) => Promise<string>;
}

/**
 * Discord QR Code Remote Authentication Websocket
 */
export class DiscordAuthWebsocket extends EventEmitter {
  #ws: WebSocket | null = null;
  #heartbeatInterval: number | null = null;
  #expire: Date | null = null;
  #publicKey: string | null = null;
  #privateKey: string | null = null;
  #ticket: string | null = null;
  #fingerprint = '';
  #userDecryptString = '';

  public token = '';

  public constructor() {
    super();
  }

  public get AuthURL(): string {
    return baseURL + this.#fingerprint;
  }

  public get exprire(): Date | null {
    return this.#expire;
  }

  public get user(): UserRaw | null {
    return this.#userDecryptString ? DiscordAuthWebsocket.decryptUser(this.#userDecryptString) : null;
  }

  #createWebSocket(url: string): void {
    this.#ws = new WebSocket(url, {
      headers: {
        Origin: 'https://discord.com',
        'User-Agent': UserAgent,
      },
    });
    this.#handleWebSocket();
  }

  #handleWebSocket(): void {
    if (!this.#ws) return;

    this.#ws.on('error', (error: Error) => {
      this.emit(Event.ERROR, error);
    });

    this.#ws.on('open', () => {
      this.emit(Event.DEBUG, '[WS] Client Connected');
    });

    this.#ws.on('close', () => {
      this.emit(Event.DEBUG, '[WS] Connection closed');
    });

    this.#ws.on('message', (message: WebSocket.RawData) => {
      this.#handleMessage(message);
    });
  }

  #handleMessage(rawMessage: WebSocket.RawData): void {
    const text = typeof rawMessage === 'string' ? rawMessage : rawMessage.toString('utf-8');
    const message = JSON.parse(text) as { op: string } & Record<string, unknown>;

    switch (message.op) {
      case receiveEvent.HELLO: {
        this.#ready(message as unknown as HelloPayload);
        break;
      }

      case receiveEvent.NONCE_PROOF: {
        this.#receiveNonceProof(message as unknown as NonceProofPayload);
        break;
      }

      case receiveEvent.PENDING_REMOTE_INIT: {
        const initPayload = message as unknown as PendingRemoteInitPayload;
        this.#fingerprint = initPayload.fingerprint;
        this.emit(Event.READY, this);
        break;
      }

      case receiveEvent.HEARTBEAT_ACK: {
        this.emit(Event.DEBUG, 'Heartbeat acknowledged.');
        this.#heartbeatAck();
        break;
      }

      case receiveEvent.PENDING_TICKET: {
        this.#pendingLogin(message as unknown as PendingTicketPayload);
        break;
      }

      case receiveEvent.CANCEL: {
        this.emit(Event.CANCEL, this);
        this.destroy();
        break;
      }

      case receiveEvent.PENDING_LOGIN: {
        const loginPayload = message as unknown as PendingLoginPayload;
        this.#ticket = loginPayload.ticket;
        void this.#findRealToken();
        break;
      }
    }
  }

  #send(op: string, data?: Record<string, unknown>): void {
    if (!this.#ws || this.#ws.readyState !== WebSocket.OPEN) return;
    const payload: Record<string, unknown> = { op, ...data };
    this.#ws.send(JSON.stringify(payload));
  }

  #heartbeatAck(): void {
    if (!this.#heartbeatInterval) return;
    setTimeout(() => {
      this.#send(sendEvent.HEARTBEAT);
    }, this.#heartbeatInterval).unref();
  }

  #ready(data: HelloPayload): void {
    this.emit(Event.DEBUG, 'Attempting server handshake...');
    this.#expire = new Date(Date.now() + data.timeout_ms);
    this.#heartbeatInterval = data.heartbeat_interval;
    this.#createKey();
    this.#heartbeatAck();
    this.#init();
  }

  #createKey(): void {
    const key = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem',
      },
      privateKeyEncoding: {
        type: 'pkcs1',
        format: 'pem',
      },
    });
    this.#privateKey = key.privateKey;
    this.#publicKey = key.publicKey;
  }

  #encodePublicKey(): string {
    if (!this.#publicKey) return '';
    const decoder = new StringDecoder('utf-8');
    const pubKey = decoder.write(Buffer.from(this.#publicKey));
    return pubKey.split('\n').slice(1, -2).join('');
  }

  #init(): void {
    const publicKey = this.#encodePublicKey();
    this.#send(sendEvent.INIT, { encoded_public_key: publicKey });
  }

  #receiveNonceProof(data: NonceProofPayload): void {
    const nonce = data.encrypted_nonce;
    const decryptedNonce = this.#decryptPayload(nonce);
    const proof = crypto
      .createHash('sha256')
      .update(decryptedNonce)
      .digest()
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+/, '')
      .replace(/\s+$/, '');
    this.#send(sendEvent.NONCE_PROOF, { proof });
  }

  #decryptPayload(encryptedPayload: string): Buffer {
    const payload = Buffer.from(encryptedPayload, 'base64');
    const decoder = new StringDecoder('utf-8');
    const privateKey = decoder.write(Buffer.from(this.#privateKey!));
    return crypto.privateDecrypt(
      {
        key: privateKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256',
      },
      payload,
    );
  }

  #pendingLogin(data: PendingTicketPayload): void {
    const userData = this.#decryptPayload(data.encrypted_user_payload);
    this.#userDecryptString = userData.toString();
    this.emit(Event.WAIT_SCAN, this.user);
  }

  #awaitLogin(client: RemoteAuthClient): Promise<string> {
    return new Promise(resolve => {
      this.once(Event.FINISH, (token: string) => {
        resolve(client.login(token));
      });
    });
  }

  public connect(client?: RemoteAuthClient): Promise<string | void> {
    this.#createWebSocket(wsURL);
    if (client) {
      return this.#awaitLogin(client);
    }
    return Promise.resolve();
  }

  public destroy(): void {
    if (!this.#ws) return;
    this.#ws.close();
    this.emit(Event.DEBUG, 'WebSocket closed.');
    this.emit(Event.CLOSED);
  }

  public generateQR(): void {
    if (!this.#fingerprint) return;
    qrcode.toString(this.AuthURL, { type: 'utf8', errorCorrectionLevel: 'L' }, (err: unknown, url: string) => {
      if (!err && url) {
        console.log(url);
      }
    });
  }

  async #findRealToken(): Promise<boolean> {
    try {
      const response = await fetch('https://discord.com/api/v9/users/@me/remote-auth/login', {
        method: 'POST',
        headers: {
          Accept: '*/*',
          'Accept-Language': 'en-US',
          'Content-Type': 'application/json',
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'same-origin',
          'X-Debug-Options': 'bugReporterEnabled',
          'X-Super-Properties': Buffer.from(JSON.stringify(defaultClientOptions.ws.properties), 'ascii').toString(
            'base64',
          ),
          'X-Discord-Locale': 'en-US',
          'User-Agent': UserAgent,
          Referer: 'https://discord.com/channels/@me',
          Connection: 'keep-alive',
          Origin: 'https://discord.com',
        },
        body: JSON.stringify({
          ticket: this.#ticket,
        }),
      });

      const res = (await response.json()) as { encrypted_token?: string };
      if (res.encrypted_token) {
        this.token = this.#decryptPayload(res.encrypted_token).toString();
      }
      this.emit(Event.FINISH, this.token);
      this.destroy();
      return true;
    } catch {
      return false;
    }
  }

  public static decryptUser(payload: string): UserRaw {
    const values = payload.split(':');
    return {
      id: values[0]!,
      discriminator: values[1]!,
      avatar: values[2]!,
      username: values[3]!,
    };
  }
}

export default DiscordAuthWebsocket;
