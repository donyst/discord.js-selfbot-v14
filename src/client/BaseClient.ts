import EventEmitter from 'node:events';
import process from 'node:process';
import RESTManager from '../rest/RESTManager.js';
import Options, { type ClientOptions } from '../util/Options.js';
import Util from '../util/Util.js';

/**
 * The base class for all clients.
 * @extends {EventEmitter}
 */
export class BaseClient extends EventEmitter {
  /**
   * The options the client was instantiated with
   */
  public options: ClientOptions;

  /**
   * The REST manager of the client
   */
  public rest: RESTManager;

  public constructor(options: Partial<ClientOptions> = {}) {
    super({ captureRejections: true });

    if ((options as { intents?: unknown }).intents) {
      process.emitWarning('Intents is not available.', 'DeprecationWarning');
    }

    this.options = Util.mergeDefault(Options.createDefault() as unknown as Record<string, unknown>, options as unknown as Record<string, unknown>) as unknown as ClientOptions;
    this.rest = new RESTManager(this as unknown as import('../rest/RESTManager.js').ClientWithREST);
  }

  /**
   * API shortcut
   */
  public get api(): ReturnType<RESTManager['api']> {
    return this.rest.api();
  }

  /**
   * Destroys all assets used by the base client.
   */
  public destroy(): void {
    if (this.rest.sweepInterval) clearInterval(this.rest.sweepInterval);
  }

  /**
   * Increments max listeners by one, if they are not zero.
   */
  public incrementMaxListeners(): void {
    const maxListeners = this.getMaxListeners();
    if (maxListeners !== 0) {
      this.setMaxListeners(maxListeners + 1);
    }
  }

  /**
   * Decrements max listeners by one, if they are not zero.
   */
  public decrementMaxListeners(): void {
    const maxListeners = this.getMaxListeners();
    if (maxListeners !== 0) {
      this.setMaxListeners(maxListeners - 1);
    }
  }

  public toJSON(...props: Record<string, boolean | string>[]): Record<string, unknown> {
    return Util.flatten(this, { domain: false }, ...props) as Record<string, unknown>;
  }
}

export default BaseClient;
