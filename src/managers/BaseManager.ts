import type { Client } from '../client/Client.js';

/**
 * Manages the API methods of a data model.
 */
export abstract class BaseManager {
  public readonly client: Client;

  public constructor(client: Client) {
    Object.defineProperty(this, 'client', { value: client });
  }
}

export default BaseManager;
