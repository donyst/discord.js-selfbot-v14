import BaseMessageComponent, { type BaseMessageComponentOptions } from './BaseMessageComponent.js';
import { RangeError as DjsRangeError } from '../errors/index.js';
import { MessageComponentTypes, TextInputStyles } from '../util/Constants.js';
import Util from '../util/Util.js';

export type TextInputStyle = keyof typeof TextInputStyles;
export type TextInputStyleResolvable = TextInputStyle | number | string;

export interface TextInputComponentOptions extends BaseMessageComponentOptions {
  custom_id?: string | null;
  customId?: string | null;
  label?: string | null;
  max_length?: number | null;
  maxLength?: number | null;
  min_length?: number | null;
  minLength?: number | null;
  placeholder?: string | null;
  required?: boolean;
  style?: TextInputStyleResolvable | null;
  value?: string | null;
}

export interface APITextInput {
  custom_id: string | null;
  label: string | null;
  max_length: number | null;
  min_length: number | null;
  placeholder: string | null;
  required: boolean;
  style: number | undefined;
  type: number | undefined;
  value: string | null;
}

export class TextInputComponent extends BaseMessageComponent {
  public customId: string | null = null;
  public label: string | null = null;
  public maxLength: number | null = null;
  public minLength: number | null = null;
  public placeholder: string | null = null;
  public required: boolean = false;
  public style: TextInputStyle | null = null;
  public value: string | null = null;

  public constructor(data: TextInputComponent | TextInputComponentOptions = {}) {
    super({ type: 'TEXT_INPUT' });
    this.setup(data as Record<string, unknown>);
  }

  public override setup(data: Record<string, unknown>): void {
    super.setup(data);
    const d = data as unknown as TextInputComponentOptions;

    this.customId = d.custom_id ?? d.customId ?? null;
    this.label = d.label ?? null;
    this.maxLength = d.max_length ?? d.maxLength ?? null;
    this.minLength = d.min_length ?? d.minLength ?? null;
    this.placeholder = d.placeholder ?? null;
    this.required = d.required ?? false;
    this.style = d.style != null ? TextInputComponent.resolveStyle(d.style) : null;
    this.value = d.value ?? null;
  }

  public setValue(value: string): this {
    this.value = Util.verifyString(value, DjsRangeError, 'TEXT_INPUT_VALUE');
    return this;
  }

  public override toJSON(): APITextInput {
    return {
      custom_id: this.customId,
      label: this.label,
      max_length: this.maxLength,
      min_length: this.minLength,
      placeholder: this.placeholder,
      required: this.required,
      style: this.style ? (TextInputStyles as Record<string, number>)[this.style] : undefined,
      type: this.type ? (MessageComponentTypes as Record<string, number>)[this.type] : undefined,
      value: this.value,
    };
  }

  public static resolveStyle(style: TextInputStyleResolvable): TextInputStyle {
    if (typeof style === 'string' && isNaN(Number(style))) return style as TextInputStyle;
    return (TextInputStyles as Record<string | number, TextInputStyle>)[style];
  }
}

export default TextInputComponent;
