import Application from './interfaces/Application.js';
import type { User, APIUserData } from './User.js';

export interface APIIntegrationApplicationData {
  id: string;
  name: string;
  icon?: string | null;
  description?: string | null;
  bot?: APIUserData;
  terms_of_service_url?: string | null;
  privacy_policy_url?: string | null;
  rpc_origins?: string[];
  summary?: string | null;
  hook?: boolean | null;
  cover_image?: string | null;
  verify_key?: string | null;
  [key: string]: unknown;
}

export class IntegrationApplication extends Application {
  public bot: User | null = null;
  public termsOfServiceURL: string | null = null;
  public privacyPolicyURL: string | null = null;
  public rpcOrigins: string[] = [];
  public summary: string | null = null;
  public hook: boolean | null = null;
  public cover: string | null = null;
  public verifyKey: string | null = null;

  public override _patch(data: APIIntegrationApplicationData): this {
    super._patch(data);

    if ('bot' in data && data.bot) {
      this.bot = (this.client.users as unknown as { _add(d: unknown): User })._add(data.bot);
    } else {
      this.bot ??= null;
    }

    if ('terms_of_service_url' in data) {
      this.termsOfServiceURL = data.terms_of_service_url ?? null;
    } else {
      this.termsOfServiceURL ??= null;
    }

    if ('privacy_policy_url' in data) {
      this.privacyPolicyURL = data.privacy_policy_url ?? null;
    } else {
      this.privacyPolicyURL ??= null;
    }

    if ('rpc_origins' in data && data.rpc_origins) {
      this.rpcOrigins = data.rpc_origins;
    } else {
      this.rpcOrigins ??= [];
    }

    if ('summary' in data) {
      this.summary = data.summary ?? null;
    } else {
      this.summary ??= null;
    }

    if ('hook' in data) {
      this.hook = data.hook ?? null;
    } else {
      this.hook ??= null;
    }

    if ('cover_image' in data) {
      this.cover = data.cover_image ?? null;
    } else {
      this.cover ??= null;
    }

    if ('verify_key' in data) {
      this.verifyKey = data.verify_key ?? null;
    } else {
      this.verifyKey ??= null;
    }

    return this;
  }
}

export default IntegrationApplication;
