import type { Snowflake } from 'discord-api-types/v10';
import GenericAction from './Action.js';
import { GuildAuditLogsEntry, type RawAuditLogEntryData } from '../../structures/GuildAuditLogs.js';
import { Events } from '../../util/Constants.js';

export class GuildAuditLogEntryCreateAction extends GenericAction {
  public override handle(data: RawAuditLogEntryData & { guild_id: Snowflake }): { auditLogEntry?: GuildAuditLogsEntry } {
    const client = this.client;
    const guild = client.guilds.cache.get(data.guild_id);
    let auditLogEntry: GuildAuditLogsEntry | undefined;

    if (guild) {
      auditLogEntry = new GuildAuditLogsEntry(guild, data);
      client.emit(Events.GUILD_AUDIT_LOG_ENTRY_CREATE, auditLogEntry, guild);
    }

    return { auditLogEntry };
  }
}

export default GuildAuditLogEntryCreateAction;
