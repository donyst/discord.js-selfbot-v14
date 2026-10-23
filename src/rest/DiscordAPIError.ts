import type { BaseAPIRequest, HTTPErrorData } from './HTTPError.js';

export interface CaptchaData {
  captcha_key: string[];
  captcha_sitekey: string;
  captcha_service: string;
  captcha_rqdata?: string;
  captcha_rqtoken?: string;
}

export interface DiscordAPIErrorResponse {
  message?: string;
  code?: number;
  errors?: Record<string, unknown>;
  captcha_service?: string;
  captcha_key?: string[];
  captcha_sitekey?: string;
  captcha_rqdata?: string;
  captcha_rqtoken?: string;
  [key: string]: unknown;
}

/**
 * Represents an error from the Discord API.
 */
export class DiscordAPIError extends Error {
  public override name = 'DiscordAPIError';
  public override message: string;
  public method: string;
  public path: string;
  public code?: number;
  public httpStatus: number;
  public requestData: HTTPErrorData;
  public retries: number;
  public captcha: CaptchaData | null;

  public constructor(
    error: DiscordAPIErrorResponse,
    status: number,
    request: BaseAPIRequest & { retries?: number },
  ) {
    super();
    const flattened = DiscordAPIError.flattenErrors(error.errors ?? error).join('\n');
    this.message =
      error.message && flattened ? `${error.message}\n${flattened}` : error.message ?? flattened;

    this.method = request.method;
    this.path = request.path;
    this.code = error.code;
    this.httpStatus = status;
    this.requestData = {
      json: request.options.data,
      files: request.options.files ?? [],
      headers: request.options.headers,
    };
    this.retries = request.retries ?? 0;
    this.captcha = error.captcha_service ? (error as unknown as CaptchaData) : null;
  }

  /**
   * A special `40333` JSON error code is returned if your request is blocked by Cloudflare.
   */
  public get isBlockedByCloudflare(): boolean {
    return this.code === 40333;
  }

  /**
   * Flattens an errors object returned from the API into an array.
   */
  public static flattenErrors(obj: unknown, key = ''): string[] {
    let messages: string[] = [];
    if (!obj || typeof obj !== 'object') return messages;

    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (k === 'message') continue;
      const newKey = key ? (Number.isNaN(Number(k)) ? `${key}.${k}` : `${key}[${k}]`) : k;

      if (v && typeof v === 'object' && '_errors' in v && Array.isArray((v as { _errors: unknown[] })._errors)) {
        const errorList = (v as { _errors: Array<{ message?: string }> })._errors;
        messages.push(`${newKey}: ${errorList.map(e => e.message ?? '').join(' ')}`);
      } else if (v && typeof v === 'object' && ('code' in v || 'message' in v)) {
        const item = v as { code?: string | number; message?: string };
        messages.push(`${item.code ? `${item.code}: ` : ''}${item.message ?? ''}`.trim());
      } else if (typeof v === 'string') {
        messages.push(v);
      } else {
        messages = messages.concat(DiscordAPIError.flattenErrors(v, newKey));
      }
    }

    return messages;
  }
}

export default DiscordAPIError;
