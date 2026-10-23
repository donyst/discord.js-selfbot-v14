import { BaseCommandInteraction, type RawBaseCommandInteractionData } from './BaseCommandInteraction.js';
import { CommandInteractionOptionResolver } from './CommandInteractionOptionResolver.js';
import type { Client } from '../client/Client.js';

/**
 * Represents a command interaction.
 * @extends {BaseCommandInteraction}
 */
export class CommandInteraction extends BaseCommandInteraction {
  /**
   * The options passed to the command.
   */
  public options: CommandInteractionOptionResolver;

  public constructor(client: Client, data: RawBaseCommandInteractionData) {
    super(client, data);

    this.options = new CommandInteractionOptionResolver(
      this.client,
      data.data.options?.map(option => this.transformOption(option, data.data.resolved)) ?? [],
      this.transformResolved(data.data.resolved ?? {}),
    );
  }

  /**
   * Returns a string representation of the command interaction.
   * This can then be copied by a user and executed again in a new command while keeping the option order.
   */
  public override toString(): string {
    const opts = this.options as unknown as {
      _group?: string | null;
      _subcommand?: string | null;
      _hoistedOptions?: { name: string; value?: unknown }[];
    };
    const properties = [
      this.commandName,
      opts._group,
      opts._subcommand,
      ...(opts._hoistedOptions?.map(o => `${o.name}:${o.value}`) ?? []),
    ];
    return `/${properties.filter(Boolean).join(' ')}`;
  }
}

export default CommandInteraction;
