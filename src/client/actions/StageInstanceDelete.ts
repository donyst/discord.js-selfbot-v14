import Action from './Action.js';
import { deletedStageInstances, type StageInstance, type RawStageInstanceData } from '../../structures/StageInstance.js';
import { Events } from '../../util/Constants.js';
import type { StageChannel } from '../../structures/StageChannel.js';

export interface StageInstanceDeleteResult {
  stageInstance?: StageInstance;
}

export class StageInstanceDeleteAction extends Action {
  public handle(data: RawStageInstanceData): StageInstanceDeleteResult {
    const client = this.client;
    const channel = this.getChannel({ id: data.channel_id, guild_id: data.guild_id }) as StageChannel | null;

    if (channel && channel.guild) {
      const stageInstance = (channel.guild.stageInstances as unknown as { _add(d: unknown): StageInstance })._add(data);
      if (stageInstance) {
        channel.guild.stageInstances.cache.delete(stageInstance.id);
        deletedStageInstances.add(stageInstance);

        client.emit(Events.STAGE_INSTANCE_DELETE, stageInstance);

        return { stageInstance };
      }
    }

    return {};
  }
}

export default StageInstanceDeleteAction;
