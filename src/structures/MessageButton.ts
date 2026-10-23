import BaseMessageComponent, { type BaseMessageComponentOptions } from './BaseMessageComponent.js';
import { RangeError as DjsRangeError } from '../errors/index.js';
import { MessageButtonStyles, MessageComponentTypes } from '../util/Constants.js';
import Util, { type RawEmoji, type EmojiIdentifierResolvable } from '../util/Util.js';

export type MessageButtonStyle = keyof typeof MessageButtonStyles;
export type MessageButtonStyleResolvable = MessageButtonStyle | number | string;

export interface MessageButtonOptions extends BaseMessageComponentOptions {
  label?: string | null;
  custom_id?: string | null;
  customId?: string | null;
  style?: MessageButtonStyleResolvable | null;
  emoji?: EmojiIdentifierResolvable | null;
  url?: string | null;
  disabled?: boolean;
}

export interface APIMessageButton {
  custom_id: string | null;
  disabled: boolean;
  emoji: RawEmoji | null;
  label: string | null;
  style: number | undefined;
  type: number | undefined;
  url: string | null;
}

export class MessageButton extends BaseMessageComponent {
  public label: string | null = null;
  public customId: string | null = null;
  public style: MessageButtonStyle | null = null;
  public emoji: RawEmoji | null = null;
  public url: string | null = null;
  public disabled: boolean = false;

  public constructor(data: MessageButton | MessageButtonOptions = {}) {
    super({ type: 'BUTTON' });
    this.setup(data as Record<string, unknown>);
  }

  public override setup(data: Record<string, unknown>): void {
    super.setup(data);
    const d = data as unknown as MessageButtonOptions;

    this.label = d.label ?? null;
    this.customId = d.custom_id ?? d.customId ?? null;
    this.style = d.style != null ? MessageButton.resolveStyle(d.style) : null;
    this.emoji = d.emoji ? Util.resolvePartialEmoji(d.emoji) : null;
    this.url = d.url ?? null;
    this.disabled = d.disabled ?? false;
  }

  public setCustomId(customId: string): this {
    this.customId = Util.verifyString(customId, DjsRangeError, 'BUTTON_CUSTOM_ID');
    return this;
  }

  public setDisabled(disabled: boolean = true): this {
    this.disabled = disabled;
    return this;
  }

  public setEmoji(emoji: EmojiIdentifierResolvable): this {
    this.emoji = Util.resolvePartialEmoji(emoji);
    return this;
  }

  public setLabel(label: string): this {
    this.label = Util.verifyString(label, DjsRangeError, 'BUTTON_LABEL');
    return this;
  }

  public setStyle(style: MessageButtonStyleResolvable): this {
    this.style = MessageButton.resolveStyle(style);
    return this;
  }

  public setURL(url: string): this {
    this.url = Util.verifyString(url, DjsRangeError, 'BUTTON_URL');
    return this;
  }

  public override toJSON(): APIMessageButton {
    return {
      custom_id: this.customId,
      disabled: this.disabled,
      emoji: this.emoji,
      label: this.label,
      style: this.style ? (MessageButtonStyles as Record<string, number>)[this.style] : undefined,
      type: this.type ? (MessageComponentTypes as Record<string, number>)[this.type] : undefined,
      url: this.url,
    };
  }

  public static resolveStyle(style: MessageButtonStyleResolvable): MessageButtonStyle {
    if (typeof style === 'string' && isNaN(Number(style))) return style as MessageButtonStyle;
    return (MessageButtonStyles as Record<string | number, MessageButtonStyle>)[style];
  }
}

export default MessageButton;
