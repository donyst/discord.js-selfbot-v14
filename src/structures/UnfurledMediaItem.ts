export interface APIUnfurledMediaItem {
  url?: string | null;
  proxy_url?: string | null;
  height?: number | null;
  width?: number | null;
  placeholder?: string | null;
  placeholder_version?: number | null;
  [key: string]: unknown;
}

export class UnfurledMediaItem {
  public url: string | null;
  public data: APIUnfurledMediaItem;

  public constructor(data: APIUnfurledMediaItem | UnfurledMediaItem = {}) {
    if (data instanceof UnfurledMediaItem) {
      this.url = data.url;
      this.data = data.data;
    } else {
      this.url = data.url ?? null;
      this.data = data;
    }
  }

  public toJSON(): APIUnfurledMediaItem {
    return { ...this.data };
  }
}

export default UnfurledMediaItem;
