import process from 'node:process';
import { ApplicationFlags } from '../../util/ApplicationFlags.js';
import { ClientApplicationAssetTypes, Endpoints } from '../../util/Constants.js';
import type { ImageURLOptions } from '../../util/Constants.js';
import { Permissions } from '../../util/Permissions.js';
import { SnowflakeUtil } from '../../util/SnowflakeUtil.js';
import {
  ApplicationRoleConnectionMetadata,
  type RawApplicationRoleConnectionMetadataData,
} from '../ApplicationRoleConnectionMetadata.js';
import { Base } from '../Base.js';
import { Team, type RawTeamData } from '../Team.js';
import type { Snowflake } from '../../types/index.js';
import type { Client } from '../../client/Client.js';

const AssetTypes = Object.keys(ClientApplicationAssetTypes);

let deprecationEmittedForFetchAssets = false;

export interface ApplicationExecutable {
  os: string;
  name: string;
  is_launcher: boolean;
}

export interface ApplicationSku {
  id: Snowflake | null;
  sku: string | null;
  distributor: string;
}

export interface Company {
  id: Snowflake | null;
  name: string | null;
}

export interface ClientApplicationInstallParams {
  scopes: string[];
  permissions: Readonly<Permissions>;
}

export interface ApplicationAsset {
  id: Snowflake;
  name: string;
  type: string;
}

export interface RawApplicationData {
  id: Snowflake;
  name?: string | null;
  description?: string | null;
  icon?: string | null;
  terms_of_service_url?: string | null;
  privacy_policy_url?: string | null;
  verify_key?: string | null;
  role_connections_verification_url?: string | null;
  tags?: string[];
  install_params?: {
    scopes: string[];
    permissions: string | number | bigint;
  };
  custom_install_url?: string | null;
  flags?: number | bigint;
  approximate_guild_count?: number | null;
  guild_id?: Snowflake | null;
  cover_image?: string | null;
  rpc_origins?: string[];
  bot_require_code_grant?: boolean | null;
  bot_public?: boolean | null;
  team?: RawTeamData | null;
  owner?: unknown;
  splash?: string | null;
  type?: number | null;
  primary_sku_id?: Snowflake | null;
  eula_id?: Snowflake | null;
  slug?: string | null;
  aliases?: string[];
  executables?: ApplicationExecutable[] | null;
  third_party_skus?: ApplicationSku[] | null;
  hook?: boolean | null;
  overlay?: boolean | null;
  overlay_methods?: number | null;
  overlay_warn?: boolean | null;
  overlay_compatibility_hook?: boolean | null;
  bot?: unknown;
  developers?: Company[] | null;
  publishers?: Company[] | null;
  redirect_uris?: string[] | null;
  deeplink_uri?: string | null;
  integration_public?: boolean | null;
  integration_require_code_grant?: boolean | null;
  bot_disabled?: boolean | null;
  bot_quarantined?: boolean | null;
  approximate_user_install_count?: number | null;
  approximate_user_authorization_count?: number | null;
  internal_guild_restriction?: number | null;
  interactions_endpoint_url?: string | null;
  interactions_version?: number | null;
  interactions_event_types?: string[] | null;
  event_webhooks_status?: number | null;
  event_webhooks_url?: string | null;
  event_webhooks_types?: string[] | null;
  explicit_content_filter?: number | null;
  integration_types_config?: Record<string, unknown> | null;
  is_verified?: boolean | null;
  verification_state?: number | null;
  store_application_state?: number | null;
  rpc_application_state?: number | null;
  creator_monetization_state?: number | null;
  is_discoverable?: boolean | null;
  discoverability_state?: number | null;
  discovery_eligibility_flags?: number | null;
  is_monetized?: boolean | null;
  storefront_available?: boolean | null;
  monetization_state?: number | null;
  monetization_eligibility_flags?: number | null;
  max_participants?: number | null;
}

/**
 * Represents an OAuth2 Application.
 */
export class Application extends Base {
  public name: string | null = null;
  public description: string | null = null;
  public icon: string | null = null;
  public termsOfServiceURL: string | null = null;
  public privacyPolicyURL: string | null = null;
  public verifyKey: string | null = null;
  public roleConnectionsVerificationURL: string | null = null;
  public tags: string[] = [];
  public installParams: ClientApplicationInstallParams | null = null;
  public customInstallURL: string | null = null;
  public flags?: Readonly<ApplicationFlags>;
  public approximateGuildCount: number | null = null;
  public guildId: Snowflake | null = null;
  public cover: string | null = null;
  public rpcOrigins: string[] = [];
  public botRequireCodeGrant: boolean | null = null;
  public botPublic: boolean | null = null;
  public owner: unknown = null;
  public splash: string | null = null;
  public type: number | null = null;
  public primarySkuId: Snowflake | null = null;
  public eulaId: Snowflake | null = null;
  public slug: string | null = null;
  public aliases: string[] = [];
  public executables: ApplicationExecutable[] | null = null;
  public thirdPartySkus: ApplicationSku[] | null = null;
  public hook: boolean | null = null;
  public overlay: boolean | null = null;
  public overlayMethods: number | null = null;
  public overlayWarn: boolean | null = null;
  public overlayCompatibilityHook: boolean | null = null;
  public bot: unknown = null;
  public developers: Company[] | null = null;
  public publishers: Company[] | null = null;
  public redirectUris: string[] | null = null;
  public deeplinkUri: string | null = null;
  public integrationPublic: boolean | null = null;
  public integrationRequireCodeGrant: boolean | null = null;
  public botDisabled: boolean | null = null;
  public botQuarantined: boolean | null = null;
  public approximateUserInstallCount: number | null = null;
  public approximateUserAuthorizationCount: number | null = null;
  public internalGuildRestriction: number | null = null;
  public interactionsEndpointUrl: string | null = null;
  public interactionsVersion: number | null = null;
  public interactionsEventTypes: string[] | null = null;
  public eventWebhooksStatus: number | null = null;
  public eventWebhooksUrl: string | null = null;
  public eventWebhooksTypes: string[] | null = null;
  public explicitContentFilter: number | null = null;
  public integrationTypesConfig: Record<string, unknown> | null = null;
  public isVerified: boolean | null = null;
  public verificationState: number | null = null;
  public storeApplicationState: number | null = null;
  public rpcApplicationState: number | null = null;
  public creatorMonetizationState: number | null = null;
  public isDiscoverable: boolean | null = null;
  public discoverabilityState: number | null = null;
  public discoveryEligibilityFlags: number | null = null;
  public isMonetized: boolean | null = null;
  public storefrontAvailable: boolean | null = null;
  public monetizationState: number | null = null;
  public monetizationEligibilityFlags: number | null = null;
  public maxParticipants: number | null = null;

  public constructor(client: Client | unknown, data: RawApplicationData) {
    super(client as Client);
    this._patch(data);
  }

  public override _patch(data: RawApplicationData): void {
    this.id = data.id;

    if ('name' in data) {
      this.name = data.name ?? null;
    }
    if ('description' in data) {
      this.description = data.description ?? null;
    }
    if ('icon' in data) {
      this.icon = data.icon ?? null;
    }
    if ('terms_of_service_url' in data) {
      this.termsOfServiceURL = data.terms_of_service_url ?? null;
    }
    if ('privacy_policy_url' in data) {
      this.privacyPolicyURL = data.privacy_policy_url ?? null;
    }
    if ('verify_key' in data) {
      this.verifyKey = data.verify_key ?? null;
    }
    if ('role_connections_verification_url' in data) {
      this.roleConnectionsVerificationURL = data.role_connections_verification_url ?? null;
    }
    if ('tags' in data && data.tags) {
      this.tags = data.tags;
    }
    if ('install_params' in data && data.install_params) {
      this.installParams = {
        scopes: data.install_params.scopes,
        permissions: new Permissions(BigInt(data.install_params.permissions)).freeze(),
      };
    }
    if ('custom_install_url' in data) {
      this.customInstallURL = data.custom_install_url ?? null;
    }
    if ('flags' in data && data.flags !== undefined) {
      this.flags = new ApplicationFlags(Number(data.flags)).freeze();
    }
    if ('approximate_guild_count' in data) {
      this.approximateGuildCount = data.approximate_guild_count ?? null;
    }
    if ('guild_id' in data) {
      this.guildId = data.guild_id ?? null;
    }
    if ('cover_image' in data) {
      this.cover = data.cover_image ?? null;
    }
    if ('rpc_origins' in data) {
      this.rpcOrigins = data.rpc_origins ?? [];
    }
    if ('bot_require_code_grant' in data) {
      this.botRequireCodeGrant = data.bot_require_code_grant ?? null;
    }
    if ('bot_public' in data) {
      this.botPublic = data.bot_public ?? null;
    }

    if (data.team) {
      this.owner = new Team(this.client, data.team);
    } else if (data.owner) {
      this.owner = (this.client as unknown as { users: { _add: (u: unknown) => unknown } }).users._add(data.owner);
    }

    if ('splash' in data) {
      this.splash = data.splash ?? null;
    }
    if ('type' in data) {
      this.type = data.type ?? null;
    }
    if ('primary_sku_id' in data) {
      this.primarySkuId = data.primary_sku_id ?? null;
    }
    if ('eula_id' in data) {
      this.eulaId = data.eula_id ?? null;
    }
    if ('slug' in data) {
      this.slug = data.slug ?? null;
    }
    if ('aliases' in data && data.aliases) {
      this.aliases = data.aliases;
    }
    if ('executables' in data) {
      this.executables = data.executables ?? null;
    }
    if ('third_party_skus' in data) {
      this.thirdPartySkus = data.third_party_skus ?? null;
    }
    if ('hook' in data) {
      this.hook = data.hook ?? null;
    }
    if ('overlay' in data) {
      this.overlay = data.overlay ?? null;
    }
    if ('overlay_methods' in data) {
      this.overlayMethods = data.overlay_methods ?? null;
    }
    if ('overlay_warn' in data) {
      this.overlayWarn = data.overlay_warn ?? null;
    }
    if ('overlay_compatibility_hook' in data) {
      this.overlayCompatibilityHook = data.overlay_compatibility_hook ?? null;
    }
    if ('bot' in data) {
      this.bot = data.bot ?? null;
    }
    if ('developers' in data) {
      this.developers = data.developers ?? null;
    }
    if ('publishers' in data) {
      this.publishers = data.publishers ?? null;
    }
    if ('redirect_uris' in data) {
      this.redirectUris = data.redirect_uris ?? null;
    }
    if ('deeplink_uri' in data) {
      this.deeplinkUri = data.deeplink_uri ?? null;
    }
    if ('integration_public' in data) {
      this.integrationPublic = data.integration_public ?? null;
    }
    if ('integration_require_code_grant' in data) {
      this.integrationRequireCodeGrant = data.integration_require_code_grant ?? null;
    }
    if ('bot_disabled' in data) {
      this.botDisabled = data.bot_disabled ?? null;
    }
    if ('bot_quarantined' in data) {
      this.botQuarantined = data.bot_quarantined ?? null;
    }
    if ('approximate_user_install_count' in data) {
      this.approximateUserInstallCount = data.approximate_user_install_count ?? null;
    }
    if ('approximate_user_authorization_count' in data) {
      this.approximateUserAuthorizationCount = data.approximate_user_authorization_count ?? null;
    }
    if ('internal_guild_restriction' in data) {
      this.internalGuildRestriction = data.internal_guild_restriction ?? null;
    }
    if ('interactions_endpoint_url' in data) {
      this.interactionsEndpointUrl = data.interactions_endpoint_url ?? null;
    }
    if ('interactions_version' in data) {
      this.interactionsVersion = data.interactions_version ?? null;
    }
    if ('interactions_event_types' in data) {
      this.interactionsEventTypes = data.interactions_event_types ?? null;
    }
    if ('event_webhooks_status' in data) {
      this.eventWebhooksStatus = data.event_webhooks_status ?? null;
    }
    if ('event_webhooks_url' in data) {
      this.eventWebhooksUrl = data.event_webhooks_url ?? null;
    }
    if ('event_webhooks_types' in data) {
      this.eventWebhooksTypes = data.event_webhooks_types ?? null;
    }
    if ('explicit_content_filter' in data) {
      this.explicitContentFilter = data.explicit_content_filter ?? null;
    }
    if ('integration_types_config' in data) {
      this.integrationTypesConfig = data.integration_types_config ?? null;
    }
    if ('is_verified' in data) {
      this.isVerified = data.is_verified ?? null;
    }
    if ('verification_state' in data) {
      this.verificationState = data.verification_state ?? null;
    }
    if ('store_application_state' in data) {
      this.storeApplicationState = data.store_application_state ?? null;
    }
    if ('rpc_application_state' in data) {
      this.rpcApplicationState = data.rpc_application_state ?? null;
    }
    if ('creator_monetization_state' in data) {
      this.creatorMonetizationState = data.creator_monetization_state ?? null;
    }
    if ('is_discoverable' in data) {
      this.isDiscoverable = data.is_discoverable ?? null;
    }
    if ('discoverability_state' in data) {
      this.discoverabilityState = data.discoverability_state ?? null;
    }
    if ('discovery_eligibility_flags' in data) {
      this.discoveryEligibilityFlags = data.discovery_eligibility_flags ?? null;
    }
    if ('is_monetized' in data) {
      this.isMonetized = data.is_monetized ?? null;
    }
    if ('storefront_available' in data) {
      this.storefrontAvailable = data.storefront_available ?? null;
    }
    if ('monetization_state' in data) {
      this.monetizationState = data.monetization_state ?? null;
    }
    if ('monetization_eligibility_flags' in data) {
      this.monetizationEligibilityFlags = data.monetization_eligibility_flags ?? null;
    }
    if ('max_participants' in data) {
      this.maxParticipants = data.max_participants ?? null;
    }
  }

  public get guild(): unknown | null {
    return (
      this.client as unknown as { guilds: { cache: { get: (id: string | null) => unknown } } }
    ).guilds.cache.get(this.guildId) ?? null;
  }

  public get partial(): boolean {
    return !this.name;
  }

  public get createdTimestamp(): number {
    return SnowflakeUtil.timestampFrom(this.id);
  }

  public get createdAt(): Date {
    return new Date(this.createdTimestamp);
  }

  public async fetch(): Promise<this> {
    const cli = this.client as unknown as {
      api: {
        oauth2: {
          authorize: {
            get: (opts: { query: { client_id: Snowflake; scope: string } }) => Promise<{
              bot: unknown;
              application: RawApplicationData;
            }>;
          };
        };
      };
      users: {
        _add: (data: unknown) => { _partial?: boolean };
      };
    };

    const app = await cli.api.oauth2.authorize.get({
      query: {
        client_id: this.id,
        scope: 'bot applications.commands',
      },
    });
    const user = cli.users._add(app.bot);
    user._partial = false;
    this._patch(app.application);
    return this;
  }

  public async fetchRoleConnectionMetadataRecords(): Promise<ApplicationRoleConnectionMetadata[]> {
    const cli = this.client as unknown as {
      api: {
        applications: (id: Snowflake) => (endpoint: string) => {
          metadata: {
            get: () => Promise<RawApplicationRoleConnectionMetadataData[]>;
          };
        };
      };
    };

    const metadata = await cli.api.applications(this.id)('role-connections').metadata.get();
    return metadata.map(data => new ApplicationRoleConnectionMetadata(data));
  }

  public iconURL({ format, size }: ImageURLOptions = {}): string | null {
    if (!this.icon) return null;
    return (
      this.client as unknown as {
        rest: { cdn: { AppIcon: (id: string, icon: string, opts: ImageURLOptions) => string } };
      }
    ).rest.cdn.AppIcon(this.id, this.icon, { format, size });
  }

  public coverURL({ format, size }: ImageURLOptions = {}): string | null {
    if (!this.cover) return null;
    const httpCdn = (this.client as unknown as { options: { http: { cdn: string } } }).options.http.cdn;
    return Endpoints.CDN(httpCdn).AppIcon(this.id, this.cover, { format, size });
  }

  public async fetchAssets(): Promise<ApplicationAsset[]> {
    if (!deprecationEmittedForFetchAssets) {
      process.emitWarning(
        'Application#fetchAssets is deprecated as it is unsupported and will be removed in the next major version.',
        'DeprecationWarning',
      );
      deprecationEmittedForFetchAssets = true;
    }

    const cli = this.client as unknown as {
      api: {
        oauth2: {
          applications: (id: Snowflake) => {
            assets: {
              get: () => Promise<{ id: Snowflake; name: string; type: number }[]>;
            };
          };
        };
      };
    };

    const assets = await cli.api.oauth2.applications(this.id).assets.get();
    return assets.map(a => ({
      id: a.id,
      name: a.name,
      type: AssetTypes[a.type - 1] ?? 'UNKNOWN',
    }));
  }

  public override toString(): string | null {
    return this.name;
  }

  public override toJSON(): unknown {
    return super.toJSON({ createdTimestamp: true });
  }
}

export default Application;
