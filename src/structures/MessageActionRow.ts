import BaseMessageComponent, {
  type BaseMessageComponentOptions,
  type AnyComponent,
} from './BaseMessageComponent.js';
import { MessageComponentTypes } from '../util/Constants.js';
import type { Client } from '../client/Client.js';
import type { WebhookClient } from '../client/WebhookClient.js';
import type MessageButton from './MessageButton.js';
import type MessageSelectMenu from './MessageSelectMenu.js';
import type TextInputComponent from './TextInputComponent.js';

export type MessageActionRowComponent = MessageButton | MessageSelectMenu | TextInputComponent;
export type MessageActionRowComponentResolvable =
  | MessageActionRowComponent
  | Record<string, unknown>
  | BaseMessageComponent;

export interface MessageActionRowOptions extends BaseMessageComponentOptions {
  components?: MessageActionRowComponentResolvable[];
}

export interface APIMessageActionRow {
  components: unknown[];
  type: number | undefined;
}

export class MessageActionRow extends BaseMessageComponent {
  public components: AnyComponent[] = [];

  public constructor(
    data: MessageActionRow | MessageActionRowOptions = {},
    client: Client | WebhookClient | null = null,
  ) {
    super({ type: 'ACTION_ROW' });

    if (data.components) {
      this.components = data.components
        .map(c => BaseMessageComponent.create(c as Record<string, unknown>, client))
        .filter((c): c is AnyComponent => c !== null);
    }

    super.setup(data as Record<string, unknown>);
  }

  public addComponents(...components: (MessageActionRowComponentResolvable | MessageActionRowComponentResolvable[])[]): this {
    const flat = (components.flat(Infinity) as MessageActionRowComponentResolvable[])
      .map(c => BaseMessageComponent.create(c as Record<string, unknown>))
      .filter((c): c is AnyComponent => c !== null);

    this.components.push(...flat);
    return this;
  }

  public setComponents(...components: (MessageActionRowComponentResolvable | MessageActionRowComponentResolvable[])[]): this {
    this.spliceComponents(0, this.components.length, ...components);
    return this;
  }

  public spliceComponents(
    index: number,
    deleteCount: number,
    ...components: (MessageActionRowComponentResolvable | MessageActionRowComponentResolvable[])[]
  ): this {
    const flat = (components.flat(Infinity) as MessageActionRowComponentResolvable[])
      .map(c => BaseMessageComponent.create(c as Record<string, unknown>))
      .filter((c): c is AnyComponent => c !== null);

    this.components.splice(index, deleteCount, ...flat);
    return this;
  }

  public override toJSON(): APIMessageActionRow {
    return {
      components: this.components.map(c => c.toJSON()),
      type: this.type ? (MessageComponentTypes as Record<string, number>)[this.type] : undefined,
    };
  }
}

export default MessageActionRow;
