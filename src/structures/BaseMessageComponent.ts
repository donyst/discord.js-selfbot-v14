import { MessageComponentTypes } from '../util/Constants.js';
import type { Client } from '../client/Client.js';
import type { WebhookClient } from '../client/WebhookClient.js';
import type MessageActionRow from './MessageActionRow.js';
import type MessageButton from './MessageButton.js';
import type MessageSelectMenu from './MessageSelectMenu.js';
import type TextInputComponent from './TextInputComponent.js';
import type SectionComponent from './SectionComponent.js';
import type TextDisplayComponent from './TextDisplayComponent.js';
import type ThumbnailComponent from './ThumbnailComponent.js';
import type MediaGalleryComponent from './MediaGalleryComponent.js';
import type FileComponent from './FileComponent.js';
import type SeparatorComponent from './SeparatorComponent.js';
import type ContainerComponent from './ContainerComponent.js';

export type ComponentCreator = (
  data: Record<string, unknown> | BaseMessageComponent,
  client?: Client | WebhookClient | null,
) => AnyComponent | null;

let componentCreator: ComponentCreator | null = null;

export function setComponentCreator(creator: ComponentCreator): void {
  componentCreator = creator;
}

export type MessageComponentType = keyof typeof MessageComponentTypes;
export type MessageComponentTypeResolvable = MessageComponentType | number | string;

export interface BaseMessageComponentOptions {
  type?: MessageComponentTypeResolvable | null;
  id?: number | string;
  [key: string]: unknown;
}

export type AnyComponent =
  | MessageActionRow
  | MessageButton
  | MessageSelectMenu
  | TextInputComponent
  | SectionComponent
  | TextDisplayComponent
  | ThumbnailComponent
  | MediaGalleryComponent
  | FileComponent
  | SeparatorComponent
  | ContainerComponent;

export class BaseMessageComponent {
  public type: MessageComponentType | null;
  public data!: Record<string, unknown>;

  public constructor(data: BaseMessageComponentOptions = {}) {
    this.type = 'type' in data && data.type != null ? BaseMessageComponent.resolveType(data.type) : null;
  }

  public setup(data: Record<string, unknown>): void {
    this.data = data;
  }

  public get id(): unknown {
    return this.data?.id;
  }

  public static create(
    data: Record<string, unknown> | BaseMessageComponent,
    client?: Client | WebhookClient | null,
  ): AnyComponent | null {
    if (!data) return null;
    if (typeof (data as { toJSON?: unknown }).toJSON === 'function' && !(data instanceof BaseMessageComponent)) {
      data = (data as { toJSON(): Record<string, unknown> }).toJSON();
    }
    if (!componentCreator) {
      throw new Error('ComponentCreator has not been initialized.');
    }
    return componentCreator(data, client);
  }

  public static resolveType(type: MessageComponentTypeResolvable): MessageComponentType {
    if (typeof type === 'string' && isNaN(Number(type))) return type as MessageComponentType;
    return (MessageComponentTypes as Record<string | number, MessageComponentType>)[type];
  }

  public static extractInteractiveComponents(component: unknown): unknown[] {
    const comp = (component ?? {}) as Record<string, unknown>;
    let type = comp.type as MessageComponentTypeResolvable;
    if (typeof type === 'string' && isNaN(Number(type))) {
      type = (MessageComponentTypes as Record<string, number>)[type];
    } else if (typeof type === 'string') {
      type = Number(type);
    }

    switch (type) {
      case MessageComponentTypes.ACTION_ROW:
        return (comp.components as unknown[]) ?? [];
      case MessageComponentTypes.SECTION:
        return [...((comp.components as unknown[]) ?? []), comp.accessory];
      case MessageComponentTypes.CONTAINER:
        return ((comp.components as Record<string, unknown>[]) ?? []).flatMap(
          BaseMessageComponent.extractInteractiveComponents,
        );
      default:
        return [component];
    }
  }

  public toJSON(): unknown {
    return {
      type: this.type ? (MessageComponentTypes as Record<string, number>)[this.type] : undefined,
    };
  }
}

export default BaseMessageComponent;
