import BaseMessageComponent, {
  type BaseMessageComponentOptions,
} from './BaseMessageComponent.js';
import { RangeError as DjsRangeError } from '../errors/index.js';
import { ChannelTypes, MessageComponentTypes } from '../util/Constants.js';
import Util, { type RawEmoji, type EmojiIdentifierResolvable } from '../util/Util.js';

export type ChannelTypeString = keyof typeof ChannelTypes;

export interface MessageSelectOption {
  label: string;
  value: string;
  description: string | null;
  emoji: RawEmoji | null;
  default: boolean;
}

export interface MessageSelectOptionData {
  label: string;
  value: string;
  description?: string | null;
  emoji?: EmojiIdentifierResolvable | null;
  default?: boolean;
}

export interface MessageSelectMenuOptions extends BaseMessageComponentOptions {
  custom_id?: string | null;
  customId?: string | null;
  placeholder?: string | null;
  min_values?: number | null;
  minValues?: number | null;
  max_values?: number | null;
  maxValues?: number | null;
  options?: MessageSelectOptionData[];
  disabled?: boolean;
  channel_types?: (ChannelTypeString | number)[];
  channelTypes?: (ChannelTypeString | number)[];
}

export interface APIMessageSelectMenu {
  channel_types: (number | ChannelTypeString)[];
  custom_id: string | null;
  disabled: boolean;
  placeholder: string | null;
  min_values: number | null;
  max_values: number | undefined;
  options: MessageSelectOption[];
  type: number | string | undefined;
}

export class MessageSelectMenu extends BaseMessageComponent {
  public customId: string | null = null;
  public placeholder: string | null = null;
  public minValues: number | null = null;
  public maxValues: number | null = null;
  public options: MessageSelectOption[] = [];
  public disabled: boolean = false;
  public channelTypes: ChannelTypeString[] = [];

  public constructor(data: MessageSelectMenu | MessageSelectMenuOptions = {}) {
    const rawType = data.type ? BaseMessageComponent.resolveType(data.type) : 'STRING_SELECT';
    super({ type: rawType });
    this.setup(data as Record<string, unknown>);
  }

  public override setup(data: Record<string, unknown>): void {
    super.setup(data);
    const d = data as unknown as MessageSelectMenuOptions;

    this.customId = d.custom_id ?? d.customId ?? null;
    this.placeholder = d.placeholder ?? null;
    this.minValues = d.min_values ?? d.minValues ?? null;
    this.maxValues = d.max_values ?? d.maxValues ?? null;
    this.options = MessageSelectMenu.normalizeOptions(d.options ?? []);
    this.disabled = d.disabled ?? false;

    const rawChannelTypes = d.channel_types ?? d.channelTypes ?? [];
    this.channelTypes = rawChannelTypes.map(channelType =>
      typeof channelType === 'string'
        ? (channelType as ChannelTypeString)
        : ((ChannelTypes as Record<number, ChannelTypeString>)[channelType] ?? channelType),
    ) as ChannelTypeString[];
  }

  public override toJSON(): APIMessageSelectMenu {
    return {
      channel_types: this.channelTypes.map(type =>
        typeof type === 'string' ? (ChannelTypes as Record<string, number>)[type] : type,
      ),
      custom_id: this.customId,
      disabled: this.disabled,
      placeholder: this.placeholder,
      min_values: this.minValues,
      max_values: this.maxValues ?? (this.minValues ? this.options.length : undefined),
      options: this.options,
      type: this.type ? (MessageComponentTypes as Record<string, number>)[this.type] : undefined,
    };
  }

  public static normalizeOption(option: MessageSelectOptionData): MessageSelectOption {
    let { label, value, description, emoji } = option;

    label = Util.verifyString(label, DjsRangeError, 'SELECT_OPTION_LABEL');
    value = Util.verifyString(value, DjsRangeError, 'SELECT_OPTION_VALUE');
    const resolvedEmoji = emoji ? Util.resolvePartialEmoji(emoji) : null;
    const resolvedDescription = description
      ? Util.verifyString(description, DjsRangeError, 'SELECT_OPTION_DESCRIPTION', true)
      : null;

    return {
      label,
      value,
      description: resolvedDescription,
      emoji: resolvedEmoji,
      default: option.default ?? false,
    };
  }

  public static normalizeOptions(
    ...options: (MessageSelectOptionData | MessageSelectOptionData[])[]
  ): MessageSelectOption[] {
    return (options.flat(Infinity) as MessageSelectOptionData[]).map(option => this.normalizeOption(option));
  }
}

export default MessageSelectMenu;
