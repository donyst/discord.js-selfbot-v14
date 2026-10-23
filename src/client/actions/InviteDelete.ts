import type { Snowflake } from 'discord-api-types/v10';
import GenericAction from './Action.js';
import { Invite, type APIInviteData } from '../../structures/Invite.js';
import { Events } from '../../util/Constants.js';

export class InviteDeleteAction extends GenericAction {
  public override handle(data: APIInviteData & { channel_id: Snowflake; guild_id: Snowflake }): { invite?: Invite } | false {
    const client = this.client;
    const channel = client.channels.cache.get(data.channel_id);
    const guild = client.guilds.cache.get(data.guild_id);
    if (!channel || !guild) return false;

    const inviteData = Object.assign(data, { channel, guild });
    const invite = new Invite(client, inviteData);
    guild.invites.cache.delete(invite.code);

    client.emit(Events.INVITE_DELETE, invite);
    return { invite };
  }
}

export default InviteDeleteAction;
