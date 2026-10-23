// Heavily inspired by node's `internal/errors` module

const kCode = Symbol('code');
const messages = new Map<string, string | ((...args: unknown[]) => string)>();

export type ErrorMessageFunction = (...args: unknown[]) => string;

/**
 * Format the message for an error.
 */
function formatMessage(key: string, args: unknown[]): string {
  const msg = messages.get(key);
  if (!msg) throw new Error(`An invalid error message key was used: ${key}.`);
  if (typeof msg === 'function') return msg(...args);
  if (!args.length) return msg;
  return `${msg} ${args.map(a => String(a)).join(' ')}`;
}

export interface DiscordjsErrorLike extends Error {
  readonly code: string;
}

export class DiscordjsError extends Error implements DiscordjsErrorLike {
  public readonly [kCode]: string;

  public constructor(key: string, ...args: unknown[]) {
    super(formatMessage(key, args));
    this[kCode] = key;
    if (Error.captureStackTrace) Error.captureStackTrace(this, DiscordjsError);
  }

  public override get name(): string {
    return `${super.name} [${this[kCode]}]`;
  }

  public get code(): string {
    return this[kCode];
  }
}

export class DiscordjsTypeError extends TypeError implements DiscordjsErrorLike {
  public readonly [kCode]: string;

  public constructor(key: string, ...args: unknown[]) {
    super(formatMessage(key, args));
    this[kCode] = key;
    if (Error.captureStackTrace) Error.captureStackTrace(this, DiscordjsTypeError);
  }

  public override get name(): string {
    return `${super.name} [${this[kCode]}]`;
  }

  public get code(): string {
    return this[kCode];
  }
}

export class DiscordjsRangeError extends RangeError implements DiscordjsErrorLike {
  public readonly [kCode]: string;

  public constructor(key: string, ...args: unknown[]) {
    super(formatMessage(key, args));
    this[kCode] = key;
    if (Error.captureStackTrace) Error.captureStackTrace(this, DiscordjsRangeError);
  }

  public override get name(): string {
    return `${super.name} [${this[kCode]}]`;
  }

  public get code(): string {
    return this[kCode];
  }
}

/**
 * Register an error code and message.
 */
export function register(sym: string, val: string | ErrorMessageFunction): void {
  messages.set(sym, typeof val === 'function' ? val : String(val));
}

export {
  DiscordjsError as Error,
  DiscordjsTypeError as TypeError,
  DiscordjsRangeError as RangeError,
  DiscordjsError as DiscordError,
  DiscordjsTypeError as DiscordTypeError,
};
