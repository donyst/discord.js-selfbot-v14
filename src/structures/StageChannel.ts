import BaseGuildVoiceChannel, { type BaseGuildVoiceChannelData } from './BaseGuildVoiceChannel.js';
import type { StageInstance, StageInstanceCreateOptions } from './StageInstance.js';
import type { GuildChannel } from './GuildChannel.js';

export interface StageChannelData extends BaseGuildVoiceChannelData {
  topic?: string | null;
}

/**
 * Represents a guild stage channel on Discord.
 */
export class StageChannel extends BaseGuildVoiceChannel {
  public topic: string | null = null;

  public override _patch(data: StageChannelData): this {
    super._patch(data);

    if ('topic' in data) {
      this.topic = data.topic ?? null;
    }

    return this;
  }

  public get stageInstance(): StageInstance | null {
    return (this.guild as unknown as { stageInstances?: { cache: { find(fn: (s: { channelId: string }) => boolean): StageInstance | undefined } } })
      .stageInstances?.cache.find(stageInstance => stageInstance.channelId === this.id) ?? null;
  }

  public createStageInstance(options: StageInstanceCreateOptions): Promise<StageInstance> {
    return (this.guild as unknown as { stageInstances: { create(chId: string, opts: StageInstanceCreateOptions): Promise<StageInstance> } })
      .stageInstances.create(this.id, options);
  }

  public setTopic(topic: string | null, reason?: string): Promise<GuildChannel> {
    return this.edit({ topic: topic ?? undefined }, reason);
  }
}

export default StageChannel;
