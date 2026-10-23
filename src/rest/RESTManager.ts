import { setInterval } from 'node:timers';
import { Collection } from '@discordjs/collection';
import makeFetchCookie from 'fetch-cookie';
import { CookieJar } from 'tough-cookie';
import { fetch as fetchOriginal } from 'undici';
import { APIRequest, type RESTManagerLike } from './APIRequest.js';
import { buildRoute, type RouteProxy, type RouteManager } from './APIRouter.js';
import { RequestHandler } from './RequestHandler.js';
import { BaseAPIRequestOptions } from './HTTPError.js';
import { Endpoints } from '../util/Constants.js';

export interface ClientWithREST {
  token?: string | null;
  accessToken?: string | null;
  options: {
    restGlobalRateLimit: number;
    restSweepInterval: number;
    restTimeOffset: number;
    restRequestTimeout: number;
    retryLimit: number;
    invalidRequestWarningInterval: number;
    rejectOnRateLimit?: ((data: unknown) => boolean | Promise<boolean>) | string[];
    captchaSolver?: (data: unknown, userAgent: string) => Promise<string>;
    captchaRetryLimit: number;
    TOTPKey?: string | null;
    http: {
      version: number;
      api: string;
      cdn: string;
      headers: Record<string, string>;
      agent?: unknown;
    };
    ws: {
      properties: {
        browser_user_agent?: string;
        [key: string]: unknown;
      };
    };
  };
  authenticator?: {
    generate(secret: string): string;
  };
  api: RouteProxy & {
    mfa: {
      finish: {
        post: (options: Record<string, unknown>) => Promise<unknown>;
      };
    };
  };
  listenerCount(event: string): number;
  emit(event: string, ...args: unknown[]): boolean;
}

export class RESTManager implements RESTManagerLike, RouteManager {
  public client: ClientWithREST;
  public handlers: Collection<string, RequestHandler>;
  public versioned = true;
  public globalLimit: number;
  public globalRemaining: number;
  public globalReset: number | null = null;
  public globalDelay: Promise<void> | null = null;
  public cookieJar: CookieJar;
  public fetch: (url: string, init?: unknown) => Promise<Response>;
  public sweepInterval?: NodeJS.Timeout;

  public constructor(client: ClientWithREST) {
    this.client = client;
    this.handlers = new Collection();
    this.globalLimit =
      client.options.restGlobalRateLimit > 0 ? client.options.restGlobalRateLimit : Infinity;
    this.globalRemaining = this.globalLimit;
    this.cookieJar = new CookieJar();
    // Wrap undici fetch with tough-cookie
    const wrapFetchCookie =
      typeof makeFetchCookie === 'function'
        ? (makeFetchCookie as unknown as (f: typeof fetchOriginal, j: CookieJar) => typeof fetchOriginal)
        : (makeFetchCookie as unknown as { default: (f: typeof fetchOriginal, j: CookieJar) => typeof fetchOriginal }).default;
    this.fetch = wrapFetchCookie(
      fetchOriginal,
      this.cookieJar,
    ) as unknown as (url: string, init?: unknown) => Promise<Response>;

    if (client.options.restSweepInterval > 0) {
      this.sweepInterval = setInterval(() => {
        this.handlers.sweep(handler => handler._inactive);
      }, client.options.restSweepInterval * 1_000).unref();
    }
  }

  public get api(): RouteProxy {
    return buildRoute(this);
  }

  public get cdn(): ReturnType<typeof Endpoints.CDN> {
    return Endpoints.CDN(this.client.options.http.cdn);
  }

  public getAuth(): string {
    const token = this.client.token ?? this.client.accessToken;
    if (token) return token.replace(/Bot /g, '');
    throw new Error('[TOKEN_MISSING]: Request to use token, but token was unavailable to the client.');
  }

  public request(
    method: string,
    url: string,
    options: BaseAPIRequestOptions = { route: url },
  ): Promise<unknown> {
    const apiRequest = new APIRequest(this, method, url, options);
    let handler = this.handlers.get(apiRequest.route);

    if (!handler) {
      handler = new RequestHandler(this);
      this.handlers.set(apiRequest.route, handler);
    }

    return handler.push(apiRequest);
  }

  public get endpoint(): string {
    return this.client.options.http.api;
  }
}

export default RESTManager;
