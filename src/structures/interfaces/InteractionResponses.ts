import { DiscordjsError } from '../../errors/index.js';
import { InteractionResponseTypes, InteractionTypes } from '../../util/Constants.js';
import { MessageFlags } from '../../util/MessageFlags.js';
import type { Snowflake } from '../../types/index.js';
import MessagePayload from '../MessagePayload.js';
import Modal from '../Modal.js';
import InteractionCollector from '../InteractionCollector.js';

export interface InteractionDeferReplyOptions {
  ephemeral?: boolean;
  fetchReply?: boolean;
}

export interface InteractionDeferUpdateOptions {
  fetchReply?: boolean;
}

export interface InteractionReplyOptions {
  content?: string;
  embeds?: unknown[];
  components?: unknown[];
  ephemeral?: boolean;
  fetchReply?: boolean;
  flags?: unknown;
  files?: unknown[];
  [key: string]: unknown;
}

export interface InteractionUpdateOptions {
  content?: string;
  embeds?: unknown[];
  components?: unknown[];
  fetchReply?: boolean;
  files?: unknown[];
  [key: string]: unknown;
}

export interface InteractionEditReplyOptions {
  content?: string;
  embeds?: unknown[];
  components?: unknown[];
  files?: unknown[];
  message?: string;
  [key: string]: unknown;
}

export interface AwaitModalSubmitOptions {
  filter?: (interaction: unknown) => boolean | Promise<boolean>;
  time: number;
}

export interface InteractionResponsesClient {
  api: {
    interactions: (
      id: Snowflake,
      token: string,
    ) => {
      callback: {
        post: (options: { data: unknown; files?: unknown[]; auth?: boolean }) => Promise<unknown>;
      };
    };
  };
}

export interface InteractionResponsesWebhook {
  fetchMessage: (message: string) => Promise<unknown>;
  editMessage: (message: string, options: unknown) => Promise<unknown>;
  deleteMessage: (message: string) => Promise<void>;
  send: (options: unknown) => Promise<unknown>;
}

/**
 * Interface for classes that support shared interaction response types.
 */
export class InteractionResponses {
  public deferred = false;
  public replied = false;
  public ephemeral = false;
  public id!: Snowflake;
  public token!: string;
  public client!: InteractionResponsesClient;
  public webhook!: InteractionResponsesWebhook;

  /**
   * Defers the reply to this interaction.
   */
  public async deferReply(options: InteractionDeferReplyOptions = {}): Promise<unknown> {
    if (this.deferred || this.replied) throw new DiscordjsError('INTERACTION_ALREADY_REPLIED');
    this.ephemeral = options.ephemeral ?? false;
    await this.client.api.interactions(this.id, this.token).callback.post({
      data: {
        type: InteractionResponseTypes.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          flags: options.ephemeral ? MessageFlags.FLAGS.EPHEMERAL : undefined,
        },
      },
      auth: false,
    });
    this.deferred = true;

    return options.fetchReply ? this.fetchReply() : undefined;
  }

  /**
   * Creates a reply to this interaction.
   */
  public async reply(options: string | InteractionReplyOptions): Promise<unknown> {
    if (this.deferred || this.replied) throw new DiscordjsError('INTERACTION_ALREADY_REPLIED');
    const opts = typeof options === 'string' ? { content: options } : options;
    this.ephemeral = opts.ephemeral ?? false;

    const messagePayload =
      options instanceof MessagePayload
        ? options
        : MessagePayload.create(
            this as unknown as import('../MessagePayload.js').MessageTarget,
            options as unknown as import('../MessagePayload.js').BaseMessageOptions,
          );

    const { data, files } = await messagePayload.resolveData().resolveFiles();

    await this.client.api.interactions(this.id, this.token).callback.post({
      data: {
        type: InteractionResponseTypes.CHANNEL_MESSAGE_WITH_SOURCE,
        data,
      },
      files: files ?? undefined,
      auth: false,
    });
    this.replied = true;

    return opts.fetchReply ? this.fetchReply() : undefined;
  }

  /**
   * Fetches a reply to this interaction.
   */
  public fetchReply(message = '@original'): Promise<unknown> {
    return this.webhook.fetchMessage(message);
  }

  /**
   * Edits a reply to this interaction.
   */
  public async editReply(options: string | InteractionEditReplyOptions): Promise<unknown> {
    if (!this.deferred && !this.replied) throw new DiscordjsError('INTERACTION_NOT_REPLIED');
    const opts = typeof options === 'string' ? { content: options } : options;
    const message = await this.webhook.editMessage(opts.message ?? '@original', opts);
    this.replied = true;
    return message;
  }

  /**
   * Deletes a reply to this interaction.
   */
  public async deleteReply(message = '@original'): Promise<void> {
    await this.webhook.deleteMessage(message);
  }

  /**
   * Send a follow-up message to this interaction.
   */
  public async followUp(options: string | InteractionReplyOptions): Promise<unknown> {
    if (!this.deferred && !this.replied) throw new DiscordjsError('INTERACTION_NOT_REPLIED');
    return this.webhook.send(options);
  }

  /**
   * Defers an update to the message to which the component was attached.
   */
  public async deferUpdate(options: InteractionDeferUpdateOptions = {}): Promise<unknown> {
    if (this.deferred || this.replied) throw new DiscordjsError('INTERACTION_ALREADY_REPLIED');
    await this.client.api.interactions(this.id, this.token).callback.post({
      data: {
        type: InteractionResponseTypes.DEFERRED_MESSAGE_UPDATE,
      },
      auth: false,
    });
    this.deferred = true;

    return options.fetchReply ? this.fetchReply() : undefined;
  }

  /**
   * Updates the original message of the component on which the interaction was received.
   */
  public async update(options: string | InteractionUpdateOptions): Promise<unknown> {
    if (this.deferred || this.replied) throw new DiscordjsError('INTERACTION_ALREADY_REPLIED');

    const messagePayload =
      options instanceof MessagePayload
        ? options
        : MessagePayload.create(
            this as unknown as import('../MessagePayload.js').MessageTarget,
            options as unknown as import('../MessagePayload.js').BaseMessageOptions,
          );

    const { data, files } = await messagePayload.resolveData().resolveFiles();

    await this.client.api.interactions(this.id, this.token).callback.post({
      data: {
        type: InteractionResponseTypes.UPDATE_MESSAGE,
        data,
      },
      files: files ?? undefined,
      auth: false,
    });
    this.replied = true;

    const opts = typeof options === 'string' ? { content: options } : options;
    return opts.fetchReply ? this.fetchReply() : undefined;
  }

  /**
   * Shows a modal component
   */
  public async showModal(modal: unknown): Promise<void> {
    if (this.deferred || this.replied) throw new DiscordjsError('INTERACTION_ALREADY_REPLIED');

    const modalInstance = modal instanceof Modal ? modal : new Modal(modal as import('../Modal.js').APIModalData);
    await this.client.api.interactions(this.id, this.token).callback.post({
      data: {
        type: InteractionResponseTypes.MODAL,
        data: modalInstance.toJSON(),
      },
    });
    this.replied = true;
  }

  /**
   * Collects a single modal submit interaction that passes the filter.
   */
  public awaitModalSubmit(options: AwaitModalSubmitOptions): Promise<unknown> {
    if (typeof options.time !== 'number') throw new DiscordjsError('INVALID_TYPE', 'time', 'number');
    const opts = { ...options, max: 1, interactionType: InteractionTypes.MODAL_SUBMIT };
    return new Promise((resolve, reject) => {
      const collector = new InteractionCollector(this.client as unknown as import('../../client/Client.js').Client, opts);
      collector.once(
        'end',
        (interactions: { first: () => unknown }, reason: string) => {
          const interaction = interactions.first();
          if (interaction) resolve(interaction);
          else reject(new DiscordjsError('INTERACTION_COLLECTOR_ERROR', reason));
        },
      );
    });
  }

  public static applyToClass(structure: { prototype: unknown }, ignore: string[] = []): void {
    const props = [
      'deferReply',
      'reply',
      'fetchReply',
      'editReply',
      'deleteReply',
      'followUp',
      'deferUpdate',
      'update',
      'showModal',
      'awaitModalSubmit',
    ];

    for (const prop of props) {
      if (ignore.includes(prop)) continue;
      const desc = Object.getOwnPropertyDescriptor(InteractionResponses.prototype, prop);
      if (desc) {
        Object.defineProperty(structure.prototype as object, prop, desc);
      }
    }
  }
}

export default InteractionResponses;
