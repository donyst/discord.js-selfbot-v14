import BaseMessageComponent, { type AnyComponent } from './BaseMessageComponent.js';
import { InteractionTypes } from '../util/Constants.js';
import SnowflakeUtil from '../util/SnowflakeUtil.js';
import Util from '../util/Util.js';
import type { Snowflake } from '../types/index.js';
import type { Client } from '../client/Client.js';
import type { Guild } from './Guild.js';
import type TextBasedChannel from './interfaces/TextBasedChannel.js';
import type MessageActionRow from './MessageActionRow.js';

export interface APIModalData {
  components?: Record<string, unknown>[];
  custom_id?: string;
  title?: string;
  nonce?: Snowflake;
  id?: Snowflake;
  application?: { id: Snowflake };
  application_id?: Snowflake;
  channel_id?: Snowflake;
  [key: string]: unknown;
}

export class Modal {
  public components: MessageActionRow[] = [];
  public customId?: string;
  public title?: string;
  public nonce?: Snowflake;
  public id?: Snowflake;
  public applicationId?: Snowflake;
  public channelId?: Snowflake;
  public replied: boolean = false;
  public readonly client!: Client;

  public constructor(data: APIModalData = {}, client: Client | null = null) {
    if (data.components) {
      this.components = data.components
        .map(c => BaseMessageComponent.create(c, client))
        .filter((c): c is AnyComponent => c !== null) as MessageActionRow[];
    }

    this.customId = data.custom_id;
    this.title = data.title;
    this.nonce = data.nonce;
    this.id = data.id;
    this.applicationId = data.application?.id ?? data.application_id;
    this.channelId = data.channel_id;
    this.replied = false;

    Object.defineProperty(this, 'client', {
      value: client,
      writable: false,
    });
  }

  public get guildId(): Snowflake | null {
    if (!this.channelId) return null;
    const channel = (this.client?.channels?.cache as { get(id: Snowflake): { guildId?: Snowflake } | undefined })?.get(
      this.channelId,
    );
    return channel?.guildId ?? null;
  }

  public get channel(): TextBasedChannel | null {
    if (!this.channelId || !this.client) return null;
    return (this.client.channels as unknown as { resolve(id: Snowflake): TextBasedChannel | null }).resolve(
      this.channelId,
    );
  }

  public get guild(): Guild | null {
    if (!this.client) return null;
    return (
      (this.guildId
        ? (this.client.guilds as unknown as { resolve(id: Snowflake): Guild | null }).resolve(this.guildId)
        : null) ??
      ((this.channel as unknown as { guild?: Guild })?.guild ?? null)
    );
  }

  public toJSON(): Record<string, unknown> {
    return {
      components: this.components.map(c => c.toJSON()),
      custom_id: this.customId,
      title: this.title,
      id: this.id,
    };
  }

  public reply(): Promise<unknown> {
    if (!this.applicationId || !this.client || !this.channelId || this.replied) {
      throw new Error('Modal cannot reply');
    }

    const dataFinal = this.toJSON() as {
      components: {
        components: { type: unknown; value: unknown; custom_id: unknown }[];
      }[];
      title?: unknown;
    };

    dataFinal.components = dataFinal.components
      .map(c => {
        c.components[0] = {
          type: c.components[0].type,
          value: c.components[0].value,
          custom_id: c.components[0].custom_id,
        };
        return c;
      })
      .filter(c => typeof c.components[0].value === 'string');

    delete dataFinal.title;
    const nonce = SnowflakeUtil.generate();
    const postData = {
      type: InteractionTypes.MODAL_SUBMIT,
      application_id: this.applicationId,
      guild_id: this.guildId,
      channel_id: this.channelId,
      data: dataFinal,
      nonce,
      session_id: (this.client as unknown as { sessionId?: string }).sessionId,
    };

    (this.client as unknown as { api: { interactions: { post(opts: { data: unknown }): Promise<unknown> } } }).api.interactions.post({
      data: postData,
    });
    this.replied = true;
    return Util.createPromiseInteraction(this.client, nonce, 5_000, true, this);
  }

  public get isMessage(): boolean {
    return false;
  }
}

export default Modal;
