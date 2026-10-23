import UnfurledMediaItem, { type APIUnfurledMediaItem } from './UnfurledMediaItem.js';

export interface APIMediaGalleryItem {
  media?: APIUnfurledMediaItem;
  description?: string | null;
  spoiler?: boolean;
}

export class MediaGalleryItem {
  public media: UnfurledMediaItem;
  public description: string | null;
  public spoiler: boolean;

  public constructor(data: APIMediaGalleryItem = {}) {
    this.media = new UnfurledMediaItem(data.media);
    this.description = data.description ?? null;
    this.spoiler = data.spoiler ?? false;
  }

  public toJSON(): APIMediaGalleryItem {
    return {
      media: this.media.toJSON(),
      description: this.description,
      spoiler: this.spoiler,
    };
  }
}

export default MediaGalleryItem;
