import process from 'node:process';
import { setInterval, setTimeout, clearInterval } from 'node:timers';
import { Collection } from '@discordjs/collection';
import { authenticator } from 'otplib';
import '../structures/ComponentFactory.js';
import '../structures/ChannelFactory.js';
import { BaseClient } from './BaseClient.js';
import { ActionsManager } from './actions/ActionsManager.js';
import ClientVoiceManager from './voice/ClientVoiceManager.js';
import WebSocketManager from './websocket/WebSocketManager.js';
import { DiscordError as Error, TypeError } from '../errors/index.js';
import { BaseGuildEmojiManager } from '../managers/BaseGuildEmojiManager.js';
import { BillingManager } from '../managers/BillingManager.js';
import { ChannelManager } from '../managers/ChannelManager.js';
import { ClientUserSettingManager } from '../managers/ClientUserSettingManager.js';
import { GuildManager } from '../managers/GuildManager.js';
import { PresenceManager } from '../managers/PresenceManager.js';
import { RelationshipManager } from '../managers/RelationshipManager.js';
import { SessionManager } from '../managers/SessionManager.js';
import { UserManager } from '../managers/UserManager.js';
import { UserNoteManager } from '../managers/UserNoteManager.js';
import { VoiceStateManager } from '../managers/VoiceStateManager.js';
import { SoundboardManager } from '../managers/SoundboardManager.js';
import { GameDetectionManager } from '../managers/GameDetectionManager.js';
import { ClientHeartbeatManager } from './ClientHeartbeatManager.js';
import { DiscordIPCServer } from './DiscordIPCServer.js';
import { ClientFingerprintManager } from '../util/ClientFingerprintManager.js';
import { ShardClientUtil } from '../sharding/ShardClientUtil.js';
import { ClientPresence } from '../structures/ClientPresence.js';
import { GuildPreview } from '../structures/GuildPreview.js';
import { GuildTemplate } from '../structures/GuildTemplate.js';
import { Invite } from '../structures/Invite.js';
import { Sticker } from '../structures/Sticker.js';
import { StickerPack } from '../structures/StickerPack.js';
import { VoiceRegion } from '../structures/VoiceRegion.js';
import { Webhook } from '../structures/Webhook.js';
import { Widget } from '../structures/Widget.js';
import { Application } from '../structures/interfaces/Application.js';
import { Events, Status } from '../util/Constants.js';
import DataResolver from '../util/DataResolver.js';
import Intents from '../util/Intents.js';
import DiscordAuthWebsocket, { Event as RemoteAuthEvent, type QRLoginOptions, type UserRaw } from '../util/RemoteAuth.js';
export type { QRLoginOptions, UserRaw };
import Sweepers from '../util/Sweepers.js';
import type {
  Snowflake,
  InviteResolvable,
  GuildTemplateResolvable,
  GuildResolvable,
  ChannelResolvable,
} from '../types/index.js';
import type { ClientUser } from '../structures/ClientUser.js';
import type { ClientOptions } from '../util/Options.js';
import type { Guild } from '../structures/Guild.js';
import type { Channel } from '../structures/Channel.js';
import type { DMChannel } from '../structures/DMChannel.js';
import type { GroupDMChannel } from '../structures/GroupDMChannel.js';

export interface FinalizerData {
  cleanup: () => void;
  message?: string;
  name?: string;
}

export interface ClientFetchInviteOptions {
  guildScheduledEventId?: Snowflake;
}

export interface AcceptInviteOptions {
  bypassOnboarding?: boolean;
  bypassVerify?: boolean;
}

export interface OAuth2AuthorizeOptions {
  guild_id?: string;
  permissions?: string;
  authorize?: boolean;
  code?: string;
  webhook_channel_id?: string;
  [key: string]: unknown;
}

export interface AuthorizedApplicationData {
  application: Application;
  authorizedApplicationId: Snowflake;
  scopes: string[];
  deauthorize: () => Promise<void>;
}

export interface RefreshedAttachmentURL {
  original: string;
  refreshed: string;
}

/**
 * The main hub for interacting with the Discord API, and the starting point for any bot.
 * @extends {BaseClient}
 */
export class Client extends BaseClient {
  public readonly _cleanups: Set<() => void>;
  public readonly _finalizers: FinalizationRegistry<FinalizerData>;

  public ws: WebSocketManager;
  public actions: ActionsManager;
  public voice: ClientVoiceManager;
  public voiceStates: VoiceStateManager;
  public shard: ShardClientUtil | null;
  public users: UserManager;
  public guilds: GuildManager;
  public channels: ChannelManager;
  public sweepers: Sweepers;
  public presence: ClientPresence;
  public presences: PresenceManager;
  public notes: UserNoteManager;
  public relationships: RelationshipManager;
  public billing: BillingManager;
  public sessions: SessionManager;
  public settings: ClientUserSettingManager;
  public soundboard: SoundboardManager;
  public games: GameDetectionManager;
  public heartbeats: ClientHeartbeatManager;
  public ipc: DiscordIPCServer;

  public token: string | null;
  public user: ClientUser | null;
  public readyAt: Date | null;
  public authenticator: typeof authenticator;
  public sweepMessageInterval?: NodeJS.Timeout;

  public constructor(options?: Partial<ClientOptions>) {
    super(options);

    this._validateOptions();

    this._cleanups = new Set();
    this._finalizers = new FinalizationRegistry(this._finalize.bind(this));

    this.ws = new (WebSocketManager as unknown as { new (client: Client): WebSocketManager })(this);
    this.actions = new ActionsManager(this);
    this.voice = new (ClientVoiceManager as unknown as { new (client: Client): ClientVoiceManager })(this);
    this.voiceStates = new VoiceStateManager({ client: this });

    this.shard = process.env.SHARDING_MANAGER
      ? ShardClientUtil.singleton(this, process.env.SHARDING_MANAGER_MODE as 'process' | 'worker')
      : null;

    this.users = new UserManager(this);
    this.guilds = new GuildManager(this);
    this.channels = new ChannelManager(this);
    this.sweepers = new Sweepers(this, this.options.sweepers as unknown as import('../util/Sweepers.js').SweeperOptions);
    this.presence = new ClientPresence(this, this.options.presence as unknown as Parameters<typeof ClientPresence.prototype._patch>[0]);
    this.presences = new PresenceManager(this);
    this.notes = new UserNoteManager(this);
    this.relationships = new RelationshipManager(this);
    this.billing = new BillingManager(this);
    this.sessions = new SessionManager(this);
    this.settings = new ClientUserSettingManager(this);
    this.soundboard = new SoundboardManager(this);
    this.games = new GameDetectionManager(this);
    this.heartbeats = new ClientHeartbeatManager(this);
    this.ipc = new DiscordIPCServer(this, typeof this.options.ipcServer === 'object' ? this.options.ipcServer : {});

    if (this.options.heartbeats !== false) {
      this.heartbeats.start();
    }

    if (this.options.ipcServer) {
      void this.ipc.listen().catch(() => {});
    }

    if (this.options.fingerprintSync) {
      const interval = typeof this.options.fingerprintSync === 'number' ? this.options.fingerprintSync : 3_600_000;
      ClientFingerprintManager.startAutoSync(interval);
    }

    Object.defineProperty(this, 'token', { writable: true });
    if (!this.token && 'DISCORD_TOKEN' in process.env) {
      this.token = process.env.DISCORD_TOKEN ?? null;
    } else {
      this.token = null;
    }

    this.user = null;
    this.readyAt = null;

    this.authenticator = authenticator;
    this.authenticator.options = {
      step: 30,
      digits: 6,
      algorithm: 'sha1' as unknown as import('@otplib/core').HashAlgorithms,
    };

    if (this.options.messageSweepInterval > 0) {
      process.emitWarning(
        'The message sweeping client options are deprecated, use the global sweepers instead.',
        'DeprecationWarning',
      );
      this.sweepMessageInterval = setInterval(
        this.sweepMessages.bind(this),
        this.options.messageSweepInterval * 1_000,
      ).unref();
    }
  }

  /**
   * A manager of all the custom emojis that the client has access to
   */
  public get emojis(): BaseGuildEmojiManager {
    const emojis = new BaseGuildEmojiManager(this);
    for (const guild of this.guilds.cache.values()) {
      if (guild.available) {
        for (const emoji of guild.emojis.cache.values()) {
          if (emoji.id) emojis.cache.set(emoji.id, emoji);
        }
      }
    }
    return emojis;
  }

  /**
   * Timestamp of the time the client was last `READY` at
   */
  public get readyTimestamp(): number | null {
    return this.readyAt?.getTime() ?? null;
  }

  /**
   * How long it has been since the client last entered the `READY` state in milliseconds
   */
  public get uptime(): number | null {
    return this.readyAt ? Date.now() - this.readyAt.getTime() : null;
  }

  /**
   * Logs the client in, establishing a WebSocket connection to Discord.
   */
  public async login(token: string | null = this.token): Promise<string> {
    if (!token || typeof token !== 'string') throw new Error('TOKEN_INVALID');
    this.token = token = token.replace(/^(Bot|Bearer)\s*/i, '');
    this.emit(
      Events.DEBUG,
      `
      Logging on with a user token is unfortunately against the Discord
      \`Terms of Service\` <https://support.discord.com/hc/en-us/articles/115002192352>
      and doing so might potentially get your account banned.
      Use this at your own risk.`,
    );
    this.emit(
      Events.DEBUG,
      `Provided token: ${token
        .split('.')
        .map((val, i) => (i > 1 ? val.replace(/./g, '*') : val))
        .join('.')}`,
    );

    if (this.options.presence) {
      (this.options.ws as unknown as { presence: unknown }).presence = (this.presence as unknown as { _parse(p: unknown): unknown })._parse(this.options.presence);
    }

    this.emit(Events.DEBUG, 'Preparing to connect to the gateway...');

    try {
      await (this.ws as unknown as { connect(): Promise<void> }).connect();
      return this.token;
    } catch (error) {
      this.destroy();
      throw error;
    }
  }

  /**
   * Logs into Discord by initiating a Remote Authentication session with a mobile QR code scan.
   *
   * @param options Configuration options including terminal printing and scan callbacks
   * @returns A Promise that resolves with the acquired user token and completes client login
   */
  public async QRLogin(options?: QRLoginOptions): Promise<string> {
    const ws = new DiscordAuthWebsocket();
    const shouldPrintTerminal = options?.terminal !== false;

    return new Promise((resolve, reject) => {
      let timeoutTimer: NodeJS.Timeout | null = null;
      const timeoutMs = options?.timeout ?? 120000;

      if (timeoutMs > 0) {
        timeoutTimer = setTimeout(() => {
          ws.destroy();
          reject(new Error(`QR Login timed out after ${timeoutMs}ms.`));
        }, timeoutMs);
      }

      const cleanup = () => {
        if (timeoutTimer) clearTimeout(timeoutTimer);
      };

      ws.on(RemoteAuthEvent.READY, async () => {
        const qrUrl = ws.AuthURL;
        let qrDataUrl = '';
        try {
          qrDataUrl = await ws.getDataURL();
        } catch {
          // ignore
        }

        if (shouldPrintTerminal) {
          await ws.printTerminalQr();
        }

        this.emit(Events.QR_CODE, qrUrl, qrDataUrl);
        options?.onQR?.(qrUrl, qrDataUrl);
      });

      ws.on(RemoteAuthEvent.WAIT_SCAN, (user: UserRaw | null) => {
        if (shouldPrintTerminal && user) {
          console.log(`\n📱 [SCAN DETECTED / ĐÃ QUÉT] User: ${user.username}#${user.discriminator} (${user.id})`);
          console.log('👉 Please tap "Log In" / "Allow" on your phone to confirm.\n');
        }
        this.emit(Events.QR_SCAN, user);
        options?.onScan?.(user);
      });

      ws.on(RemoteAuthEvent.CANCEL, () => {
        cleanup();
        this.emit(Events.QR_CANCEL);
        reject(new Error('QR Login was cancelled on device.'));
      });

      ws.on(RemoteAuthEvent.ERROR, (err: Error) => {
        cleanup();
        this.emit(Events.ERROR, err);
        reject(err);
      });

      ws.on(RemoteAuthEvent.FINISH, async (token: string) => {
        cleanup();
        try {
          await this.login(token);
          resolve(token);
        } catch (loginErr) {
          reject(loginErr);
        }
      });

      ws.connect().catch((err: unknown) => {
        cleanup();
        reject(err instanceof Error ? err : new Error(String(err)));
      });
    });
  }

  /**
   * Logs the client in with credentials.
   * @deprecated
   */
  public async passLogin(email: string, password: string): Promise<string | null> {
    const initial = (await (this.api as unknown as { auth: { login: { post(opts: unknown): Promise<{ token?: string; ticket?: string }> } } }).auth.login.post({
      auth: false,
      versioned: true,
      data: { gift_code_sku_id: null, login_source: null, undelete: false, login: email, password },
    })) as { token?: string; ticket?: string };

    if ('token' in initial && initial.token) {
      return this.login(initial.token);
    } else if ('ticket' in initial && initial.ticket) {
      if (!this.options.TOTPKey) throw new Error('TOTPKEY_MISSING');
      const otp = this.authenticator.generate(this.options.TOTPKey);
      const totp = (await (this.api as unknown as { auth: { mfa: { totp: { post(opts: unknown): Promise<{ token?: string }> } } } }).auth.mfa.totp.post({
        auth: false,
        versioned: true,
        data: { gift_code_sku_id: null, login_source: null, code: otp, ticket: initial.ticket },
      })) as { token?: string };
      if ('token' in totp && totp.token) {
        return this.login(totp.token);
      }
    }

    return null;
  }

  /**
   * Returns whether the client has logged in, indicative of being able to access
   * properties such as `user` and `application`.
   */
  public isReady(): boolean {
    const ws = this.ws as unknown as { destroyed: boolean; status: number };
    return !ws.destroyed && ws.status === Status.READY;
  }

  /**
   * Logs out, terminates the connection to Discord, and destroys the client.
   */
  public override destroy(): void {
    super.destroy();

    for (const fn of this._cleanups) fn();
    this._cleanups.clear();

    if (this.sweepMessageInterval) clearInterval(this.sweepMessageInterval);

    this.sweepers.destroy();
    this.heartbeats.stop();
    this.games.stopAutoDetection();
    void this.ipc.close();
    (this.ws as unknown as { destroy(): void }).destroy();
    this.token = null;
  }

  /**
   * Logs out, terminates the connection to Discord, destroys the client and destroys the token.
   */
  public async logout(): Promise<void> {
    await (this.api as unknown as { auth: { logout: { post(opts: unknown): Promise<void> } } }).auth.logout.post({
      data: {
        provider: null,
        voip_provider: null,
      },
    });
    this.destroy();
  }

  /**
   * Obtains an invite from Discord.
   */
  public async fetchInvite(invite: InviteResolvable, options?: ClientFetchInviteOptions): Promise<Invite> {
    const code = DataResolver.resolveInviteCode(invite);
    const data = await (this.api as unknown as { invites(c: string): { get(opts: unknown): Promise<Record<string, unknown>> } }).invites(code).get({
      query: { with_counts: true, guild_scheduled_event_id: options?.guildScheduledEventId },
    });
    return new Invite(this, data as Parameters<typeof Invite.prototype._patch>[0]);
  }

  /**
   * Obtains a template from Discord.
   */
  public async fetchGuildTemplate(template: GuildTemplateResolvable): Promise<GuildTemplate> {
    const code = DataResolver.resolveGuildTemplateCode(template);
    const data = await (this.api as unknown as { guilds: { templates(c: string): { get(): Promise<Record<string, unknown>> } } }).guilds.templates(code).get();
    return new GuildTemplate(this, data as unknown as import('../structures/GuildTemplate.js').RawGuildTemplateData);
  }

  /**
   * Obtains a webhook from Discord.
   */
  public async fetchWebhook(id: Snowflake, token?: string): Promise<Webhook> {
    const data = await (this.api as unknown as { webhooks(i: Snowflake, t?: string): { get(): Promise<Record<string, unknown>> } }).webhooks(id, token).get();
    return new Webhook(this, { token, ...data } as unknown as import('../structures/Webhook.js').RawWebhookData);
  }

  /**
   * Obtains the available voice regions from Discord.
   */
  public async fetchVoiceRegions(): Promise<Collection<string, VoiceRegion>> {
    const apiRegions = (await (this.api as unknown as { voice: { regions: { get(): Promise<Array<Record<string, unknown> & { id: string }>> } } }).voice.regions.get());
    const regions = new Collection<string, VoiceRegion>();
    for (const region of apiRegions) {
      regions.set(region.id, new VoiceRegion(region as unknown as import('../structures/VoiceRegion.js').RawVoiceRegionData));
    }
    return regions;
  }

  /**
   * Obtains a sticker from Discord.
   */
  public async fetchSticker(id: Snowflake): Promise<Sticker> {
    const data = await (this.api as unknown as { stickers(i: Snowflake): { get(): Promise<Record<string, unknown>> } }).stickers(id).get();
    return new Sticker(this, data as unknown as import('../structures/Sticker.js').APIStickerData);
  }

  /**
   * Obtains the list of sticker packs available to Nitro subscribers from Discord.
   */
  public async fetchPremiumStickerPacks(): Promise<Collection<Snowflake, StickerPack>> {
    const data = (await (this.api as unknown as (path: string) => { get(): Promise<{ sticker_packs: Array<Record<string, unknown> & { id: Snowflake }> }> })('sticker-packs').get());
    return new Collection(data.sticker_packs.map(p => [p.id, new StickerPack(this, p as unknown as import('../structures/StickerPack.js').APIStickerPackData)]));
  }

  /**
   * A last ditch cleanup function for garbage collection.
   */
  public _finalize({ cleanup, message, name }: FinalizerData): void {
    try {
      cleanup();
      this._cleanups.delete(cleanup);
      if (message) {
        this.emit(Events.DEBUG, message);
      }
    } catch {
      this.emit(Events.DEBUG, `Garbage collection failed on ${name ?? 'an unknown item'}.`);
    }
  }

  /**
   * Sweeps all text-based channels' messages and removes the ones older than the max message lifetime.
   */
  public sweepMessages(lifetime: number = this.options.messageCacheLifetime): number {
    if (typeof lifetime !== 'number' || Number.isNaN(lifetime)) {
      throw new TypeError('INVALID_TYPE', 'lifetime', 'number');
    }
    if (lifetime <= 0) {
      this.emit(Events.DEBUG, "Didn't sweep messages - lifetime is unlimited");
      return -1;
    }

    const filter = Sweepers.outdatedMessageSweepFilter(lifetime)();
    const messages = filter ? this.sweepers.sweepMessages(filter as unknown as import('../util/Sweepers.js').SweepFilterPredicate) : 0;
    this.emit(Events.DEBUG, `Swept ${messages} messages older than ${lifetime} seconds`);
    return messages;
  }

  /**
   * Obtains a guild preview from Discord, available for all guilds the bot is in and all Discoverable guilds.
   */
  public async fetchGuildPreview(guild: GuildResolvable): Promise<GuildPreview> {
    const id = this.guilds.resolveId(guild);
    if (!id) throw new TypeError('INVALID_TYPE', 'guild', 'GuildResolvable');
    const data = await (this.api as unknown as { guilds(i: string): { preview: { get(): Promise<Record<string, unknown>> } } }).guilds(id).preview.get();
    return new GuildPreview(this, data as unknown as import('../structures/GuildPreview.js').RawGuildPreviewData);
  }

  /**
   * Obtains the widget data of a guild from Discord, available for guilds with the widget enabled.
   */
  public async fetchGuildWidget(guild: GuildResolvable): Promise<Widget> {
    const id = this.guilds.resolveId(guild);
    if (!id) throw new TypeError('INVALID_TYPE', 'guild', 'GuildResolvable');
    const data = await (this.api as unknown as { guilds(i: string, sub: string): { get(): Promise<Record<string, unknown>> } }).guilds(id, 'widget.json').get();
    return new Widget(this, data as unknown as import('../structures/Widget.js').RawWidgetData);
  }

  /**
   * Refresh the Discord CDN links with hashes so they can be usable.
   */
  public async refreshAttachmentURL(...urls: string[]): Promise<RefreshedAttachmentURL[]> {
    const cleanedUrls = urls.map(url => {
      const urlObject = new URL(url);
      urlObject.search = '';
      return urlObject.toString();
    });
    const data = (await (this.api as unknown as { attachments(p: string): { post(opts: unknown): Promise<{ refreshed_urls: RefreshedAttachmentURL[] }> } }).attachments('refresh-urls').post({
      data: { attachment_urls: cleanedUrls },
    }));
    return data.refreshed_urls;
  }

  /**
   * The sleep function in JavaScript returns a promise that resolves after a specified timeout.
   */
  public sleep(timeout: number): Promise<void> {
    return new Promise(r => setTimeout(r, timeout));
  }

  public override toJSON(): Record<string, unknown> {
    return super.toJSON({ readyAt: true });
  }

  /**
   * The current session id of the shard
   */
  public get sessionId(): string | undefined {
    return (this.ws as unknown as { shards: Collection<number, { sessionId?: string }> }).shards.first()?.sessionId;
  }

  /**
   * Join this Guild / GroupDMChannel using this invite
   */
  public async acceptInvite(
    invite: InviteResolvable,
    options: AcceptInviteOptions = { bypassOnboarding: true, bypassVerify: true },
  ): Promise<Guild | Channel | DMChannel | GroupDMChannel | boolean | undefined> {
    const code = DataResolver.resolveInviteCode(invite);
    if (!code) throw new Error('INVITE_RESOLVE_CODE');
    const i = await this.fetchInvite(code);
    if (i.guild?.id && this.guilds.cache.has(i.guild.id)) return this.guilds.cache.get(i.guild.id);
    if (i.channelId && this.channels.cache.has(i.channelId)) return this.channels.cache.get(i.channelId);

    const data = (await (this.api as unknown as { invites(c: string): { post(opts: unknown): Promise<{ show_verification_form?: boolean; channel?: { id?: Snowflake } }> } }).invites(code).post({
      DiscordContext: { location: 'Markdown Link' },
      data: {
        session_id: this.sessionId,
      },
    }));
    this.emit(Events.DEBUG, `[Invite > Guild ${i.guild?.id}] Joined`);

    if (i.guild?.id) {
      const guild = this.guilds.cache.get(i.guild.id);
      if (i.flags.has('GUEST')) {
        this.emit(Events.DEBUG, `[Invite > Guild ${i.guild.id}] Guest invite`);
        return guild;
      }
      if (options.bypassOnboarding) {
        const onboardingData = (await (this.api as unknown as { guilds: Record<string, { onboarding: { get(): Promise<{ enabled: boolean; prompts: Array<{ in_onboarding: boolean; id: string; required: boolean; options: Array<{ id: string }> }> }> } }> }).guilds[i.guild.id]!.onboarding.get());
        if (onboardingData.enabled) {
          const prompts = onboardingData.prompts.filter(o => o.in_onboarding);
          if (prompts.length) {
            const onboarding_prompts_seen: Record<string, number> = {};
            const onboarding_responses: string[] = [];
            const onboarding_responses_seen: Record<string, number> = {};

            const currentDate = Date.now();

            prompts.forEach(prompt => {
              onboarding_prompts_seen[prompt.id] = currentDate;
              if (prompt.required && prompt.options[0]) onboarding_responses.push(prompt.options[0].id);
              prompt.options.forEach(option => {
                onboarding_responses_seen[option.id] = currentDate;
              });
            });

            await (this.api as unknown as { guilds: Record<string, { 'onboarding-responses': { post(opts: unknown): Promise<unknown> } }> }).guilds[i.guild.id]!['onboarding-responses'].post({
              data: {
                onboarding_prompts_seen,
                onboarding_responses,
                onboarding_responses_seen,
              },
            });
            this.emit(Events.DEBUG, `[Invite > Guild ${i.guild.id}] Bypassed onboarding`);
          }
        }
      }

      if (data.show_verification_form && options.bypassVerify) {
        if (i.guild.verificationLevel === 'VERY_HIGH' && !this.user?.phone) {
          this.emit(Events.DEBUG, `[Invite > Guild ${i.guild.id}] Cannot bypass verify (Phone required)`);
          return this.guilds.cache.get(i.guild.id);
        }
        if (i.guild.verificationLevel !== 'NONE' && !this.user?.email) {
          this.emit(Events.DEBUG, `[Invite > Guild ${i.guild.id}] Cannot bypass verify (Email required)`);
          return this.guilds.cache.get(i.guild.id);
        }
        const getForm = (await (this.api as unknown as { guilds(id: string): { 'member-verification': { get(opts: unknown): Promise<{ form_fields: Array<Record<string, unknown>>; version: string }> } } }).guilds(i.guild.id)['member-verification'].get({ query: { with_guild: false, invite_code: code } }).catch(() => null));
        if (getForm && getForm.form_fields[0]) {
          const form = Object.assign(getForm.form_fields[0], { response: true });
          await (this.api as unknown as { guilds(id: string): { requests: { '@me': { put(opts: unknown): Promise<unknown> } } } }).guilds(i.guild.id).requests['@me'].put({
            data: { form_fields: [form], version: getForm.version },
          });
          this.emit(Events.DEBUG, `[Invite > Guild ${i.guild.id}] Bypassed verify`);
        }
      }
      return guild;
    } else {
      const channelId = i.channelId ?? data.channel?.id;
      return channelId ? this.channels.cache.get(channelId) : undefined;
    }
  }

  /**
   * Redeem nitro from code or url.
   */
  public redeemNitro(nitro: string, channel?: ChannelResolvable, paymentSourceId?: Snowflake): Promise<unknown> | false {
    if (typeof nitro !== 'string') throw new Error('INVALID_NITRO');
    const nitroCode =
      nitro.match(/(discord.gift|discord.com|discordapp.com\/gifts)\/(\w{16,25})/) ||
      nitro.match(/(discord\.gift\/|discord\.com\/gifts\/|discordapp\.com\/gifts\/)(\w+)/);
    if (!nitroCode || !nitroCode[2]) return false;
    const code = nitroCode[2];
    const resolvedChannelId = channel ? this.channels.resolveId(channel) : null;
    return (this.api as unknown as { entitlements: { 'gift-codes'(c: string): { redeem: { post(opts: unknown): Promise<unknown> } } } }).entitlements['gift-codes'](code).redeem.post({
      auth: true,
      data: { channel_id: resolvedChannelId || null, payment_source_id: paymentSourceId || null },
    });
  }

  /**
   * Authorize an application.
   */
  public authorizeURL(urlOAuth2: string, options: OAuth2AuthorizeOptions = {}): Promise<{ location?: string; [key: string]: unknown }> {
    const url = new URL(urlOAuth2);
    if (!/^https:\/\/(?:canary\.|ptb\.)?discord\.com(?:\/api(?:\/v\d{1,2})?)?\/oauth2\/authorize\?/.test(urlOAuth2)) {
      throw new Error('INVALID_URL', urlOAuth2);
    }
    const searchParams: Record<string, unknown> = Object.fromEntries(url.searchParams);
    const finalOptions = {
      authorize: true,
      permissions: '0',
      integration_type: 0,
      location_context: {
        guild_id: '10000',
        channel_id: '10000',
        channel_type: 10000,
      },
      ...searchParams,
      ...options,
    };
    delete searchParams.permissions;
    delete searchParams.integration_type;
    delete searchParams.guild_id;
    return (this.api as unknown as { oauth2: { authorize: { post(opts: unknown): Promise<{ location?: string }> } } }).oauth2.authorize.post({
      query: searchParams,
      data: finalOptions,
    });
  }

  /**
   * Install User Apps
   */
  public installUserApps(applicationId: Snowflake): Promise<unknown> {
    return (this.api as unknown as { applications(id: Snowflake): { public: { get(opts: unknown): Promise<{ integration_types_config: Record<string, { oauth2_install_params: { scopes: string[] } }> }> } } })
      .applications(applicationId)
      .public.get({
        query: {
          with_guild: false,
        },
      })
      .then(rawData => {
        const installTypes = rawData.integration_types_config['1'];
        if (installTypes) {
          return (this.api as unknown as { oauth2: { authorize: { post(opts: unknown): Promise<unknown> } } }).oauth2.authorize.post({
            query: {
              client_id: applicationId,
              scope: installTypes.oauth2_install_params.scopes.join(' '),
            },
            data: {
              permissions: '0',
              authorize: true,
              integration_type: 1,
            },
          });
        } else {
          return false;
        }
      });
  }

  /**
   * Deauthorizes an application or token.
   */
  public deauthorize(id: Snowflake, type: 'application' | 'token' = 'application'): Promise<void> {
    if (type === 'application') {
      return (this.api as unknown as { oauth2: { tokens: { get(): Promise<Array<{ id: Snowflake; application: { id: Snowflake } }>>; (tid: Snowflake): { delete(): Promise<void> } } } }).oauth2.tokens
        .get()
        .then(data => data.find(o => o.application.id === id))
        .then(o => {
          if (o) {
            return (this.api as unknown as { oauth2: { tokens(tid: Snowflake): { delete(): Promise<void> } } }).oauth2.tokens(o.id).delete();
          }
          return undefined;
        });
    } else {
      return (this.api as unknown as { oauth2: { tokens(tid: Snowflake): { delete(): Promise<void> } } }).oauth2.tokens(id).delete();
    }
  }

  /**
   * Retrieves the list of authorized applications (OAuth2 tokens).
   */
  public authorizedApplications(): Promise<Collection<Snowflake, AuthorizedApplicationData>> {
    return (this.api as unknown as { oauth2: { tokens: { get(): Promise<Array<{ id: Snowflake; scopes: string[]; application: Record<string, unknown> & { id: Snowflake } }>> } } }).oauth2.tokens.get().then(data => {
      const results = new Collection<Snowflake, AuthorizedApplicationData>();
      for (const o of data) {
        const application = new Application(this, o.application);
        const appData: AuthorizedApplicationData = {
          application,
          authorizedApplicationId: o.id,
          scopes: o.scopes,
          deauthorize: () => this.deauthorize(o.id, 'token'),
        };
        results.set(o.application.id, appData);
      }
      return results;
    });
  }

  /**
   * Calls eval on a script with the client as `this`.
   */
  public _eval(script: string): unknown {
    return eval(script);
  }

  /**
   * Validates the client options.
   */
  public _validateOptions(options: ClientOptions = this.options): void {
    if (typeof options.makeCache !== 'function') {
      throw new TypeError('CLIENT_INVALID_OPTION', 'makeCache', 'a function');
    }
    if (typeof options.messageCacheLifetime !== 'number' || Number.isNaN(options.messageCacheLifetime)) {
      throw new TypeError('CLIENT_INVALID_OPTION', 'The messageCacheLifetime', 'a number');
    }
    if (typeof options.messageSweepInterval !== 'number' || Number.isNaN(options.messageSweepInterval)) {
      throw new TypeError('CLIENT_INVALID_OPTION', 'messageSweepInterval', 'a number');
    }
    if (typeof options.sweepers !== 'object' || options.sweepers === null) {
      throw new TypeError('CLIENT_INVALID_OPTION', 'sweepers', 'an object');
    }
    if (typeof options.invalidRequestWarningInterval !== 'number' || Number.isNaN(options.invalidRequestWarningInterval)) {
      throw new TypeError('CLIENT_INVALID_OPTION', 'invalidRequestWarningInterval', 'a number');
    }
    if (!Array.isArray(options.partials)) {
      throw new TypeError('CLIENT_INVALID_OPTION', 'partials', 'an Array');
    }
    const partialMap: Record<string | number, string> = {
      0: 'USER',
      USER: 'USER',
      User: 'USER',
      1: 'CHANNEL',
      CHANNEL: 'CHANNEL',
      Channel: 'CHANNEL',
      2: 'GUILD_MEMBER',
      GUILD_MEMBER: 'GUILD_MEMBER',
      GuildMember: 'GUILD_MEMBER',
      3: 'MESSAGE',
      MESSAGE: 'MESSAGE',
      Message: 'MESSAGE',
      4: 'REACTION',
      REACTION: 'REACTION',
      Reaction: 'REACTION',
      5: 'GUILD_SCHEDULED_EVENT',
      GUILD_SCHEDULED_EVENT: 'GUILD_SCHEDULED_EVENT',
      GuildScheduledEvent: 'GUILD_SCHEDULED_EVENT',
      6: 'THREAD_MEMBER',
      THREAD_MEMBER: 'THREAD_MEMBER',
      ThreadMember: 'THREAD_MEMBER',
    };
    options.partials = options.partials.map(p => (partialMap[p] ?? p) as typeof options.partials[number]);
    if (typeof options.DMChannelVoiceStatusSync !== 'number' || Number.isNaN(options.DMChannelVoiceStatusSync)) {
      throw new TypeError('CLIENT_INVALID_OPTION', 'DMChannelVoiceStatusSync', 'a number');
    }
    if (typeof options.waitGuildTimeout !== 'number' || Number.isNaN(options.waitGuildTimeout)) {
      throw new TypeError('CLIENT_INVALID_OPTION', 'waitGuildTimeout', 'a number');
    }
    if (typeof options.restWsBridgeTimeout !== 'number' || Number.isNaN(options.restWsBridgeTimeout)) {
      throw new TypeError('CLIENT_INVALID_OPTION', 'restWsBridgeTimeout', 'a number');
    }
    if (typeof options.restRequestTimeout !== 'number' || Number.isNaN(options.restRequestTimeout)) {
      throw new TypeError('CLIENT_INVALID_OPTION', 'restRequestTimeout', 'a number');
    }
    if (typeof options.restGlobalRateLimit !== 'number' || Number.isNaN(options.restGlobalRateLimit)) {
      throw new TypeError('CLIENT_INVALID_OPTION', 'restGlobalRateLimit', 'a number');
    }
    if (typeof options.restSweepInterval !== 'number' || Number.isNaN(options.restSweepInterval)) {
      throw new TypeError('CLIENT_INVALID_OPTION', 'restSweepInterval', 'a number');
    }
    if (typeof options.retryLimit !== 'number' || Number.isNaN(options.retryLimit)) {
      throw new TypeError('CLIENT_INVALID_OPTION', 'retryLimit', 'a number');
    }
    if (typeof options.failIfNotExists !== 'boolean') {
      throw new TypeError('CLIENT_INVALID_OPTION', 'failIfNotExists', 'a boolean');
    }
    if (
      typeof (options as { rejectOnRateLimit?: unknown }).rejectOnRateLimit !== 'undefined' &&
      !(typeof (options as { rejectOnRateLimit?: unknown }).rejectOnRateLimit === 'function' || Array.isArray((options as { rejectOnRateLimit?: unknown }).rejectOnRateLimit))
    ) {
      throw new TypeError('CLIENT_INVALID_OPTION', 'rejectOnRateLimit', 'an array or a function');
    }
    if (typeof options.TOTPKey === 'string') {
      options.TOTPKey = options.TOTPKey.replace(/ +/g, '').toUpperCase();
    }
    this.options.shardCount = 1;
    this.options.shards = [0];
    this.options.intents = Intents.ALL;
  }
}

export default Client;
