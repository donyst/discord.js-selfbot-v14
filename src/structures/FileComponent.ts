import BaseMessageComponent, { type BaseMessageComponentOptions } from './BaseMessageComponent.js';
import UnfurledMediaItem, { type APIUnfurledMediaItem } from './UnfurledMediaItem.js';
import { MessageComponentTypes } from '../util/Constants.js';

export interface FileComponentOptions extends BaseMessageComponentOptions {
  file?: UnfurledMediaItem | APIUnfurledMediaItem;
  spoiler?: boolean;
}

export interface APIFileComponent {
  type: number | undefined;
  file: APIUnfurledMediaItem;
  spoiler: boolean;
}

export class FileComponent extends BaseMessageComponent {
  public file: UnfurledMediaItem;
  public spoiler: boolean = false;

  public constructor(data: FileComponent | FileComponentOptions = {}) {
    super({ type: 'FILE' });
    this.file = new UnfurledMediaItem(data.file instanceof UnfurledMediaItem ? data.file.data : data.file);
    this.setup(data as Record<string, unknown>);
  }

  public override setup(data: Record<string, unknown>): void {
    super.setup(data);
    const d = data as unknown as FileComponentOptions;
    this.file = new UnfurledMediaItem(d.file instanceof UnfurledMediaItem ? d.file.data : d.file);
    this.spoiler = d.spoiler ?? false;
  }

  public override toJSON(): APIFileComponent {
    return {
      type: this.type ? (MessageComponentTypes as Record<string, number>)[this.type] : undefined,
      file: this.file.toJSON(),
      spoiler: this.spoiler,
    };
  }
}

export default FileComponent;
