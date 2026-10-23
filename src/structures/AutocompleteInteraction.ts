import { Interaction, type RawInteractionData } from './Interaction.js';
import { CommandInteractionOptionResolver, type ExtendedCommandInteractionOption } from './CommandInteractionOptionResolver.js';
import type { CommandInteractionOption } from './BaseCommandInteraction.js';
import { DiscordjsError as DJSError } from '../errors/index.js';
import {
  InteractionResponseTypes,
  ApplicationCommandOptionTypes,
  type ApplicationCommandOptionType,
} from '../util/Constants.js';
import type { Snowflake } from '../types/index.js';
import type { Client } from '../client/Client.js';
import type { ApplicationCommand } from './ApplicationCommand.js';
import type { Collection } from '@discordjs/collection';

export interface ApplicationCommandOptionChoiceData {
  name: string;
  value: string | number;
  nameLocalizations?: Record<string, string>;
  [key: string]: unknown;
}

export interface APIAutocompleteOption {
  name: string;
  type: number;
  value?: string | number | boolean;
  options?: APIAutocompleteOption[];
  focused?: boolean;
  [key: string]: unknown;
}

export interface RawAutocompleteInteractionData extends RawInteractionData {
  data: {
    id: Snowflake;
    name: string;
    options?: APIAutocompleteOption[];
    resolved?: unknown;
    [key: string]: unknown;
  };
}

/**
 * Represents an autocomplete interaction.
 * @extends {Interaction}
 */
export class AutocompleteInteraction extends Interaction {
  /**
   * The invoked application command's id
   */
  public commandId: Snowflake;

  /**
   * The invoked application command's name
   */
  public commandName: string;

  /**
   * Whether this interaction has already received a response
   */
  public responded: boolean = false;

  /**
   * The options passed to the command
   */
  public options: CommandInteractionOptionResolver;

  public constructor(client: Client, data: RawAutocompleteInteractionData) {
    super(client, data);

    this.commandId = data.data.id;
    this.commandName = data.data.name;

    this.options = new CommandInteractionOptionResolver(
      this.client,
      (data.data.options?.map(option => this.transformOption(option)) ?? []) as CommandInteractionOption[],
      {},
    );
  }

  /**
   * The invoked application command, if it was fetched before
   */
  public get command(): ApplicationCommand | null {
    const id = this.commandId;
    const clientApp = (this.client as unknown as { application?: { commands?: { cache: Collection<Snowflake, ApplicationCommand> } } }).application;
    return (
      (this.guild?.commands?.cache.get(id) as ApplicationCommand | undefined) ??
      clientApp?.commands?.cache.get(id) ??
      null
    );
  }

  /**
   * Transforms an option received from the API.
   * @private
   */
  public transformOption(option: APIAutocompleteOption): ExtendedCommandInteractionOption {
    const result: ExtendedCommandInteractionOption = {
      name: option.name,
      type: (ApplicationCommandOptionTypes[option.type] as ApplicationCommandOptionType) ?? 'STRING',
    };

    if ('value' in option) result.value = option.value;
    if ('options' in option && option.options) {
      result.options = option.options.map(opt => this.transformOption(opt));
    }
    if ('focused' in option) result.focused = option.focused;

    return result;
  }

  /**
   * Sends results for the autocomplete of this interaction.
   */
  public async respond(options: ApplicationCommandOptionChoiceData[]): Promise<void> {
    if (this.responded) throw new DJSError('INTERACTION_ALREADY_REPLIED');

    const api = this.client.api as unknown as {
      interactions: (id: Snowflake, token: string) => {
        callback: {
          post(opts: { data: unknown; auth?: boolean }): Promise<void>;
        };
      };
    };

    await api.interactions(this.id, this.token).callback.post({
      data: {
        type: InteractionResponseTypes.APPLICATION_COMMAND_AUTOCOMPLETE_RESULT,
        data: {
          choices: options.map(choice => ({
            ...choice,
            name_localizations: choice.nameLocalizations,
          })),
        },
      },
      auth: false,
    });
    this.responded = true;
  }
}

export default AutocompleteInteraction;
