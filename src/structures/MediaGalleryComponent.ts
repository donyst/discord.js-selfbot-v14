import BaseMessageComponent, { type BaseMessageComponentOptions } from './BaseMessageComponent.js';
import MediaGalleryItem, { type APIMediaGalleryItem } from './MediaGalleryItem.js';
import { MessageComponentTypes } from '../util/Constants.js';

export interface MediaGalleryComponentOptions extends BaseMessageComponentOptions {
  items?: (MediaGalleryItem | APIMediaGalleryItem)[];
}

export interface APIMediaGalleryComponent {
  type: number | undefined;
  items: APIMediaGalleryItem[];
}

export class MediaGalleryComponent extends BaseMessageComponent {
  public items: MediaGalleryItem[] = [];

  public constructor(data: MediaGalleryComponent | MediaGalleryComponentOptions = {}) {
    super({ type: 'MEDIA_GALLERY' });
    this.setup(data as Record<string, unknown>);
  }

  public override setup(data: Record<string, unknown>): void {
    super.setup(data);
    const d = data as unknown as MediaGalleryComponentOptions;
    this.items = (d.items ?? []).map(item => (item instanceof MediaGalleryItem ? item : new MediaGalleryItem(item)));
  }

  public override toJSON(): APIMediaGalleryComponent {
    return {
      type: this.type ? (MessageComponentTypes as Record<string, number>)[this.type] : undefined,
      items: this.items.map(c => c.toJSON()),
    };
  }
}

export default MediaGalleryComponent;
