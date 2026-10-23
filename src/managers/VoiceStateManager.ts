import { CachedManager } from './CachedManager.js';
import { VoiceState, type RawVoiceStateData } from '../structures/VoiceState.js';
import type { Snowflake, BaseFetchOptions } from '../types/index.js';
import type { GuildMemberResolvable } from './GuildMemberManager.js';
import type { Guild } from '../structures/Guild.js';
import type { Client } from '../client/Client.js';

/**
 * Manages API methods for VoiceStates and stores their cache.
 * @extends {CachedManager}
 */
export class VoiceStateManager extends CachedManager<Snowflake, VoiceState, RawVoiceStateData> {
  /**
   * The guild this manager belongs to
   */
  public guild: Guild | null;

  public constructor(guild: Guild | { client: Client }, iterable?: Iterable<VoiceState>) {
    super('client' in guild ? guild.client : (guild as Guild).client, VoiceState, iterable);
    this.guild = 'members' in guild ? (guild as Guild) : null;
  }

  public override _add(data: RawVoiceStateData, cache: boolean = true): VoiceState {
    const existing = this.cache.get(data.user_id);
    if (existing) {
      (existing as unknown as { _patch(d: unknown): void })._patch(data);
      return existing;
    }

    const entry = new VoiceState(this.guild ?? (this.client as unknown as Guild), data);
    if (cache) this.cache.set(data.user_id, entry);
    return entry;
  }

  /**
   * Obtains a user's voice state from discord or from the cache if it's already available.
   */
  public async fetch(
    member: GuildMemberResolvable | '@me',
    { cache = true, force = false }: BaseFetchOptions = {},
  ): Promise<VoiceState> {
    if (!this.guild?.id) throw new Error('Guild is not defined');
    const members = this.guild.members as unknown as { resolveId(m: unknown): Snowflake | null };
    const id = member === '@me' ? member : members.resolveId(member);
    if (!id) throw new Error('Member resolve id failed');

    if (!force) {
      const existing = this.cache.get(id === '@me' ? (this.client.user?.id ?? '') : id);
      if (existing) return existing;
    }

    const api = this.client.api as unknown as {
      guilds(guildId: Snowflake): {
        ['voice-states']: Record<
          string,
          {
            get(): Promise<RawVoiceStateData>;
          }
        >;
      };
    };

    const data = await api.guilds(this.guild.id)['voice-states'][id].get();
    return this._add(data, cache);
  }
}

export default VoiceStateManager;
