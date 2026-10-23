import { Collection } from '@discordjs/collection';
import type { Snowflake } from 'discord-api-types/v10';
import CachedManager from './CachedManager.js';
import { DiscordjsError as Error } from '../errors/index.js';
import User from '../structures/User.js';
import { ReactionTypes } from '../util/Constants.js';
import type { MessageReaction } from '../structures/MessageReaction.js';

export type ReactionType = 'NORMAL' | 'BURST' | number;

export interface FetchReactionUsersOptions {
  type?: ReactionType;
  limit?: number;
  after?: Snowflake;
}

/**
 * Manages API methods for users who reacted to a reaction and stores their cache.
 * @extends {CachedManager}
 */
export class ReactionUserManager extends CachedManager<Snowflake, User, unknown> {
  /**
   * The reaction that this manager belongs to
   */
  public reaction: MessageReaction;

  public constructor(reaction: MessageReaction, iterable?: Iterable<User>) {
    super(reaction.client, User, iterable);
    this.reaction = reaction;
  }

  /**
   * Fetches all the users that gave this reaction. Resolves with a collection of users, mapped by their ids.
   */
  public async fetch({ limit = 100, after, type = 'NORMAL' }: FetchReactionUsersOptions = {}): Promise<Collection<Snowflake, User>> {
    const message = this.reaction.message;
    const resolvedType = typeof type === 'number' ? type : (ReactionTypes as unknown as Record<string, number>)[type];
    const api = (this.client as unknown as { api: { channels: Record<string, { messages: Record<string, { reactions: Record<string, { get: (opts: unknown) => Promise<Record<string, unknown>[]> }> }> }> } }).api;
    const data = await api.channels[message.channelId].messages[message.id].reactions[
      this.reaction.emoji.identifier
    ].get({ query: { limit, after, type: resolvedType } });

    const users = new Collection<Snowflake, User>();
    for (const rawUser of data) {
      const user = (this.client as unknown as { users: { _add: (u: unknown) => User } }).users._add(rawUser);
      this.cache.set(user.id, user);
      users.set(user.id, user);
    }
    return users;
  }

  /**
   * Removes a user from this reaction.
   */
  public async remove(user: unknown = (this.client as unknown as { user: User }).user): Promise<MessageReaction> {
    const clientUsers = (this.client as unknown as { users: { resolveId: (u: unknown) => Snowflake | null }; user: { id: Snowflake } });
    const userId = clientUsers.users.resolveId(user);
    if (!userId) throw new Error('REACTION_RESOLVE_USER');
    const message = this.reaction.message;
    const api = (this.client as unknown as { api: { channels: Record<string, { messages: Record<string, { reactions: Record<string, Record<string, { delete: () => Promise<unknown> }>> }> }> } }).api;
    await api.channels[message.channelId].messages[message.id].reactions[this.reaction.emoji.identifier][
      userId === clientUsers.user.id ? '@me' : userId
    ].delete();
    return this.reaction;
  }
}

export default ReactionUserManager;
