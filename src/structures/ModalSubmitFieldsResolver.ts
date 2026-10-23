import { DiscordjsTypeError as DJSTypeError } from '../errors/index.js';
import { MessageComponentTypes, type MessageComponentType } from '../util/Constants.js';

export interface PartialTextInputData {
  customId: string;
  type: MessageComponentType;
  value: string;
}

export interface PartialModalActionRow {
  type: MessageComponentType;
  components: PartialTextInputData[];
}

/**
 * A resolver for modal submit interaction text inputs.
 */
export class ModalSubmitFieldsResolver {
  /**
   * The components within the modal
   */
  public components: PartialModalActionRow[];

  public constructor(components: PartialModalActionRow[]) {
    this.components = components;
  }

  /**
   * The extracted fields from the modal
   * @private
   */
  public get _fields(): PartialTextInputData[] {
    return this.components.reduce<PartialTextInputData[]>(
      (previous, next) => previous.concat(next.components),
      [],
    );
  }

  /**
   * Gets a field given a custom id from a component
   */
  public getField(customId: string): PartialTextInputData {
    const field = this._fields.find(f => f.customId === customId);
    if (!field) throw new DJSTypeError('MODAL_SUBMIT_INTERACTION_FIELD_NOT_FOUND', customId);
    return field;
  }

  /**
   * Gets the value of a text input component given a custom id
   */
  public getTextInputValue(customId: string): string {
    const field = this.getField(customId);
    const expectedType = MessageComponentTypes[MessageComponentTypes.TEXT_INPUT] as unknown as MessageComponentType;
    if (field.type !== expectedType) {
      throw new DJSTypeError('MODAL_SUBMIT_INTERACTION_FIELD_TYPE', customId, field.type, expectedType);
    }
    return field.value;
  }
}

export default ModalSubmitFieldsResolver;
