import BaseMessageComponent, { type BaseMessageComponentOptions } from './BaseMessageComponent.js';
import { MessageComponentTypes, SeparatorSpacingSizes } from '../util/Constants.js';

export interface SeparatorComponentOptions extends BaseMessageComponentOptions {
  spacing?: number | keyof typeof SeparatorSpacingSizes;
  divider?: boolean;
}

export interface APISeparatorComponent {
  type: number | undefined;
  spacing: number | keyof typeof SeparatorSpacingSizes;
  divider: boolean;
}

export class SeparatorComponent extends BaseMessageComponent {
  public spacing: number | keyof typeof SeparatorSpacingSizes = SeparatorSpacingSizes.SMALL;
  public divider: boolean = true;

  public constructor(data: SeparatorComponent | SeparatorComponentOptions = {}) {
    super({ type: 'SEPARATOR' });
    this.setup(data as Record<string, unknown>);
  }

  public override setup(data: Record<string, unknown>): void {
    super.setup(data);
    const d = data as unknown as SeparatorComponentOptions;
    this.spacing = d.spacing ?? SeparatorSpacingSizes.SMALL;
    this.divider = d.divider ?? true;
  }

  public override toJSON(): APISeparatorComponent {
    return {
      type: this.type ? (MessageComponentTypes as Record<string, number>)[this.type] : undefined,
      spacing: this.spacing,
      divider: this.divider,
    };
  }
}

export default SeparatorComponent;
