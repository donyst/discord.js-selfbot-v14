import type { Client } from '../client/Client.js';
import type { Snowflake } from '../types/index.js';

export interface ClientUserLike {
  id: Snowflake;
  [key: string]: unknown;
}

/**
 * Represents a data model that is identifiable by a Snowflake (i.e. Discord API data models).
 */
export abstract class Base<Id = Snowflake> {
  public readonly client: Client;
  public declare id: Id;

  public constructor(client: Client) {
    Object.defineProperty(this, 'client', { value: client });
  }

  public _clone(): this {
    return Object.assign(Object.create(this), this);
  }

  public _patch(data: unknown): unknown {
    return data;
  }

  public _update(data: unknown): this {
    const clone = this._clone();
    this._patch(data);
    return clone;
  }

  public toJSON(...props: Record<string, boolean | string>[]): unknown {
    const json: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(this)) {
      if (k === 'client' || typeof v === 'function' || k.startsWith('_')) continue;
      json[k] = v;
    }
    if (props.length) {
      for (const prop of props) {
        for (const [key, value] of Object.entries(prop)) {
          if (value === true && key in this) {
            json[key] = (this as unknown as Record<string, unknown>)[key];
          }
        }
      }
    }
    return json;
  }

  public valueOf(): string | number | null {
    return (this as unknown as { id?: string | number }).id ?? null;
  }
}

export default Base;
