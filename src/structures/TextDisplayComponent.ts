import BaseMessageComponent, { type BaseMessageComponentOptions } from './BaseMessageComponent.js';
import { MessageComponentTypes } from '../util/Constants.js';

export interface TextDisplayComponentOptions extends BaseMessageComponentOptions {
  content?: string | null;
}

export interface APITextDisplayComponent {
  type: number | undefined;
  content: string | null;
}

export class TextDisplayComponent extends BaseMessageComponent {
  public content: string | null = null;

  public constructor(data: TextDisplayComponent | TextDisplayComponentOptions = {}) {
    super({ type: 'TEXT_DISPLAY' });
    this.setup(data as Record<string, unknown>);
  }

  public override setup(data: Record<string, unknown>): void {
    super.setup(data);
    const d = data as unknown as TextDisplayComponentOptions;
    this.content = d.content ?? null;
  }

  public override toJSON(): APITextDisplayComponent {
    return {
      type: this.type ? (MessageComponentTypes as Record<string, number>)[this.type] : undefined,
      content: this.content,
    };
  }
}

export default TextDisplayComponent;
