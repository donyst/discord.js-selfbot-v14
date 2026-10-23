import Action from './Action.js';
import { Events } from '../../util/Constants.js';
import type { StageInstance, RawStageInstanceData } from '../../structures/StageInstance.js';
import type { StageChannel } from '../../structures/StageChannel.js';

export interface StageInstanceCreateResult {
  stageInstance?: StageInstance;
}

export class StageInstanceCreateAction extends Action {
  public handle(data: RawStageInstanceData): StageInstanceCreateResult {
    const client = this.client;
    const channel = this.getChannel({ id: data.channel_id, guild_id: data.guild_id }) as StageChannel | null;

    if (channel && channel.guild) {
      const stageInstance = (channel.guild.stageInstances as unknown as { _add(d: unknown): StageInstance })._add(data);

      client.emit(Events.STAGE_INSTANCE_CREATE, stageInstance);

      return { stageInstance };
    }

    return {};
  }
}

export default StageInstanceCreateAction;
