import { Buffer } from 'node:buffer';
import { Collection } from '@discordjs/collection';
import { Channel } from './Channel.js';
import Invite from './Invite.js';
import TextBasedChannel from './interfaces/TextBasedChannel.js';
import MessageManager from '../managers/MessageManager.js';
import { Status, Opcodes } from '../util/Constants.js';
import DataResolver from '../util/DataResolver.js';
import type { Snowflake, ImageURLOptions } from '../types/index.js';
import type { Client } from '../client/Client.js';
import type { User } from './User.js';
import type { VoiceAdapterCreatorMethods } from './DMChannel.js';

export interface APIGroupDMChannelData {
  id?: Snowflake;
  type?: number | string;
  recipients?: { id: Snowflake; [key: string]: unknown }[];
  owner_id?: Snowflake | null;
  last_message_id?: Snowflake | null;
  last_pin_timestamp?: string | null;
  name?: string | null;
  icon?: string | null;
  [key: string]: unknown;
}

export interface GroupDMChannelEditData {
  name?: string | null;
  icon?: string | Buffer | null;
  owner?: Snowflake;
}

export interface GroupDMChannel extends Channel, TextBasedChannel {}

/**
 * Represents a Group DM Channel on Discord.
 */
export class GroupDMChannel extends Channel {
  public messages: MessageManager;
  public _recipients: { id: Snowflake; [key: string]: unknown }[] = [];
  public ownerId: Snowflake | null = null;
  public lastMessageId: Snowflake | null = null;
  public lastPinTimestamp: number | null = null;
  public name: string | null = null;
  public icon: string | null = null;

  public constructor(client: Client, data?: APIGroupDMChannelData) {
    super(client, data);

    this.type = 'GROUP_DM';
    this.messages = new MessageManager(this);
  }

  public override _patch(data: APIGroupDMChannelData): this {
    super._patch(data);

    if ('recipients' in data && Array.isArray(data.recipients)) {
      this._recipients = data.recipients;
      for (const u of data.recipients) {
        (this.client.users as unknown as { _add(user: unknown): void })._add(u);
      }
    } else {
      this._recipients = [];
    }

    if ('owner_id' in data) {
      this.ownerId = data.owner_id ?? null;
    } else {
      this.ownerId ??= null;
    }

    if ('last_message_id' in data) {
      this.lastMessageId = data.last_message_id ?? null;
    } else {
      this.lastMessageId ??= null;
    }

    if ('last_pin_timestamp' in data) {
      this.lastPinTimestamp = data.last_pin_timestamp ? Date.parse(data.last_pin_timestamp) : null;
    } else {
      this.lastPinTimestamp ??= null;
    }

    if ('name' in data) {
      this.name = data.name ?? null;
    }

    if ('icon' in data) {
      this.icon = data.icon ?? null;
    }

    return this;
  }

  public iconURL({ format, size }: ImageURLOptions = {}): string | null {
    return this.icon
      ? (this.client as unknown as { rest: { cdn: { GDMIcon(id: Snowflake, icon: string, format?: string, size?: number): string } } }).rest.cdn.GDMIcon(this.id, this.icon, format, size)
      : null;
  }

  public get recipients(): Collection<Snowflake, User> {
    const collect = new Collection<Snowflake, User>();
    const usersCache = (this.client.users as unknown as { cache: Collection<Snowflake, User> }).cache;
    for (const recipient of this._recipients) {
      const user = usersCache.get(recipient.id);
      if (user) collect.set(recipient.id, user);
    }
    const clientUser = this.client.user as unknown as User | undefined;
    if (clientUser) {
      collect.set(clientUser.id, clientUser);
    }
    return collect;
  }

  public get owner(): User | null {
    if (!this.ownerId) return null;
    return (this.client.users as unknown as { cache: Collection<Snowflake, User> }).cache.get(this.ownerId) ?? null;
  }

  public get partial(): boolean {
    return typeof this.lastMessageId === 'undefined';
  }

  public override async delete(silent = false): Promise<this> {
    interface ChannelEndpoint {
      delete(opts?: { query?: { silent: boolean } }): Promise<void>;
    }
    const endpoint = (this.client as unknown as {
      api: {
        channels: Record<string, ChannelEndpoint>;
      };
    }).api.channels[this.id];

    if (silent) {
      await endpoint?.delete({
        query: {
          silent: true,
        },
      });
    } else {
      await endpoint?.delete();
    }
    return this;
  }

  public override toString(): string {
    return (
      this.name ??
      this._recipients
        .filter(user => user.id !== this.client.user?.id)
        .map(user => (user as { username?: string }).username ?? user.id)
        .join(', ')
    );
  }

  public override toJSON(): unknown {
    const json = super.toJSON({
      createdTimestamp: true,
    }) as Record<string, unknown>;
    json.iconURL = this.iconURL();
    return json;
  }

  public async edit(data: GroupDMChannelEditData): Promise<this> {
    const _data: Record<string, unknown> = {};
    if ('name' in data) _data.name = data.name?.trim() ?? null;
    if (typeof data.icon !== 'undefined') {
      _data.icon = await DataResolver.resolveImage(data.icon as string | Buffer);
    }
    if ('owner' in data) {
      _data.owner = data.owner;
    }

    const newData = await (this.client as unknown as {
      api: {
        channels: Record<string, { patch(opts: { data: Record<string, unknown> }): Promise<unknown> }>;
      };
    }).api.channels[this.id]!.patch({
      data: _data,
    });

    return (this.client as unknown as {
      actions: {
        ChannelUpdate: {
          handle(d: unknown): { updated: GroupDMChannel };
        };
      };
    }).actions.ChannelUpdate.handle(newData).updated as this;
  }

  public setName(name: string | null): Promise<this> {
    return this.edit({ name });
  }

  public setIcon(icon: string | Buffer | null): Promise<this> {
    return this.edit({ icon });
  }

  public setOwner(user: unknown): Promise<this> {
    const id = (this.client.users as unknown as { resolveId(u: unknown): Snowflake | null }).resolveId(user);
    if (this.ownerId === id || !id) {
      return Promise.resolve(this);
    }
    return this.edit({ owner: id });
  }

  public async addUser(user: unknown): Promise<this> {
    const id = (this.client.users as unknown as { resolveId(u: unknown): Snowflake | null }).resolveId(user);
    if (!id) return this;
    await (this.client as unknown as {
      api: {
        channels: Record<string, { recipients: Record<string, { put(): Promise<void> }> }>;
      };
    }).api.channels[this.id]!.recipients[id]!.put();
    return this;
  }

  public async removeUser(user: unknown): Promise<this> {
    const id = (this.client.users as unknown as { resolveId(u: unknown): Snowflake | null }).resolveId(user);
    if (!id) return this;
    await (this.client as unknown as {
      api: {
        channels: Record<string, { recipients: Record<string, { delete(): Promise<void> }> }>;
      };
    }).api.channels[this.id]!.recipients[id]!.delete();
    return this;
  }

  public async getInvite(): Promise<Invite> {
    const inviteCode = await (this.client as unknown as {
      api: {
        channels(chId: Snowflake): {
          invites: {
            post(opts: { data: { max_age: number } }): Promise<unknown>;
          };
        };
      };
    }).api
      .channels(this.id)
      .invites.post({
        data: {
          max_age: 86400,
        },
      });
    return new Invite(this.client as unknown as Client, inviteCode as { code: string; [key: string]: unknown });
  }

  public async fetchAllInvite(): Promise<Collection<string, Invite>> {
    const invites = await (this.client as unknown as {
      api: {
        channels(chId: Snowflake): {
          invites: {
            get(): Promise<{ code: string; [key: string]: unknown }[]>;
          };
        };
      };
    }).api
      .channels(this.id)
      .invites.get();
    return new Collection<string, Invite>(
      invites.map(invite => [invite.code, new Invite(this.client as unknown as Client, invite)]),
    );
  }

  public async removeInvite(invite: { code?: string } | string): Promise<this> {
    let code: string | undefined = typeof invite === 'string' ? invite : invite?.code;
    if (code && URL.canParse(code)) code = new URL(code).pathname.slice(1);
    await (this.client as unknown as {
      api: {
        channels(chId: Snowflake): {
          invites: Record<string, { delete(): Promise<void> }>;
        };
      };
    }).api
      .channels(this.id)
      .invites[code ?? '']!.delete();
    return this;
  }

  public ring(recipients?: unknown[]): Promise<void> {
    let resolvedRecipients: (Snowflake | null)[] | null = null;
    if (recipients && Array.isArray(recipients) && recipients.length > 0) {
      resolvedRecipients = recipients
        .map(r => (this.client.users as unknown as { resolveId(u: unknown): Snowflake | null }).resolveId(r))
        .filter((r): r is Snowflake => Boolean(r && this.recipients.get(r)));
    }
    return (this.client as unknown as {
      api: {
        channels(chId: Snowflake): {
          call: {
            ring: {
              post(opts: { data: { recipients: (Snowflake | null)[] | null } }): Promise<void>;
            };
          };
        };
      };
    }).api
      .channels(this.id)
      .call.ring.post({
        data: {
          recipients: resolvedRecipients,
        },
      });
  }

  public sync(): void {
    (this.client as unknown as { ws: { broadcast(d: unknown): void } }).ws.broadcast({
      op: Opcodes.DM_UPDATE,
      d: {
        channel_id: this.id,
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

TextBasedChannel.applyToClass(GroupDMChannel, true, [
  'fetchWebhooks',
  'createWebhook',
  'setRateLimitPerUser',
  'setNSFW',
]);

export default GroupDMChannel;
