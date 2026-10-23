import { Interaction, type RawInteractionData } from './Interaction.js';
import { InteractionWebhook } from './InteractionWebhook.js';
import {
  InteractionResponses,
  type InteractionDeferReplyOptions,
  type InteractionDeferUpdateOptions,
  type InteractionReplyOptions,
  type InteractionUpdateOptions,
  type InteractionEditReplyOptions,
  type AwaitModalSubmitOptions,
} from './interfaces/InteractionResponses.js';
import { MessageComponentTypes, type MessageComponentType } from '../util/Constants.js';
import type { Client } from '../client/Client.js';
import type { Message, RawMessageData } from './Message.js';
import type { MessageActionRowComponent } from './MessageActionRow.js';
import type { ModalSubmitInteraction } from './ModalSubmitInteraction.js';
import type { MessagePayload } from './MessagePayload.js';

export interface RawMessageComponentInteractionData extends RawInteractionData {
  message: RawMessageData;
  data: {
    custom_id: string;
    component_type: number | string;
    values?: string[];
    [key: string]: unknown;
  };
}

/**
 * Represents a message component interaction.
 * @extends {Interaction}
 * @implements {InteractionResponses}
 */
export class MessageComponentInteraction extends Interaction {
  /**
   * The message to which the component was attached
   */
  public message: Message;

  /**
   * The custom id of the component which was interacted with
   */
  public customId: string;

  /**
   * The type of component which was interacted with
   */
  public declare componentType: MessageComponentType;

  /**
   * Whether the reply to this interaction has been deferred
   */
  public deferred: boolean = false;

  /**
   * Whether the reply to this interaction is ephemeral
   */
  public ephemeral: boolean | null = null;

  /**
   * Whether this interaction has already been replied to
   */
  public replied: boolean = false;

  /**
   * An associated interaction webhook, can be used to further interact with this interaction
   */
  public webhook: InteractionWebhook;

  public constructor(client: Client, data: RawMessageComponentInteractionData) {
    super(client, data);

    const channel = this.channel as unknown as { messages?: { _add(m: unknown): Message } } | null;
    this.message = channel?.messages?._add(data.message) ?? (data.message as unknown as Message);
    this.customId = data.data.custom_id;
    this.componentType = MessageComponentInteraction.resolveType(data.data.component_type);
    this.webhook = new InteractionWebhook(this.client, this.applicationId, this.token);
  }

  /**
   * The component which was interacted with
   */
  public get component(): MessageActionRowComponent | null {
    const components = (this.message as unknown as { components?: { components?: MessageActionRowComponent[] }[] }).components;
    return (
      components
        ?.flatMap(row => row.components ?? [])
        ?.find(c => {
          const comp = c as unknown as { customId?: string; custom_id?: string };
          return (comp.customId ?? comp.custom_id) === this.customId;
        }) ?? null
    );
  }

  /**
   * Resolves the type of a MessageComponent
   * @private
   */
  public static resolveType(type: number | string): MessageComponentType {
    return (typeof type === 'string' ? type : (MessageComponentTypes[type] as MessageComponentType)) ?? 'BUTTON';
  }

  /* eslint-disable @typescript-eslint/no-empty-function */
  public deferReply(_options?: InteractionDeferReplyOptions): Promise<Message | Record<string, unknown>> {
    throw new Error('Method not implemented.');
  }

  public reply(_options: string | MessagePayload | InteractionReplyOptions): Promise<Message | Record<string, unknown>> {
    throw new Error('Method not implemented.');
  }

  public fetchReply(): Promise<Message> {
    throw new Error('Method not implemented.');
  }

  public editReply(
    _options: string | MessagePayload | InteractionEditReplyOptions,
  ): Promise<Message | Record<string, unknown>> {
    throw new Error('Method not implemented.');
  }

  public deleteReply(): Promise<void> {
    throw new Error('Method not implemented.');
  }

  public followUp(_options: string | MessagePayload | InteractionReplyOptions): Promise<Message | Record<string, unknown>> {
    throw new Error('Method not implemented.');
  }

  public deferUpdate(_options?: InteractionDeferUpdateOptions): Promise<Message | Record<string, unknown>> {
    throw new Error('Method not implemented.');
  }

  public update(_options: string | MessagePayload | InteractionUpdateOptions): Promise<Message | Record<string, unknown>> {
    throw new Error('Method not implemented.');
  }

  public showModal(_modal: unknown): Promise<void> {
    throw new Error('Method not implemented.');
  }

  public awaitModalSubmit(_options: AwaitModalSubmitOptions): Promise<ModalSubmitInteraction> {
    throw new Error('Method not implemented.');
  }
}

InteractionResponses.applyToClass(MessageComponentInteraction);

export default MessageComponentInteraction;
