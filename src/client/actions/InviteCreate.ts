import type { Snowflake } from 'discord-api-types/v10';
import GenericAction from './Action.js';
import { Events } from '../../util/Constants.js';
import type { Invite, APIInviteData } from '../../structures/Invite.js';

export class InviteCreateAction extends GenericAction {
  public override handle(data: APIInviteData & { channel_id: Snowflake; guild_id: Snowflake }): { invite?: Invite } | false {
    const client = this.client;
    const channel = client.channels.cache.get(data.channel_id);
    const guild = client.guilds.cache.get(data.guild_id);
    if (!channel || !guild) return false;

    const inviteData = Object.assign(data, { channel, guild });
    const invite = guild.invites._add(inviteData);

    client.emit(Events.INVITE_CREATE, invite);
    return { invite };
  }
}

export default InviteCreateAction;
