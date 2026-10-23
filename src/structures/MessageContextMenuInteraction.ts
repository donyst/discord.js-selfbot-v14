import { ContextMenuInteraction, type RawContextMenuInteractionData } from './ContextMenuInteraction.js';
import type { Message } from './Message.js';
import type { Client } from '../client/Client.js';

/**
 * Represents a message context menu interaction.
 * @extends {ContextMenuInteraction}
 */
export class MessageContextMenuInteraction extends ContextMenuInteraction {
  public constructor(client: Client, data: RawContextMenuInteractionData) {
    super(client, data);
  }

  /**
   * The message this interaction was sent from
   */
  public get targetMessage(): Message | unknown | null {
    return this.options.getMessage('message');
  }
}

export default MessageContextMenuInteraction;
