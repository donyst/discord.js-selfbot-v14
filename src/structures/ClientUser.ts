import { setInterval } from 'node:timers';
import { Collection } from '@discordjs/collection';
import Invite, { type APIInviteData } from './Invite.js';
import User, { type APIUserData } from './User.js';
import DataResolver, { type Base64Resolvable } from '../util/DataResolver.js';
import PremiumUsageFlags from '../util/PremiumUsageFlags.js';
import PurchasedFlags from '../util/PurchasedFlags.js';
import Util, { type ColorResolvable } from '../util/Util.js';
import type { Snowflake } from '../types/index.js';
import type { ClientPresence, PresenceData } from './ClientPresence.js';

export interface ClientUserEditData {
  username?: string;
  password?: string;
  avatar?: Base64Resolvable | null;
  banner?: Base64Resolvable | null;
  bio?: string | null;
  pronouns?: string | null;
  global_name?: string | null;
  accent_color?: number | null;
  [key: string]: unknown;
}

export interface ActivityOptions {
  name?: string;
  state?: string;
  type?: number | string;
  url?: string;
  shardId?: number | number[];
  [key: string]: unknown;
}

export class ClientUser extends User {
  #packageName: string | null = null;
  #intervalSamsungPresence: NodeJS.Timeout | null = setInterval(() => {
    (this.client as unknown as { emit(ev: string, msg: string): void }).emit('debug', `[UPDATE] Samsung Presence: ${this.#packageName}`);
    if (!this.#packageName) return;
    this.setSamsungActivity(this.#packageName, 'UPDATE');
  }, 1000 * 60 * 10).unref();

  public verified!: boolean;
  public mfaEnabled: boolean | null = null;
  public purchasedFlags: Readonly<PurchasedFlags> = new PurchasedFlags().freeze();
  public premiumUsageFlags: Readonly<PremiumUsageFlags> = new PremiumUsageFlags().freeze();
  public phone?: string;
  public nsfwAllowed?: boolean;
  public email?: string;
  public bio?: string;
  public pronouns?: string;
  public premiumType?: number;

  public override _patch(data: APIUserData): this {
    super._patch(data);

    if ('verified' in data && data.verified != null) {
      this.verified = Boolean(data.verified);
    }

    if ('mfa_enabled' in data) {
      this.mfaEnabled = typeof data.mfa_enabled === 'boolean' ? data.mfa_enabled : null;
    } else {
      this.mfaEnabled ??= null;
    }

    if ('token' in data && typeof data.token === 'string') {
      this.client.token = data.token;
    }

    if ('purchased_flags' in data && data.purchased_flags != null) {
      this.purchasedFlags = new PurchasedFlags(Number(data.purchased_flags) || 0).freeze();
    } else {
      this.purchasedFlags = new PurchasedFlags().freeze();
    }

    if ('premium_usage_flags' in data && data.premium_usage_flags != null) {
      this.premiumUsageFlags = new PremiumUsageFlags(Number(data.premium_usage_flags) || 0);
    } else {
      this.premiumUsageFlags = new PremiumUsageFlags().freeze();
    }

    if ('phone' in data && typeof data.phone === 'string') {
      this.phone = data.phone;
    }

    if ('nsfw_allowed' in data && typeof data.nsfw_allowed === 'boolean') {
      this.nsfwAllowed = data.nsfw_allowed;
    }

    if ('email' in data && typeof data.email === 'string') {
      this.email = data.email;
    }

    if ('bio' in data && typeof data.bio === 'string') {
      this.bio = data.bio;
    }

    if ('pronouns' in data && typeof data.pronouns === 'string') {
      this.pronouns = data.pronouns;
    }

    if ('premium_type' in data && typeof data.premium_type === 'number') {
      this.premiumType = data.premium_type;
    }

    return this;
  }

  public get presence(): ClientPresence {
    return (this.client as unknown as { presence: ClientPresence }).presence;
  }

  public async edit(options: ClientUserEditData = {}): Promise<ClientUser> {
    const data = await (this.client as unknown as { api: { users: (id: string) => { patch: (opts: { data: unknown }) => Promise<APIUserData> } } })
      .api.users('@me')
      .patch({ data: options });

    const handleResult = (this.client as unknown as { actions: { UserUpdate: { handle(d: unknown): { updated?: ClientUser } } } })
      .actions.UserUpdate.handle(data);

    return handleResult?.updated ?? this;
  }

  public setUsername(username: string, password?: string): Promise<ClientUser> {
    return this.edit({ username, password });
  }

  public async setAvatar(avatar: Base64Resolvable | null): Promise<ClientUser> {
    const resolvedAvatar = avatar ? await DataResolver.resolveImage(avatar) : null;
    return this.edit({ avatar: resolvedAvatar });
  }

  public setPresence(data: PresenceData): ClientPresence {
    return this.presence.set(data);
  }

  public setStatus(status: 'online' | 'idle' | 'invisible' | 'dnd', shardId?: number | number[]): ClientPresence {
    return this.setPresence({ status, shardId });
  }

  public setActivity(name?: string | ActivityOptions, options: ActivityOptions = {}): ClientPresence {
    if (!name) return this.setPresence({ activities: [], shardId: options.shardId });

    const activity = Object.assign({}, options, typeof name === 'object' ? name : { name });
    return this.setPresence({ activities: [activity], shardId: activity.shardId });
  }

  public setAFK(afk: boolean = true, shardId?: number | number[]): ClientPresence {
    return this.setPresence({ afk, shardId });
  }

  public async setBanner(banner: Base64Resolvable | null): Promise<ClientUser> {
    const resolvedBanner = banner ? await DataResolver.resolveImage(banner) : null;
    return this.edit({ banner: resolvedBanner });
  }

  public setHypeSquad(type: 'LEAVE' | 'HOUSE_BRAVERY' | 'HOUSE_BRILLIANCE' | 'HOUSE_BALANCE' | number): Promise<unknown> {
    let resolvedType: number;
    switch (type) {
      case 'LEAVE':
        resolvedType = 0;
        break;
      case 'HOUSE_BRAVERY':
        resolvedType = 1;
        break;
      case 'HOUSE_BRILLIANCE':
        resolvedType = 2;
        break;
      case 'HOUSE_BALANCE':
        resolvedType = 3;
        break;
      default:
        resolvedType = Number(type);
        break;
    }

    const hypesquadApi = (this.client as unknown as { api: { hypesquad: { online: { delete(): Promise<unknown>; post(opts: { data: { house_id: number } }): Promise<unknown> } } } }).api.hypesquad.online;
    if (resolvedType === 0) {
      return hypesquadApi.delete();
    }
    return hypesquadApi.post({
      data: { house_id: resolvedType },
    });
  }

  public setAccentColor(color: ColorResolvable | null = null): Promise<ClientUser> {
    return this.edit({ accent_color: color ? Util.resolveColor(color) : null });
  }

  public setAboutMe(bio: string | null = null): Promise<ClientUser> {
    return this.edit({ bio });
  }

  public async createFriendInvite(): Promise<Invite> {
    const data = await (this.client as unknown as { api: { users: { '@me': { invites: { post(opts: { data: unknown }): Promise<APIInviteData> } } } } })
      .api.users['@me'].invites.post({ data: {} });
    return new Invite(this.client, data);
  }

  public async getAllFriendInvites(): Promise<Collection<string, Invite>> {
    const data = await (this.client as unknown as { api: { users: { '@me': { invites: { get(): Promise<APIInviteData[]> } } } } })
      .api.users['@me'].invites.get();
    const collection = new Collection<string, Invite>();
    for (const invite of data) {
      if (invite.code) collection.set(invite.code, new Invite(this.client, invite));
    }
    return collection;
  }

  public revokeAllFriendInvites(): Promise<void> {
    return (this.client as unknown as { api: { users: { '@me': { invites: { delete(): Promise<void> } } } } })
      .api.users['@me'].invites.delete();
  }

  public async setSamsungActivity(packageName: string, type: 'START' | 'UPDATE' | 'STOP' | string = 'START'): Promise<this> {
    const upperType = type.toUpperCase();
    if (!packageName || typeof packageName !== 'string') throw new Error('Package name is required.');
    if (!['START', 'UPDATE', 'STOP'].includes(upperType)) {
      throw new Error('Invalid type (Must be START, UPDATE, or STOP)');
    }

    await (this.client as unknown as { api: { presences: { post(opts: { data: unknown }): Promise<unknown> } } }).api.presences.post({
      data: {
        package_name: packageName,
        update: upperType,
      },
    });

    if (upperType !== 'STOP') {
      this.#packageName = packageName;
    } else {
      this.#packageName = null;
      if (this.#intervalSamsungPresence) {
        clearInterval(this.#intervalSamsungPresence);
        this.#intervalSamsungPresence = null;
      }
    }
    return this;
  }

  public stopRinging(channel: Snowflake | { id?: Snowflake }): Promise<void> {
    const channelId = (this.client.channels as unknown as { resolveId(c: unknown): Snowflake | null }).resolveId(channel);
    return (this.client as unknown as { api: { channels(id: Snowflake | null): { call: { 'stop-ringing': { post(opts: { data: unknown }): Promise<void> } } } } })
      .api.channels(channelId).call['stop-ringing'].post({ data: {} });
  }

  public fetchBurstCredit(): Promise<number> {
    return (this.client as unknown as { api: { users: { '@me': { 'burst-credits': { get(): Promise<{ amount: number }> } } } } })
      .api.users['@me']['burst-credits'].get().then(d => d.amount);
  }

  public setGlobalName(globalName: string = ''): Promise<ClientUser> {
    return this.edit({ global_name: globalName });
  }

  public setPronouns(pronouns: string = ''): Promise<ClientUser> {
    return this.edit({ pronouns });
  }
}

export default ClientUser;
