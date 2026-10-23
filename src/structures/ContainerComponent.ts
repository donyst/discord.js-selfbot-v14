import BaseMessageComponent, {
  type BaseMessageComponentOptions,
  type AnyComponent,
} from './BaseMessageComponent.js';
import { MessageComponentTypes } from '../util/Constants.js';

export interface ContainerComponentOptions extends BaseMessageComponentOptions {
  components?: (Record<string, unknown> | BaseMessageComponent)[];
  accent_color?: number | null;
  spoiler?: boolean;
}

export interface APIContainerComponent {
  type: number | undefined;
  components: Record<string, unknown>[];
  accent_color: number | null;
  spoiler: boolean;
}

export class ContainerComponent extends BaseMessageComponent {
  public components: AnyComponent[] = [];
  public accentColor: number | null = null;
  public spoiler: boolean = false;

  public constructor(data: ContainerComponent | ContainerComponentOptions = {}) {
    super({ type: 'CONTAINER' });
    this.setup(data as Record<string, unknown>);
  }

  public override setup(data: Record<string, unknown>): void {
    super.setup(data);
    const d = data as unknown as ContainerComponentOptions;
    this.components = (d.components ?? [])
      .map(c => BaseMessageComponent.create(c))
      .filter((c): c is AnyComponent => c !== null);
    this.accentColor = d.accent_color ?? null;
    this.spoiler = d.spoiler ?? false;
  }

  public get hexAccentColor(): string | null {
    return typeof this.accentColor === 'number'
      ? `#${this.accentColor.toString(16).padStart(6, '0')}`
      : null;
  }

  public override toJSON(): APIContainerComponent {
    return {
      type: this.type ? (MessageComponentTypes as Record<string, number>)[this.type] : undefined,
      components: this.components.map(c => c.toJSON() as unknown as Record<string, unknown>),
      accent_color: this.accentColor,
      spoiler: this.spoiler,
    };
  }
}

export default ContainerComponent;
