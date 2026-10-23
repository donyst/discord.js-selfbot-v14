export interface HTTPAttachmentData {
  attachment: string | Buffer | unknown;
  name: string;
  file: Buffer | unknown;
  key?: string;
}

export interface HTTPErrorData {
  json: unknown;
  files: HTTPAttachmentData[];
  headers?: Record<string, string>;
}

export interface BaseAPIRequestOptions {
  route?: string;
  data?: unknown;
  files?: HTTPAttachmentData[];
  headers?: Record<string, string>;
  auth?: boolean;
  versioned?: boolean;
  reason?: string;
  query?: Record<string, unknown>;
  webhook?: boolean;
  DiscordContext?: unknown;
  mfaToken?: string;
  dontUsePayloadJSON?: boolean;
  usePayloadJSON?: boolean;
}

export interface BaseAPIRequest {
  method: string;
  path: string;
  options: BaseAPIRequestOptions;
}

/**
 * Represents an HTTP error from a request.
 */
export class HTTPError extends Error {
  public override name: string;
  public code: number;
  public method: string;
  public path: string;
  public requestData: HTTPErrorData;

  public constructor(message: string, name: string, code: number | undefined, request: BaseAPIRequest) {
    super(message);
    this.name = name;
    this.code = code ?? 500;
    this.method = request.method;
    this.path = request.path;
    this.requestData = {
      json: request.options.data,
      files: request.options.files ?? [],
      headers: request.options.headers,
    };
  }
}

export default HTTPError;
