import {
  BaseCommandInteraction,
  type RawBaseCommandInteractionData,
  type CommandInteractionOption,
  type APIInteractionDataResolved,
} from './BaseCommandInteraction.js';
import { CommandInteractionOptionResolver, type ExtendedCommandInteractionOption } from './CommandInteractionOptionResolver.js';
import {
  ApplicationCommandOptionTypes,
  ApplicationCommandTypes,
  type ApplicationCommandType,
} from '../util/Constants.js';
import type { Snowflake } from '../types/index.js';
import type { Client } from '../client/Client.js';
import type { Message } from './Message.js';

export interface RawContextMenuInteractionData extends RawBaseCommandInteractionData {
  data: {
    id: Snowflake;
    name: string;
    target_id: Snowflake;
    type: number;
    resolved: APIInteractionDataResolved;
    [key: string]: unknown;
  };
}

/**
 * Represents a context menu interaction.
 * @extends {BaseCommandInteraction}
 */
export class ContextMenuInteraction extends BaseCommandInteraction {
  /**
   * The target of the interaction, parsed into options
   */
  public options: CommandInteractionOptionResolver;

  /**
   * The id of the target of this interaction
   */
  public declare targetId: Snowflake;

  /**
   * The type of the target of the interaction; either USER or MESSAGE
   */
  public declare targetType: ApplicationCommandType;

  public constructor(client: Client, data: RawContextMenuInteractionData) {
    super(client, data);

    this.targetId = data.data.target_id;
    this.targetType = (ApplicationCommandTypes[data.data.type] as ApplicationCommandType) ?? 'CHAT_INPUT';

    this.options = new CommandInteractionOptionResolver(
      this.client,
      this.resolveContextMenuOptions(data.data) as CommandInteractionOption[],
      this.transformResolved(data.data.resolved),
    );
  }

  /**
   * Resolves and transforms options received from the API for a context menu interaction.
   * @private
   */
  public resolveContextMenuOptions({
    target_id,
    resolved,
  }: {
    target_id: Snowflake;
    resolved: APIInteractionDataResolved;
  }): ExtendedCommandInteractionOption[] {
    const result: ExtendedCommandInteractionOption[] = [];

    if (resolved.users?.[target_id]) {
      result.push(
        this.transformOption({ name: 'user', type: ApplicationCommandOptionTypes.USER as number, value: target_id }, resolved),
      );
    }

    if (resolved.messages?.[target_id]) {
      const chMessages = (this.channel as unknown as { messages?: { _add(m: unknown): Message } } | null)?.messages;
      const rawMsg = resolved.messages[target_id];
      result.push({
        name: 'message',
        type: '_MESSAGE' as unknown as import('../util/Constants.js').ApplicationCommandOptionType,
        value: target_id,
        message: chMessages?._add(rawMsg) ?? rawMsg,
      });
    }

    return result;
  }
}

export default ContextMenuInteraction;
