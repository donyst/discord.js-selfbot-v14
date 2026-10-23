import { MessageComponentInteraction, type RawMessageComponentInteractionData } from './MessageComponentInteraction.js';
import type { Client } from '../client/Client.js';

/**
 * Represents a button interaction.
 * @extends {MessageComponentInteraction}
 */
export class ButtonInteraction extends MessageComponentInteraction {
  public constructor(client: Client, data: RawMessageComponentInteractionData) {
    super(client, data);
  }
}

export default ButtonInteraction;
