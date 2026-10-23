import type { Snowflake } from 'discord-api-types/v10';
import GenericAction from './Action.js';
import { AutoModerationActionExecution, type RawAutoModerationActionExecutionData } from '../../structures/AutoModerationActionExecution.js';
import { Events } from '../../util/Constants.js';

export class AutoModerationActionExecutionAction extends GenericAction {
  public override handle(data: RawAutoModerationActionExecutionData & { guild_id: Snowflake }): Record<string, unknown> {
    const { client } = this;
    const guild = client.guilds.cache.get(data.guild_id);

    if (guild) {
      client.emit(Events.AUTO_MODERATION_ACTION_EXECUTION, new AutoModerationActionExecution(data, guild));
    }

    return {};
  }
}

export default AutoModerationActionExecutionAction;
