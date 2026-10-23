import Action from './Action.js';
import { Events } from '../../util/Constants.js';
import type { StageInstance, RawStageInstanceData } from '../../structures/StageInstance.js';
import type { StageChannel } from '../../structures/StageChannel.js';

export interface StageInstanceUpdateResult {
  oldStageInstance?: StageInstance | null;
  newStageInstance?: StageInstance;
}

export class StageInstanceUpdateAction extends Action {
  public handle(data: RawStageInstanceData): StageInstanceUpdateResult {
    const client = this.client;
    const channel = this.getChannel({ id: data.channel_id, guild_id: data.guild_id }) as StageChannel | null;

    if (channel && channel.guild) {
      const oldStageInstance = (channel.guild.stageInstances.cache.get(data.id) as unknown as { _clone(): StageInstance } | undefined)?._clone() ?? null;
      const newStageInstance = (channel.guild.stageInstances as unknown as { _add(d: unknown): StageInstance })._add(data);

      client.emit(Events.STAGE_INSTANCE_UPDATE, oldStageInstance, newStageInstance);

      return { oldStageInstance, newStageInstance };
    }

    return {};
  }
}

export default StageInstanceUpdateAction;
