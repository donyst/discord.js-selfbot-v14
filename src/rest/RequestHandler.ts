import { setTimeout } from 'node:timers';
import { setTimeout as sleep } from 'node:timers/promises';
import { AsyncQueue } from '@sapphire/async-queue';
import { DiscordAPIError, type DiscordAPIErrorResponse } from './DiscordAPIError.js';
import { HTTPError, type BaseAPIRequest } from './HTTPError.js';
import { RateLimitError, type RateLimitData } from './RateLimitError.js';
import type { APIRequest } from './APIRequest.js';
import type { RESTManager } from './RESTManager.js';

const captchaMessages = [
  'incorrect-captcha',
  'response-already-used',
  'captcha-required',
  'invalid-input-response',
  'invalid-response',
  'You need to update your app',
  'response-already-used-error',
  'rqkey-mismatch',
  'sitekey-secret-mismatch',
];

async function parseResponse(res: Response): Promise<unknown> {
  const contentType = res.headers.get('content-type');
  if (contentType?.startsWith('application/json')) {
    return res.json();
  }
  return res.arrayBuffer();
}

function getAPIOffset(serverDate: string | null): number {
  return serverDate ? new Date(serverDate).getTime() - Date.now() : 0;
}

function calculateReset(
  reset: string | null,
  resetAfter: string | null,
  serverDate: string | null,
): number {
  if (resetAfter) {
    return Date.now() + Number(resetAfter) * 1_000;
  }
  return new Date(Number(reset) * 1_000).getTime() - getAPIOffset(serverDate);
}

let invalidCount = 0;
let invalidCountResetTime: number | null = null;

export class RequestHandler {
  public manager: RESTManager;
  public queue: AsyncQueue;
  public reset = -1;
  public remaining = -1;
  public limit = -1;

  public constructor(manager: RESTManager) {
    this.manager = manager;
    this.queue = new AsyncQueue();
  }

  public async push(request: APIRequest): Promise<unknown> {
    await this.queue.wait();
    try {
      return await this.execute(request);
    } finally {
      this.queue.shift();
    }
  }

  public get globalLimited(): boolean {
    return (
      this.manager.globalRemaining <= 0 &&
      this.manager.globalReset !== null &&
      Date.now() < this.manager.globalReset
    );
  }

  public get localLimited(): boolean {
    return this.remaining <= 0 && Date.now() < this.reset;
  }

  public get limited(): boolean {
    return this.globalLimited || this.localLimited;
  }

  public get _inactive(): boolean {
    return this.queue.remaining === 0 && !this.limited;
  }

  public globalDelayFor(ms: number): Promise<void> {
    return new Promise(resolve => {
      setTimeout(() => {
        this.manager.globalDelay = null;
        resolve();
      }, ms).unref();
    });
  }

  public async onRateLimit(
    request: BaseAPIRequest,
    limit: number,
    timeout: number,
    isGlobal: boolean,
  ): Promise<void> {
    const { options } = this.manager.client;
    if (!options.rejectOnRateLimit) return;

    const rateLimitData: RateLimitData = {
      timeout,
      limit,
      method: request.method,
      path: request.path,
      route: request.options.route ?? request.path,
      global: isGlobal,
    };

    const shouldThrow =
      typeof options.rejectOnRateLimit === 'function'
        ? await options.rejectOnRateLimit(rateLimitData)
        : Array.isArray(options.rejectOnRateLimit) &&
          options.rejectOnRateLimit.some(route =>
            rateLimitData.route.startsWith(route.toLowerCase()),
          );

    if (shouldThrow) {
      throw new RateLimitError(rateLimitData);
    }
  }

  public async execute(
    request: APIRequest,
    captchaKey?: string,
    captchaToken?: string,
  ): Promise<unknown> {
    while (this.limited) {
      const isGlobal = this.globalLimited;
      let limit: number;
      let timeout: number;
      let delayPromise: Promise<void>;

      if (isGlobal) {
        limit = this.manager.globalLimit;
        timeout =
          (this.manager.globalReset ?? Date.now()) +
          this.manager.client.options.restTimeOffset -
          Date.now();
      } else {
        limit = this.limit;
        timeout = this.reset + this.manager.client.options.restTimeOffset - Date.now();
      }

      if (this.manager.client.listenerCount('rateLimit')) {
        this.manager.client.emit('rateLimit', {
          timeout,
          limit,
          method: request.method,
          path: request.path,
          route: request.route,
          global: isGlobal,
        });
      }

      if (isGlobal) {
        if (!this.manager.globalDelay) {
          this.manager.globalDelay = this.globalDelayFor(timeout);
        }
        delayPromise = this.manager.globalDelay;
      } else {
        delayPromise = sleep(timeout);
      }

      await this.onRateLimit(request, limit, timeout, isGlobal);
      await delayPromise;
    }

    if (!this.manager.globalReset || this.manager.globalReset < Date.now()) {
      this.manager.globalReset = Date.now() + 1_000;
      this.manager.globalRemaining = this.manager.globalLimit;
    }
    this.manager.globalRemaining--;

    if (this.manager.client.listenerCount('apiRequest')) {
      this.manager.client.emit('apiRequest', {
        method: request.method,
        path: request.path,
        route: request.route,
        options: request.options,
        retries: request.retries,
      });
    }

    let res: Response;
    try {
      res = await request.make(captchaKey, captchaToken);
    } catch (error: unknown) {
      const err = error as Error & { status?: number };
      if (request.retries === this.manager.client.options.retryLimit) {
        throw new HTTPError(err.message, err.constructor.name, err.status, request);
      }
      request.retries++;
      return this.execute(request);
    }

    if (this.manager.client.listenerCount('apiResponse')) {
      this.manager.client.emit(
        'apiResponse',
        {
          method: request.method,
          path: request.path,
          route: request.route,
          options: request.options,
          retries: request.retries,
        },
        res.clone(),
      );
    }

    let sublimitTimeout: number | undefined;
    if (res.headers) {
      const serverDate = res.headers.get('date');
      const limit = res.headers.get('x-ratelimit-limit');
      const remaining = res.headers.get('x-ratelimit-remaining');
      const reset = res.headers.get('x-ratelimit-reset');
      const resetAfter = res.headers.get('x-ratelimit-reset-after');
      this.limit = limit ? Number(limit) : Infinity;
      this.remaining = remaining ? Number(remaining) : 1;
      this.reset = reset || resetAfter ? calculateReset(reset, resetAfter, serverDate) : Date.now();

      if (!resetAfter && request.route.includes('reactions') && serverDate) {
        this.reset = new Date(serverDate).getTime() - getAPIOffset(serverDate) + 250;
      }

      let retryAfter = res.headers.get('retry-after');
      const retryMs = retryAfter ? Number(retryAfter) * 1_000 : -1;
      if (retryMs > 0) {
        if (res.headers.get('x-ratelimit-global')) {
          this.manager.globalRemaining = 0;
          this.manager.globalReset = Date.now() + retryMs;
        } else if (!this.localLimited) {
          sublimitTimeout = retryMs;
        }
      }
    }

    if (res.status === 401 || res.status === 403 || res.status === 429) {
      if (!invalidCountResetTime || invalidCountResetTime < Date.now()) {
        invalidCountResetTime = Date.now() + 1_000 * 60 * 10;
        invalidCount = 0;
      }
      invalidCount++;

      const emitInvalid =
        this.manager.client.listenerCount('invalidRequestWarning') &&
        this.manager.client.options.invalidRequestWarningInterval > 0 &&
        invalidCount % this.manager.client.options.invalidRequestWarningInterval === 0;

      if (emitInvalid) {
        this.manager.client.emit('invalidRequestWarning', {
          count: invalidCount,
          remainingTime: invalidCountResetTime - Date.now(),
        });
      }
    }

    if (res.ok) {
      return parseResponse(res);
    }

    if (res.status >= 400 && res.status < 500) {
      if (res.status === 429) {
        const isGlobal = this.globalLimited;
        let limit: number;
        let timeout: number;
        if (isGlobal) {
          limit = this.manager.globalLimit;
          timeout =
            (this.manager.globalReset ?? Date.now()) +
            this.manager.client.options.restTimeOffset -
            Date.now();
        } else {
          limit = this.limit;
          timeout = this.reset + this.manager.client.options.restTimeOffset - Date.now();
        }

        await this.onRateLimit(request, limit, timeout, isGlobal);

        if (sublimitTimeout) {
          await sleep(sublimitTimeout);
        }
        return this.execute(request);
      }

      let data: unknown;
      try {
        data = await parseResponse(res);
        const dataObj = data as DiscordAPIErrorResponse;

        // Captcha handling for selfbot
        if (
          dataObj?.captcha_service &&
          typeof this.manager.client.options.captchaSolver === 'function' &&
          request.retries < this.manager.client.options.captchaRetryLimit &&
          Array.isArray(dataObj.captcha_key) &&
          captchaMessages.some(s => dataObj.captcha_key?.[0]?.includes(s))
        ) {
          const solvedKey = await this.manager.client.options.captchaSolver(
            dataObj,
            request.fullUserAgent,
          );
          request.retries++;
          return this.execute(request, solvedKey, dataObj.captcha_rqtoken);
        }

        // Two factor handling (60003: Two factor is required)
        if (
          dataObj?.code === 60003 &&
          request.options.auth !== false &&
          request.retries < 1 &&
          this.manager.client.options.TOTPKey
        ) {
          const mfaData = dataObj['mfa'] as {
            ticket: string;
            methods: Array<{ type: string }>;
          };
          if (mfaData?.methods?.some(o => o.type === 'totp')) {
            const otp = this.manager.client.authenticator?.generate?.(
              this.manager.client.options.TOTPKey,
            );
            if (otp) {
              const mfaPost = (await this.manager.client.api.mfa.finish.post({
                data: {
                  ticket: mfaData.ticket,
                  data: otp,
                  mfa_type: 'totp',
                },
              })) as { token?: string };
              if (mfaPost?.token) {
                request.options.mfaToken = mfaPost.token;
                request.retries++;
                return this.execute(request);
              }
            }
          }
        }
      } catch (err: unknown) {
        const error = err as Error & { status?: number };
        throw new HTTPError(error.message, error.constructor.name, error.status, request);
      }

      throw new DiscordAPIError(data as DiscordAPIErrorResponse, res.status, request);
    }

    if (res.status >= 500 && res.status < 600) {
      if (request.retries === this.manager.client.options.retryLimit) {
        throw new HTTPError(res.statusText, res.constructor.name, res.status, request);
      }
      request.retries++;
      return this.execute(request);
    }

    return null;
  }
}

export default RequestHandler;
