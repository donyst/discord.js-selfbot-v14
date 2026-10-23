import { MessageComponentInteraction, type RawMessageComponentInteractionData } from './MessageComponentInteraction.js';
import type { Client } from '../client/Client.js';

/**
 * Represents a select menu interaction.
 * @extends {MessageComponentInteraction}
 */
export class SelectMenuInteraction extends MessageComponentInteraction {
  /**
   * The values selected, if the component which was interacted with was a select menu
   */
  public values: string[];

  public constructor(client: Client, data: RawMessageComponentInteractionData) {
    super(client, data);

    this.values = data.data.values ?? [];
  }
}

export default SelectMenuInteraction;
