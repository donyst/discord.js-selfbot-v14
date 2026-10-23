import { Base } from './Base.js';
import { MembershipStates } from '../util/Constants.js';
import type { Team } from './Team.js';
import type { Snowflake } from '../types/index.js';

export interface RawTeamMemberData {
  permissions?: string[];
  role?: string;
  membership_state: number;
  user: unknown;
}

/**
 * Represents a Client OAuth2 Application Team Member.
 */
export class TeamMember extends Base {
  public team: Team;
  public permissions?: string[];
  public role?: string;
  public membershipState!: string | number;
  public user!: { id: Snowflake; toString(): string };

  public declare id: Snowflake;

  public constructor(team: Team, data: RawTeamMemberData) {
    super(team.client);
    this.team = team;
    Object.defineProperty(this, 'id', {
      get: () => this.user?.id,
      configurable: true,
      enumerable: true,
    });
    this._patch(data);
  }

  public override _patch(data: RawTeamMemberData): void {
    if ('permissions' in data) {
      this.permissions = data.permissions;
    }
    if ('role' in data) {
      this.role = data.role;
    }
    if ('membership_state' in data) {
      this.membershipState = MembershipStates[data.membership_state]!;
    }
    if ('user' in data) {
      this.user = (
        this.client as unknown as { users: { _add: (u: unknown) => { id: Snowflake; toString(): string } } }
      ).users._add(data.user);
    }
  }

  public override toString(): string {
    return this.user.toString();
  }
}

export default TeamMember;
