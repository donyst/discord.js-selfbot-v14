import { Collection } from '@discordjs/collection';
import { Base } from './Base.js';
import { TeamMember, type RawTeamMemberData } from './TeamMember.js';
import { SnowflakeUtil } from '../util/SnowflakeUtil.js';
import type { Snowflake } from '../types/index.js';
import type { ImageURLOptions } from '../util/Constants.js';
import type { Client } from '../client/Client.js';

export interface RawTeamData {
  id: Snowflake;
  name?: string;
  icon?: string | null;
  owner_user_id?: Snowflake | null;
  members: RawTeamMemberData[];
}

/**
 * Represents a Client OAuth2 Application Team.
 */
export class Team extends Base {
  public name!: string;
  public icon: string | null = null;
  public ownerId: Snowflake | null = null;
  public members: Collection<Snowflake, TeamMember> = new Collection();

  public constructor(client: Client | unknown, data: RawTeamData) {
    super(client as Client);
    this._patch(data);
  }

  public override _patch(data: RawTeamData): void {
    this.id = data.id;

    if ('name' in data && data.name !== undefined) {
      this.name = data.name;
    }
    if ('icon' in data) {
      this.icon = data.icon ?? null;
    }
    if ('owner_user_id' in data) {
      this.ownerId = data.owner_user_id ?? null;
    }

    this.members = new Collection();
    for (const memberData of data.members) {
      const member = new TeamMember(this, memberData);
      this.members.set(member.id, member);
    }
  }

  public get owner(): TeamMember | null {
    return this.ownerId ? this.members.get(this.ownerId) ?? null : null;
  }

  public get createdTimestamp(): number {
    return SnowflakeUtil.timestampFrom(this.id);
  }

  public get createdAt(): Date {
    return new Date(this.createdTimestamp);
  }

  public iconURL(options: ImageURLOptions = {}): string | null {
    if (!this.icon) return null;
    return (
      this.client as unknown as {
        rest: { cdn: { TeamIcon: (id: string, hash: string, opts: ImageURLOptions) => string } };
      }
    ).rest.cdn.TeamIcon(this.id, this.icon, options);
  }

  public override toString(): string {
    return this.name;
  }

  public override toJSON(): unknown {
    return super.toJSON({ createdTimestamp: true });
  }
}

export default Team;
