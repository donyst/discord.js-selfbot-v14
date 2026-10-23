import BaseMessageComponent, {
  type BaseMessageComponentOptions,
  type AnyComponent,
} from './BaseMessageComponent.js';
import { MessageComponentTypes } from '../util/Constants.js';

export interface SectionComponentOptions extends BaseMessageComponentOptions {
  components?: (Record<string, unknown> | BaseMessageComponent)[];
  accessory?: Record<string, unknown> | BaseMessageComponent;
}

export interface APISectionComponent {
  type: number | undefined;
  components: unknown[];
  accessory: unknown | null;
}

export class SectionComponent extends BaseMessageComponent {
  public components: AnyComponent[] = [];
  public accessory: AnyComponent | null = null;

  public constructor(data: SectionComponent | SectionComponentOptions = {}) {
    super({ type: 'SECTION' });
    this.setup(data as Record<string, unknown>);
  }

  public override setup(data: Record<string, unknown>): void {
    super.setup(data);
    const d = data as unknown as SectionComponentOptions;
    this.components = (d.components ?? [])
      .map(c => BaseMessageComponent.create(c))
      .filter((c): c is AnyComponent => c !== null);
    this.accessory = d.accessory ? BaseMessageComponent.create(d.accessory) : null;
  }

  public override toJSON(): APISectionComponent {
    return {
      type: this.type ? (MessageComponentTypes as Record<string, number>)[this.type] : undefined,
      components: this.components.map(c => c.toJSON()),
      accessory: this.accessory ? this.accessory.toJSON() : null,
    };
  }
}

export default SectionComponent;
