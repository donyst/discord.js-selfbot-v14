import BaseMessageComponent, { type BaseMessageComponentOptions } from './BaseMessageComponent.js';
import UnfurledMediaItem, { type APIUnfurledMediaItem } from './UnfurledMediaItem.js';
import { MessageComponentTypes } from '../util/Constants.js';

export interface ThumbnailComponentOptions extends BaseMessageComponentOptions {
  media?: APIUnfurledMediaItem | UnfurledMediaItem;
  description?: string | null;
  spoiler?: boolean;
}

export interface APIThumbnailComponent {
  type: number | undefined;
  media: APIUnfurledMediaItem;
  description: string | null;
  spoiler: boolean;
}

export class ThumbnailComponent extends BaseMessageComponent {
  public media: UnfurledMediaItem;
  public description: string | null = null;
  public spoiler: boolean = false;

  public constructor(data: ThumbnailComponent | ThumbnailComponentOptions = {}) {
    super({ type: 'THUMBNAIL' });
    this.media = new UnfurledMediaItem(data.media);
    this.setup(data as Record<string, unknown>);
  }

  public override setup(data: Record<string, unknown>): void {
    super.setup(data);
    const d = data as unknown as ThumbnailComponentOptions;
    this.media = new UnfurledMediaItem(d.media);
    this.description = d.description ?? null;
    this.spoiler = d.spoiler ?? false;
  }

  public override toJSON(): APIThumbnailComponent {
    return {
      type: this.type ? (MessageComponentTypes as Record<string, number>)[this.type] : undefined,
      media: this.media.toJSON(),
      description: this.description,
      spoiler: this.spoiler,
    };
  }
}

export default ThumbnailComponent;
