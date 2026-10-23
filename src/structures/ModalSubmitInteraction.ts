import { Interaction, type RawInteractionData } from './Interaction.js';
import { InteractionWebhook } from './InteractionWebhook.js';
import {
  ModalSubmitFieldsResolver,
  type PartialModalActionRow,
  type PartialTextInputData,
} from './ModalSubmitFieldsResolver.js';
import {
  InteractionResponses,
  type InteractionDeferReplyOptions,
  type InteractionDeferUpdateOptions,
  type InteractionReplyOptions,
  type InteractionUpdateOptions,
  type InteractionEditReplyOptions,
} from './interfaces/InteractionResponses.js';
import { MessageComponentTypes, type MessageComponentType } from '../util/Constants.js';
import type { Client } from '../client/Client.js';
import type { Message, RawMessageData } from './Message.js';
import type { MessagePayload } from './MessagePayload.js';

export interface RawModalSubmitInteractionData extends RawInteractionData {
  message?: RawMessageData;
  data: {
    custom_id: string;
    components?: {
      type: number | string;
      components: {
        value: string;
        type: number | string;
        custom_id: string;
      }[];
    }[];
    [key: string]: unknown;
  };
}

/**
 * Represents a modal submit interaction.
 * @extends {Interaction}
 * @implements {InteractionResponses}
 */
export class ModalSubmitInteraction extends Interaction {
  /**
   * The custom id of the modal.
   */
  public customId: string;

  /**
   * The inputs within the modal
   */
  public components: PartialModalActionRow[];

  /**
   * The message associated with this interaction
   */
  public message: Message | unknown | null;

  /**
   * The fields within the modal
   */
  public fields: ModalSubmitFieldsResolver;

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

  public constructor(client: Client, data: RawModalSubmitInteractionData) {
    super(client, data);

    this.customId = data.data.custom_id;

    this.components =
      data.data.components?.map(c => ({
        type: (typeof c.type === 'string' ? c.type : (MessageComponentTypes[c.type] as MessageComponentType)) ?? 'ACTION_ROW',
        components: ModalSubmitInteraction.transformComponent(c),
      })) ?? [];

    const channel = this.channel as unknown as { messages?: { _add(m: unknown): Message } } | null;
    this.message = data.message ? channel?.messages?._add(data.message) ?? data.message : null;

    this.fields = new ModalSubmitFieldsResolver(this.components);
    this.webhook = new InteractionWebhook(this.client, this.applicationId, this.token);
  }

  /**
   * Transforms component data to discord.js-compatible data
   */
  public static transformComponent(rawComponent: {
    components: { value: string; type: number | string; custom_id: string }[];
  }): PartialTextInputData[] {
    return rawComponent.components.map(c => ({
      value: c.value,
      type: (typeof c.type === 'string' ? c.type : (MessageComponentTypes[c.type] as MessageComponentType)) ?? 'TEXT_INPUT',
      customId: c.custom_id,
    }));
  }

  /**
   * Whether this is from a MessageComponentInteraction.
   */
  public isFromMessage(): boolean {
    return Boolean(this.message);
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
}

InteractionResponses.applyToClass(ModalSubmitInteraction, ['showModal', 'awaitModalSubmit']);

export default ModalSubmitInteraction;
