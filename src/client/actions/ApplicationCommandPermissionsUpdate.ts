import type { Snowflake } from 'discord-api-types/v10';
import GenericAction from './Action.js';
import { Events } from '../../util/Constants.js';
import type { ApplicationCommandPermissions } from '../../managers/ApplicationCommandPermissionsManager.js';

export interface ApplicationCommandPermissionsUpdateData {
  id: Snowflake;
  guildId: Snowflake;
  applicationId: Snowflake;
  permissions: ApplicationCommandPermissions[];
}

export class ApplicationCommandPermissionsUpdateAction extends GenericAction {
  public override handle(data: {
    id: Snowflake;
    guild_id: Snowflake;
    application_id: Snowflake;
    permissions: ApplicationCommandPermissions[];
  }): void {
    const client = this.client;
    client.emit(Events.APPLICATION_COMMAND_PERMISSIONS_UPDATE, {
      permissions: data.permissions,
      id: data.id,
      guildId: data.guild_id,
      applicationId: data.application_id,
    });
  }
}

export default ApplicationCommandPermissionsUpdateAction;
