export interface RateLimitErrorOptions {
  timeout: number;
  limit: number;
  method: string;
  path: string;
  route: string;
  global: boolean;
}

export type RateLimitData = RateLimitErrorOptions;

/**
 * Represents a RateLimit error from a request.
 */
export class RateLimitError extends Error {
  public override name = 'RateLimitError';
  public timeout: number;
  public method: string;
  public path: string;
  public route: string;
  public global: boolean;
  public limit: number;

  public constructor({ timeout, limit, method, path, route, global }: RateLimitErrorOptions) {
    super(`A ${global ? 'global ' : ''}rate limit was hit on route ${route}`);
    this.timeout = timeout;
    this.method = method;
    this.path = path;
    this.route = route;
    this.global = global;
    this.limit = limit;
  }
}

export default RateLimitError;
