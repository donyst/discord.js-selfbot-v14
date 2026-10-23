import { Buffer } from 'node:buffer';
import crypto from 'node:crypto';
import EventEmitter from 'node:events';
import { fetch } from 'undici';
import WebSocket from 'ws';
import qrcode from 'qrcode';
import { UserAgent } from './Constants.js';
import { ClientFingerprintManager } from './ClientFingerprintManager.js';
import type { Snowflake } from '../types/index.js';

const baseURL = 'https://discord.com/ra/';
const wsURL = 'wss://remote-auth-gateway.discord.gg/?v=2';

export const receiveEvent = {
  HELLO: 'hello',
  NONCE_PROOF: 'nonce_proof',
  PENDING_REMOTE_INIT: 'pending_remote_init',
  FINGERPRINT: 'fingerprint',
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
  QR_CODE: 'qrCode',
  ERROR: 'error',
  CANCEL: 'cancel',
  WAIT_SCAN: 'pending',
  SCAN: 'scan',
  FINISH: 'finish',
  AUTHENTICATED: 'authenticated',
  CLOSED: 'closed',
  DEBUG: 'debug',
} as const;

export interface UserRaw {
  id: Snowflake;
  username: string;
  discriminator: string;
  avatar: string | null;
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

export interface ClientFingerprintContext {
  fingerprint?: string;
  installationId?: string;
  cookies: string[];
  superProperties: string;
}

export interface QRLoginOptions {
  /**
   * Whether to automatically print the QR code in the terminal using ASCII blocks.
   * @default true
   */
  terminal?: boolean;
  /**
   * Custom callback invoked when the QR code is generated.
   * Provides the mobile Auth URL and base64 Data URL.
   */
  onQR?: (qrUrl: string, qrDataUrl: string) => void;
  /**
   * Custom callback invoked when a user scans the QR code on mobile.
   */
  onScan?: (user: UserRaw | null) => void;
  /**
   * Timeout in milliseconds before the QR login session expires.
   * @default 120000 (2 minutes)
   */
  timeout?: number;
}

/**
 * Discord QR Code Remote Authentication Gateway Client (v2 protocol).
 * Enables seamless login via Discord mobile app QR scan without entering credentials.
 */
export class DiscordAuthWebsocket extends EventEmitter {
  #ws: WebSocket | null = null;
  #heartbeatTimer: NodeJS.Timeout | null = null;
  #expire: Date | null = null;
  #publicKey: Buffer | null = null;
  #privateKey: string | null = null;
  #ticket: string | null = null;
  #fingerprint = '';
  #user: UserRaw | null = null;
  #clientFingerprintPromise: Promise<ClientFingerprintContext> | null = null;

  public token = '';

  public constructor() {
    super();
  }

  public get AuthURL(): string {
    return baseURL + this.#fingerprint;
  }

  public get expire(): Date | null {
    return this.#expire;
  }

  /**
   * Deprecated spelling preserved for backward compatibility.
   * @deprecated Use `expire` instead.
   */
  public get exprire(): Date | null {
    return this.expire;
  }

  public get user(): UserRaw | null {
    return this.#user;
  }

  public get fingerprint(): string {
    return this.#fingerprint;
  }

  /**
   * Pre-flight: Fetches server-signed client fingerprint, installation ID,
   * and security cookies from /api/v9/experiments.
   */
  public static async fetchClientFingerprint(superPropertiesBase64?: string): Promise<ClientFingerprintContext> {
    const sp =
      superPropertiesBase64 ||
      ClientFingerprintManager.getSuperPropertiesBase64();
    let fingerprint: string | undefined;
    let installationId: string | undefined;
    const cookies: string[] = [];

    try {
      const res = await fetch('https://discord.com/api/v9/experiments', {
        headers: {
          'User-Agent': UserAgent,
          'X-Super-Properties': sp,
          Origin: 'https://discord.com',
          Referer: 'https://discord.com/login',
          Accept: '*/*',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });

      const setCookies = (res.headers as { getSetCookie?: () => string[] }).getSetCookie?.() || [];
      for (const sc of setCookies) {
        const pair = sc.split(';')[0]?.trim();
        if (pair) cookies.push(pair);
      }

      if (res.ok) {
        const body = (await res.json()) as { fingerprint?: string; installation?: string };
        fingerprint = body.fingerprint;
        installationId = body.installation;
      }
    } catch {
      // Graceful fallback
    }

    return {
      fingerprint,
      installationId,
      cookies,
      superProperties: sp,
    };
  }

  #createWebSocket(url: string): void {
    this.#clientFingerprintPromise = DiscordAuthWebsocket.fetchClientFingerprint();
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
      this.emit(Event.DEBUG, '[WS] Remote Auth Gateway Connected');
    });

    this.#ws.on('close', () => {
      this.#stopHeartbeat();
      this.emit(Event.DEBUG, '[WS] Remote Auth Gateway Connection Closed');
      this.emit(Event.CLOSED);
    });

    this.#ws.on('message', (message: WebSocket.RawData) => {
      this.#handleMessage(message);
    });
  }

  #handleMessage(rawMessage: WebSocket.RawData): void {
    try {
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

        case receiveEvent.PENDING_REMOTE_INIT:
        case receiveEvent.FINGERPRINT: {
          const initPayload = message as unknown as PendingRemoteInitPayload;
          void this.#pendingRemoteInit(initPayload.fingerprint);
          break;
        }

        case receiveEvent.HEARTBEAT_ACK: {
          this.emit(Event.DEBUG, '[WS] Heartbeat ACK received');
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
    } catch (err) {
      this.emit(Event.ERROR, err instanceof Error ? err : new Error(String(err)));
    }
  }

  #send(op: string, data?: Record<string, unknown>): void {
    if (!this.#ws || this.#ws.readyState !== WebSocket.OPEN) return;
    const payload: Record<string, unknown> = { op, ...data };
    this.#ws.send(JSON.stringify(payload));
  }

  #startHeartbeat(interval: number): void {
    this.#stopHeartbeat();
    this.#heartbeatTimer = setInterval(() => {
      this.#send(sendEvent.HEARTBEAT);
    }, interval);
    this.#heartbeatTimer.unref?.();
  }

  #stopHeartbeat(): void {
    if (this.#heartbeatTimer) {
      clearInterval(this.#heartbeatTimer);
      this.#heartbeatTimer = null;
    }
  }

  #ready(data: HelloPayload): void {
    this.emit(Event.DEBUG, '[WS] Server Hello received. Initializing RSA key pair...');
    this.#expire = new Date(Date.now() + data.timeout_ms);
    this.#startHeartbeat(data.heartbeat_interval);
    this.#createKey();
    this.#init();
  }

  #createKey(): void {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'der' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    this.#privateKey = privateKey;
    this.#publicKey = publicKey;
  }

  #init(): void {
    if (!this.#publicKey) return;
    const encodedPublicKey = this.#publicKey.toString('base64');
    this.#send(sendEvent.INIT, { encoded_public_key: encodedPublicKey });
  }

  #receiveNonceProof(data: NonceProofPayload): void {
    if (!this.#privateKey) return;
    const decryptedNonce = crypto.privateDecrypt(
      {
        key: this.#privateKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256',
      },
      Buffer.from(data.encrypted_nonce, 'base64'),
    );

    // Discord v2 Remote Auth protocol: base64url encoding of the raw decrypted nonce
    const nonce = decryptedNonce.toString('base64url');
    this.#send(sendEvent.NONCE_PROOF, { nonce });
  }

  async #pendingRemoteInit(fingerprint: string): Promise<void> {
    this.#fingerprint = fingerprint;
    const qrUrl = baseURL + fingerprint;
    let qrDataUrl = '';

    try {
      qrDataUrl = await qrcode.toDataURL(qrUrl, {
        margin: 2,
        color: { dark: '#5865F2', light: '#FFFFFF' },
        width: 280,
      });
    } catch {
      // ignore
    }

    this.emit(Event.READY, this);
    this.emit(Event.QR_CODE, qrUrl, qrDataUrl);
  }

  #pendingLogin(data: PendingTicketPayload): void {
    if (!this.#privateKey) return;
    try {
      const decryptedUser = crypto.privateDecrypt(
        {
          key: this.#privateKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha256',
        },
        Buffer.from(data.encrypted_user_payload, 'base64'),
      );
      const userStr = decryptedUser.toString('utf-8');
      const match = userStr.match(/^(\d+):(\d{1,4}):([a-zA-Z0-9_]+):(.*)$/);
      if (match) {
        this.#user = {
          id: match[1]!,
          discriminator: match[2]!,
          avatar: match[3] === '0' ? null : match[3]!,
          username: match[4]!,
        };
      } else {
        const parts = userStr.split(':');
        this.#user = {
          id: parts[0] || '',
          discriminator: parts[1] || '0',
          avatar: parts[2] === '0' ? null : (parts[2] || null),
          username: parts[3] || 'Discord User',
        };
      }
    } catch {
      this.#user = null;
    }

    this.emit(Event.WAIT_SCAN, this.#user);
    this.emit(Event.SCAN, this.#user);
  }

  async #findRealToken(): Promise<boolean> {
    if (!this.#privateKey) return false;

    try {
      const fpData = await (this.#clientFingerprintPromise || DiscordAuthWebsocket.fetchClientFingerprint());

      const headers: Record<string, string> = {
        Accept: '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Content-Type': 'application/json',
        Origin: 'https://discord.com',
        Referer: 'https://discord.com/login',
        'User-Agent': UserAgent,
        'X-Super-Properties': fpData.superProperties,
        'X-Discord-Locale': 'en-US',
        'X-Discord-Timezone': Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      };

      if (fpData.fingerprint) {
        headers['X-Fingerprint'] = fpData.fingerprint;
      }
      if (fpData.installationId) {
        headers['X-Installation-Id'] = fpData.installationId;
      }
      if (fpData.cookies.length > 0) {
        headers['Cookie'] = fpData.cookies.join('; ');
      }

      const response = await fetch('https://discord.com/api/v9/users/@me/remote-auth/login', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ticket: this.#ticket,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Failed to exchange remote auth ticket [${response.status}]: ${errText}`);
      }

      const res = (await response.json()) as { encrypted_token?: string };
      if (!res.encrypted_token) {
        throw new Error('No encrypted_token returned from Discord remote auth login API');
      }

      const decryptedToken = crypto.privateDecrypt(
        {
          key: this.#privateKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha256',
        },
        Buffer.from(res.encrypted_token, 'base64'),
      );

      this.token = decryptedToken.toString('utf-8');
      this.emit(Event.FINISH, this.token);
      this.emit(Event.AUTHENTICATED, this.token);
      this.destroy();
      return true;
    } catch (err) {
      this.emit(Event.ERROR, err instanceof Error ? err : new Error(String(err)));
      this.destroy();
      return false;
    }
  }

  public connect(client?: RemoteAuthClient): Promise<string | void> {
    this.#createWebSocket(wsURL);
    if (client) {
      return this.#awaitLogin(client);
    }
    return Promise.resolve();
  }

  #awaitLogin(client: RemoteAuthClient): Promise<string> {
    return new Promise((resolve, reject) => {
      this.once(Event.FINISH, (token: string) => {
        client
          .login(token)
          .then(() => resolve(token))
          .catch(reject);
      });
      this.once(Event.ERROR, (err: Error) => {
        reject(err);
      });
      this.once(Event.CANCEL, () => {
        reject(new Error('Remote authentication session was cancelled on device.'));
      });
    });
  }

  /**
   * Generates and prints the QR code in terminal ASCII art.
   */
  public generateQR(): void {
    if (!this.#fingerprint) return;
    void this.printTerminalQr();
  }

  /**
   * Prints the QR code directly to the terminal with styled formatting.
   */
  public async printTerminalQr(options?: { small?: boolean }): Promise<string> {
    if (!this.#fingerprint) return '';
    const small = options?.small ?? true;

    return new Promise((resolve, reject) => {
      qrcode.toString(this.AuthURL, { type: 'terminal', small }, (err, text) => {
        if (err) return reject(err);
        console.log('\n================ Scan on Discord Mobile ================');
        console.log(text);
        console.log(`Link: ${this.AuthURL}\n`);
        resolve(text);
      });
    });
  }

  /**
   * Returns the QR code encoded as an image Data URL (data:image/png;base64,...).
   */
  public async getDataURL(): Promise<string> {
    if (!this.#fingerprint) return '';
    return qrcode.toDataURL(this.AuthURL, {
      margin: 2,
      color: { dark: '#5865F2', light: '#FFFFFF' },
      width: 280,
    });
  }

  public destroy(): void {
    this.#stopHeartbeat();
    if (!this.#ws) return;
    try {
      this.#ws.close();
    } catch {
      // ignore
    }
    this.#ws = null;
    this.emit(Event.DEBUG, '[WS] WebSocket closed.');
    this.emit(Event.CLOSED);
  }

  public static decryptUser(payload: string): UserRaw {
    const values = payload.split(':');
    return {
      id: values[0]!,
      discriminator: values[1]!,
      avatar: values[2] === '0' ? null : (values[2] || null),
      username: values[3] || 'Discord User',
    };
  }
}

export default DiscordAuthWebsocket;
