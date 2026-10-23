import { ContextMenuInteraction, type RawContextMenuInteractionData } from './ContextMenuInteraction.js';
import type { User } from './User.js';
import type { GuildMember } from './GuildMember.js';
import type { APIGuildMember } from './Interaction.js';
import type { Client } from '../client/Client.js';

/**
 * Represents a user context menu interaction.
 * @extends {ContextMenuInteraction}
 */
export class UserContextMenuInteraction extends ContextMenuInteraction {
  public constructor(client: Client, data: RawContextMenuInteractionData) {
    super(client, data);
  }

  /**
   * The target user from this interaction
   */
  public get targetUser(): User | null {
    return this.options.getUser('user');
  }

  /**
   * The target member from this interaction
   */
  public get targetMember(): GuildMember | APIGuildMember | null {
    return this.options.getMember('user');
  }
}

export default UserContextMenuInteraction;
