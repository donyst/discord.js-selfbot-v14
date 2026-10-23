import { Buffer } from 'node:buffer';
import { setTimeout, clearTimeout } from 'node:timers';
import { FormData, buildConnector, Client as UndiciClient, ProxyAgent, type Dispatcher } from 'undici';
import type { BaseAPIRequest, BaseAPIRequestOptions } from './HTTPError.js';

export const CIPHERS = [
  'TLS_AES_128_GCM_SHA256',
  'TLS_AES_256_GCM_SHA384',
  'TLS_CHACHA20_POLY1305_SHA256',
  'ECDHE-ECDSA-AES128-GCM-SHA256',
  'ECDHE-RSA-AES128-GCM-SHA256',
  'ECDHE-ECDSA-AES256-GCM-SHA384',
  'ECDHE-RSA-AES256-GCM-SHA384',
  'ECDHE-ECDSA-CHACHA20-POLY1305',
  'ECDHE-RSA-CHACHA20-POLY1305',
  'ECDHE-RSA-AES128-SHA',
  'ECDHE-RSA-AES256-SHA',
  'AES128-GCM-SHA256',
  'AES256-GCM-SHA384',
  'AES128-SHA',
  'AES256-SHA',
];

export interface RESTManagerLike {
  client: {
    options: {
      http: {
        version: number;
        api: string;
        headers: Record<string, string>;
        agent?: unknown;
      };
      ws: {
        properties: {
          browser_user_agent?: string;
          [key: string]: unknown;
        };
      };
      restRequestTimeout: number;
    };
  };
  getAuth(): string;
  fetch: (url: string, init?: unknown) => Promise<Response>;
}

let agent: Dispatcher | null = null;

export class APIRequest implements BaseAPIRequest {
  public rest: RESTManagerLike;
  public client: RESTManagerLike['client'];
  public method: string;
  public route: string;
  public options: BaseAPIRequestOptions;
  public retries = 0;
  public fullUserAgent: string;
  public path: string;

  public constructor(
    rest: RESTManagerLike,
    method: string,
    path: string,
    options: BaseAPIRequestOptions,
  ) {
    this.rest = rest;
    this.client = rest.client;
    this.method = method;
    this.route = options.route ?? path;
    this.options = options;

    this.fullUserAgent =
      this.client.options.http.headers['User-Agent'] ||
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) discord/1.0.9265 Chrome/134.0.6998.205 Electron/35.3.0 Safari/537.36';

    this.client.options.ws.properties.browser_user_agent = this.fullUserAgent;

    let queryString = '';
    if (options.query) {
      const query = Object.entries(options.query)
        .filter(([, value]) => value !== null && typeof value !== 'undefined')
        .flatMap(([key, value]) =>
          Array.isArray(value) ? value.map(v => [key, String(v)]) : [[key, String(value)]],
        );
      queryString = new URLSearchParams(query).toString();
    }
    this.path = `${path}${queryString ? `?${queryString}` : ''}`;
  }

  public async make(captchaKey?: string, captchaRqToken?: string): Promise<Response> {
    if (!agent) {
      const customAgent = this.client.options.http.agent as { uri?: string } | undefined;
      if (!customAgent?.uri) {
        agent = new UndiciClient('https://discord.com', {
          connect: buildConnector({ ciphers: CIPHERS.join(':') }),
        });
      } else {
        agent = new ProxyAgent({
          uri: customAgent.uri,
          connect: buildConnector({ ciphers: CIPHERS.join(':') }),
        });
      }
    }

    const API =
      this.options.versioned === false
        ? this.client.options.http.api
        : `${this.client.options.http.api}/v${this.client.options.http.version}`;
    const url = API + this.path;

    let headers: Record<string, string> = {
      accept: '*/*',
      'accept-language': 'en-US',
      priority: 'u=1, i',
      referer: 'https://discord.com/channels/@me',
      'sec-ch-ua': '"Not/A)Brand";v="99", "Chromium";v="148"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin',
      'x-discord-locale': 'en-US',
      'x-discord-timezone': Intl.DateTimeFormat().resolvedOptions().timeZone,
      'x-super-properties': Buffer.from(
        JSON.stringify(this.client.options.ws.properties),
        'ascii',
      ).toString('base64'),
      origin: 'https://discord.com',
      'x-debug-options': 'bugReporterEnabled',
      ...this.client.options.http.headers,
      'User-Agent': this.fullUserAgent,
    };

    if (this.options.auth !== false) {
      headers.Authorization = this.rest.getAuth();
    }
    if (this.options.reason) {
      headers['X-Audit-Log-Reason'] = encodeURIComponent(this.options.reason);
    }
    if (this.options.headers) {
      headers = Object.assign(headers, this.options.headers);
    }

    if (this.options.webhook === true) {
      headers = {
        'User-Agent': this.fullUserAgent,
      };
    }

    if (this.options.DiscordContext) {
      headers['X-Context-Properties'] = Buffer.from(
        JSON.stringify(this.options.DiscordContext),
        'utf8',
      ).toString('base64');
    }

    if (this.options.mfaToken) {
      headers['X-Discord-Mfa-Authorization'] = this.options.mfaToken;
    }

    if (captchaKey) headers['X-Captcha-Key'] = captchaKey;
    if (captchaRqToken) headers['X-Captcha-Rqtoken'] = captchaRqToken;

    let body: BodyInit | undefined;
    if (this.options.files?.length) {
      const formData = new FormData();
      for (const [index, file] of this.options.files.entries()) {
        if (file?.file) {
          formData.set(file.key ?? `files[${index}]`, {
            [Symbol.toStringTag]: 'File',
            name: file.name,
            stream: () => file.file,
          } as unknown as string);
        }
      }
      if (typeof this.options.data !== 'undefined') {
        if (this.options.dontUsePayloadJSON && typeof this.options.data === 'object') {
          for (const [key, value] of Object.entries(this.options.data as Record<string, unknown>)) {
            formData.append(key, String(value));
          }
        } else {
          formData.append('payload_json', JSON.stringify(this.options.data));
        }
      }
      body = formData as unknown as BodyInit;
    } else if (this.options.data !== null && typeof this.options.data !== 'undefined') {
      if (this.options.usePayloadJSON) {
        const formData = new FormData();
        formData.append('payload_json', JSON.stringify(this.options.data));
        body = formData as unknown as BodyInit;
      } else {
        body = JSON.stringify(this.options.data);
        headers['Content-Type'] = 'application/json';
      }
    }

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.client.options.restRequestTimeout,
    ).unref();

    return this.rest
      .fetch(url, {
        method: this.method.toUpperCase(),
        headers,
        body,
        signal: controller.signal,
        redirect: 'follow',
        dispatcher: agent,
        credentials: 'include',
      })
      .finally(() => clearTimeout(timeout));
  }
}

export default APIRequest;
