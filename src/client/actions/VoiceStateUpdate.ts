import Action from './Action.js';
import { VoiceState, type RawVoiceStateData } from '../../structures/VoiceState.js';
import { Events } from '../../util/Constants.js';
import type { Snowflake } from '../../types/index.js';
import type { Guild } from '../../structures/Guild.js';
import type { GuildMember } from '../../structures/GuildMember.js';

export interface RawVoiceStateUpdateData extends RawVoiceStateData {
  guild_id?: Snowflake;
  member?: Record<string, unknown> & { user?: Record<string, unknown>; joined_at?: string };
}

export class VoiceStateUpdate extends Action {
  public handle(data: RawVoiceStateUpdateData): void {
    const client = this.client;
    const guild = data.guild_id ? client.guilds.cache.get(data.guild_id) : undefined;

    if (guild) {
      // Update the state
      const oldState =
        (guild.voiceStates.cache.get(data.user_id) as unknown as { _clone(): VoiceState } | undefined)?._clone() ??
        new VoiceState(guild, { user_id: data.user_id });

      const newState = (guild.voiceStates as unknown as { _add(d: unknown): VoiceState })._add(data);

      // Get the member
      const member = guild.members.cache.get(data.user_id);
      if (member && data.member) {
        (member as unknown as { _patch(d: unknown): void })._patch(data.member);
      } else if (data.member?.user && data.member.joined_at) {
        (guild.members as unknown as { _add(d: unknown): GuildMember })._add(data.member);
      }

      client.emit(Events.VOICE_STATE_UPDATE, oldState, newState);
    } else {
      // Update the state
      const oldState =
        ((client as unknown as { voiceStates: { cache: Map<string, VoiceState>; _add(d: unknown): VoiceState } }).voiceStates.cache.get(data.user_id) as unknown as { _clone(): VoiceState } | undefined)?._clone() ??
        new VoiceState({ client } as unknown as Guild, { user_id: data.user_id });

      const newState = (client as unknown as { voiceStates: { _add(d: unknown): VoiceState } }).voiceStates._add(data);

      client.emit(Events.VOICE_STATE_UPDATE, oldState, newState);
    }

    // Emit event
    if (data.user_id === client.user?.id) {
      client.emit('debug', `[VOICE] received voice state update: ${JSON.stringify(data)}`);
      (client as unknown as { voice?: { onVoiceStateUpdate(d: unknown): void } }).voice?.onVoiceStateUpdate(data);
    }
  }
}

export default VoiceStateUpdate;
