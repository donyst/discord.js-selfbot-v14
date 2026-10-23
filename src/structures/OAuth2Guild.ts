import BaseGuild, { type BaseGuildData } from './BaseGuild.js';
import Permissions from '../util/Permissions.js';
import type { Client } from '../client/Client.js';

export interface RawOAuth2GuildData extends BaseGuildData {
  owner: boolean;
  permissions: string | bigint | number;
}

/**
 * A partial guild received when using {@link GuildManager#fetch} to fetch multiple guilds.
 * @extends {BaseGuild}
 */
export class OAuth2Guild extends BaseGuild {
  /**
   * Whether the client user is the owner of the guild
   */
  public owner: boolean;

  /**
   * The permissions that the client user has in this guild
   */
  public permissions: Readonly<Permissions>;

  public constructor(client: Client, data: RawOAuth2GuildData) {
    super(client, data);
    this.owner = data.owner;
    this.permissions = new Permissions(BigInt(data.permissions)).freeze();
  }
}

export default OAuth2Guild;
