import type { Client } from '../../Client.js';
import type { GatewayPacket } from '../WebSocketManager.js';
import VoiceChannelEffect, { type RawVoiceChannelEffectData } from '../../../structures/VoiceChannelEffect.js';
import { Events } from '../../../util/Constants.js';

export default (client: Client, { d: data }: GatewayPacket): void => {
  const d = data as RawVoiceChannelEffectData & { guild_id: string };
  const guild = client.guilds.cache.get(d.guild_id);
  if (!guild) return;

  client.emit(Events.VOICE_CHANNEL_EFFECT_SEND, new VoiceChannelEffect(d, guild));
};
