import Action from './Action.js';
import { Events, PartialTypes } from '../../util/Constants.js';
import type { Presence } from '../../structures/Presence.js';
import type { User } from '../../structures/User.js';
import type { Guild } from '../../structures/Guild.js';
import type { GuildMember } from '../../structures/GuildMember.js';

export interface GatewayPresenceUpdateData {
  user: {
    id: string;
    username?: string;
    [key: string]: unknown;
  };
  guild_id?: string;
  status?: string;
  [key: string]: unknown;
}

export class PresenceUpdateAction extends Action {
  public handle(data: GatewayPresenceUpdateData): void {
    let user: User | undefined = this.client.users.cache.get(data.user.id);
    if (!user && data.user?.username) {
      user = (this.client.users as unknown as { _add(d: unknown): User })._add(data.user);
    }
    if (!user && ('username' in data.user || (this.client.options.partials as unknown as string[]).includes(PartialTypes.USER))) {
      user = (this.client.users as unknown as { _add(d: unknown): User })._add(data.user);
    }
    if (!user) return;

    if (data.user?.username) {
      if (!(user as unknown as { _equals(d: unknown): boolean })._equals(data.user)) {
        (this.client.actions as unknown as { UserUpdate: { handle(d: unknown): void } }).UserUpdate.handle(data.user);
      }
    }

    const guild: Guild | undefined = data.guild_id ? this.client.guilds.cache.get(data.guild_id) : undefined;

    if (guild) {
      let member: GuildMember | undefined = guild.members.cache.get(user.id);
      if (!member && data.status !== 'offline') {
        member = (guild.members as unknown as { _add(d: unknown): GuildMember })._add({
          user,
          deaf: false,
          mute: false,
        });
        this.client.emit(Events.GUILD_MEMBER_AVAILABLE, member);
      }
    }

    const targetManager = (guild?.presences ?? (this.client as unknown as { presences: { cache: Map<string, Presence>; _add(d: unknown): Presence } }).presences);
    const oldPresence = (targetManager.cache.get(user.id) as unknown as { _clone(): Presence } | undefined)?._clone() ?? null;
    const newPresence = (targetManager as unknown as { _add(d: unknown): Presence })._add(Object.assign(data, { guild }));

    if (this.client.listenerCount(Events.PRESENCE_UPDATE) && !(newPresence as unknown as { equals(other: unknown): boolean }).equals(oldPresence)) {
      this.client.emit(Events.PRESENCE_UPDATE, oldPresence, newPresence);
    }
  }
}

export default PresenceUpdateAction;
