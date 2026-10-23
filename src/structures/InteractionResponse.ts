import { setTimeout, clearTimeout } from 'node:timers';
import type { Snowflake } from 'discord-api-types/v10';
import Base from './Base.js';
import { DiscordjsError as Error } from '../errors/index.js';
import { Events } from '../util/Constants.js';
import SnowflakeUtil from '../util/SnowflakeUtil.js';
import type { Client } from '../client/Client.js';
import type { Guild } from './Guild.js';
import type { Modal } from './Modal.js';
import type TextBasedChannel from './interfaces/TextBasedChannel.js';

export interface InteractionResponseData {
  id?: Snowflake;
  nonce?: Snowflake;
  channelId?: Snowflake;
  guildId?: Snowflake;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Represents an interaction response on Discord.
 * @extends {Base}
 */
export class InteractionResponse extends Base {
  public declare id: Snowflake;
  public nonce?: Snowflake;
  public channelId!: Snowflake;
  public guildId: Snowflake | null = null;
  public sendData?: Record<string, unknown>;

  public constructor(client: Client, data: InteractionResponseData) {
    super(client);
    this.channelId = data.channelId!;
    this.guildId = data.guildId ?? (this.channel as { guild?: Guild } | null)?.guild?.id ?? null;
    this.sendData = data.metadata;
    this._patch(data);
  }

  public _patch(data: InteractionResponseData): void {
    if ('id' in data && data.id) {
      this.id = data.id;
    }
    if ('nonce' in data && data.nonce) {
      this.nonce = data.nonce;
    }
  }

  /**
   * The timestamp the interaction response was created at
   */
  public get createdTimestamp(): number {
    return SnowflakeUtil.timestampFrom(this.id);
  }

  /**
   * The time the interaction response was created at
   */
  public get createdAt(): Date {
    return new Date(this.createdTimestamp);
  }

  /**
   * The channel that the interaction was sent in
   */
  public get channel(): TextBasedChannel | null {
    return (this.client.channels.resolve(this.channelId) as unknown as TextBasedChannel) ?? null;
  }

  /**
   * The guild the interaction was sent in (if in a guild channel)
   */
  public get guild(): Guild | null {
    return (
      (this.client.guilds.resolve(this.guildId!) as Guild | null) ??
      (this.channel as { guild?: Guild } | null)?.guild ??
      null
    );
  }

  /**
   * Get Modal sent from interaction
   * @param time Time to wait for modal in milliseconds
   */
  public awaitModal(time: number): Promise<Modal> {
    if (!time || typeof time !== 'number' || time < 0) {
      throw new Error('INVALID_TIME');
    }
    return new Promise<Modal>((resolve, reject) => {
      let timeout: NodeJS.Timeout;
      const handler = (modal: Modal): void => {
        timeout.refresh();
        if (modal.nonce !== this.nonce || modal.id !== this.id) return;
        clearTimeout(timeout);
        this.client.removeListener(Events.INTERACTION_MODAL_CREATE, handler as (...args: unknown[]) => void);
        this.client.decrementMaxListeners();
        resolve(modal);
      };
      timeout = setTimeout(() => {
        this.client.removeListener(Events.INTERACTION_MODAL_CREATE, handler as (...args: unknown[]) => void);
        this.client.decrementMaxListeners();
        reject(new Error('MODAL_TIMEOUT'));
      }, time).unref();
      this.client.incrementMaxListeners();
      this.client.on(Events.INTERACTION_MODAL_CREATE, handler as (...args: unknown[]) => void);
    });
  }
}

export default InteractionResponse;
