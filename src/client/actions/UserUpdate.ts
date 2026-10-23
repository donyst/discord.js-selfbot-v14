import Action from './Action.js';
import { Events } from '../../util/Constants.js';
import type { Snowflake } from '../../types/index.js';
import type { User } from '../../structures/User.js';

export interface RawUserUpdateData {
  id: Snowflake;
  [key: string]: unknown;
}

export interface UserUpdateResult {
  old: User | null;
  updated: User | null;
}

export class UserUpdateAction extends Action {
  public handle(data: RawUserUpdateData): UserUpdateResult {
    const client = this.client;

    const newUser = data.id === client.user?.id ? client.user : client.users.cache.get(data.id);
    if (!newUser) {
      return {
        old: null,
        updated: null,
      };
    }

    const oldUser = (newUser as unknown as { _update(d: unknown): User })._update(data);

    if (!(oldUser as unknown as { equals(other: unknown): boolean }).equals(newUser)) {
      client.emit(Events.USER_UPDATE, oldUser, newUser);
      return {
        old: oldUser,
        updated: newUser,
      };
    }

    return {
      old: null,
      updated: null,
    };
  }
}

export default UserUpdateAction;
