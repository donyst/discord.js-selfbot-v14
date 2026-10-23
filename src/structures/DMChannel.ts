import { Collection } from '@discordjs/collection';
import { Channel } from './Channel.js';
import TextBasedChannel from './interfaces/TextBasedChannel.js';
import MessageManager from '../managers/MessageManager.js';
import { Opcodes, Status } from '../util/Constants.js';
import { DiscordjsError as DjsError } from '../errors/index.js';
import type { Snowflake } from '../types/index.js';
import type { Client } from '../client/Client.js';
import type { User } from './User.js';

export interface APIDMChannelData {
  id?: Snowflake;
  type?: number | string;
  recipients?: unknown[];
  last_message_id?: Snowflake | null;
  last_pin_timestamp?: string | null;
  is_message_request?: boolean | null;
  is_message_request_timestamp?: string | null;
  [key: string]: unknown;
}

export interface VoiceAdapterCreatorMethods {
  onVoiceServerUpdate?: (data: unknown) => void;
  onVoiceStateUpdate?: (data: unknown) => void;
  destroy?: () => void;
  [key: string]: unknown;
}

export interface DMChannel extends Channel, TextBasedChannel {}

/**
 * Represents a direct message channel between two users.
 */
export class DMChannel extends Channel {
  public messages: MessageManager;
  public recipient!: User;
  public lastMessageId: Snowflake | null = null;
  public lastPinTimestamp: number | null = null;
  public messageRequest: boolean | null = null;
  public messageRequestTimestamp: number | null = null;

  public constructor(client: Client, data?: APIDMChannelData) {
    super(client, data as import('./Channel.js').APIChannelData);

    this.type = 'DM';
    this.messages = new MessageManager(this);
  }

  public override _patch(data: APIDMChannelData): this {
    super._patch(data as import('./Channel.js').APIChannelData);

    if (data.recipients && Array.isArray(data.recipients)) {
      this.recipient = (this.client.users as unknown as { _add(u: unknown): User })._add(data.recipients[0]);
    }

    if ('last_message_id' in data) {
      this.lastMessageId = data.last_message_id ?? null;
    }

    if ('last_pin_timestamp' in data) {
      this.lastPinTimestamp = data.last_pin_timestamp ? Date.parse(data.last_pin_timestamp) : null;
    } else {
      this.lastPinTimestamp ??= null;
    }

    if ('is_message_request' in data) {
      this.messageRequest = data.is_message_request ?? null;
    }

    if ('is_message_request_timestamp' in data) {
      this.messageRequestTimestamp = data.is_message_request_timestamp
        ? Date.parse(data.is_message_request_timestamp)
        : null;
    }

    return this;
  }

  public async acceptMessageRequest(): Promise<DMChannel> {
    if (!this.messageRequest) {
      throw new DjsError('NOT_MESSAGE_REQUEST', 'This channel is not a message request');
    }
    const c = await (this.client as unknown as {
      api: {
        channels: Record<string, { recipients: Record<string, { put(opts: { data: { consent_status: number } }): Promise<unknown> }> }>;
      };
    }).api.channels[this.id]!.recipients['@me']!.put({
      data: {
        consent_status: 2,
      },
    });
    this.messageRequest = false;
    return (this.client.channels as unknown as { _add(ch: unknown): DMChannel })._add(c);
  }

  public async cancelMessageRequest(): Promise<this> {
    if (!this.messageRequest) {
      throw new DjsError('NOT_MESSAGE_REQUEST', 'This channel is not a message request');
    }
    await (this.client as unknown as {
      api: {
        channels: Record<string, { recipients: Record<string, { delete(): Promise<void> }> }>;
      };
    }).api.channels[this.id]!.recipients['@me']!.delete();
    return this;
  }

  public get partial(): boolean {
    return typeof this.lastMessageId === 'undefined';
  }

  public fetch(force = true): Promise<DMChannel> {
    return (this.recipient as unknown as { createDM(f?: boolean): Promise<DMChannel> }).createDM(force);
  }

  public override toString(): string {
    return this.recipient ? this.recipient.toString() : super.toString();
  }

  public sync(): void {
    (this.client as unknown as { ws: { broadcast(d: unknown): void } }).ws.broadcast({
      op: Opcodes.DM_UPDATE,
      d: {
        channel_id: this.id,
      },
    });
  }

  public ring(): Promise<void> {
    return (this.client as unknown as {
      api: {
        channels(chId: Snowflake): {
          call: {
            ring: {
              post(opts: { data: { recipients: null } }): Promise<void>;
            };
          };
        };
      };
    }).api
      .channels(this.id)
      .call.ring.post({
        data: {
          recipients: null,
        },
      });
  }

  public get voiceUsers(): Collection<Snowflake, User> {
    const coll = new Collection<Snowflake, User>();
    const voiceStates = (this.client as unknown as { voiceStates?: { cache: Collection<Snowflake, { channelId?: Snowflake | null; user?: User | null; id: Snowflake }> } }).voiceStates;
    if (voiceStates?.cache) {
      for (const state of voiceStates.cache.values()) {
        if (state.channelId === this.id && state.user) {
          coll.set(state.id, state.user);
        }
      }
    }
    return coll;
  }

  public get shard(): unknown {
    return (this.client as unknown as { ws: { shards: Collection<number, unknown> } }).ws.shards.first();
  }

  public get voiceAdapterCreator(): (methods: VoiceAdapterCreatorMethods) => { sendPayload(data: unknown): boolean; destroy(): void } {
    return methods => {
      (this.client as unknown as { voice: { adapters: Map<string, VoiceAdapterCreatorMethods> } }).voice.adapters.set(this.id, methods);
      return {
        sendPayload: (data: unknown) => {
          const shard = this.shard as { status: number; send(d: unknown): void } | undefined;
          if (!shard || shard.status !== Status.READY) return false;
          shard.send(data);
          return true;
        },
        destroy: () => {
          (this.client as unknown as { voice: { adapters: Map<string, VoiceAdapterCreatorMethods> } }).voice.adapters.delete(this.id);
        },
      };
    };
  }
}

TextBasedChannel.applyToClass(DMChannel, true, [
  'fetchWebhooks',
  'createWebhook',
  'setRateLimitPerUser',
  'setNSFW',
]);

export default DMChannel;
