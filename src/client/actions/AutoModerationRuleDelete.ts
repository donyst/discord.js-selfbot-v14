import type { Snowflake } from 'discord-api-types/v10';
import GenericAction from './Action.js';
import { Events } from '../../util/Constants.js';

export class AutoModerationRuleDeleteAction extends GenericAction {
  public override handle(data: { id: Snowflake; guild_id: Snowflake }): Record<string, unknown> {
    const { client } = this;
    const guild = client.guilds.cache.get(data.guild_id);

    if (guild) {
      const autoModerationRule = guild.autoModerationRules.cache.get(data.id);

      if (autoModerationRule) {
        guild.autoModerationRules.cache.delete(autoModerationRule.id);
        client.emit(Events.AUTO_MODERATION_RULE_DELETE, autoModerationRule);
      }
    }

    return {};
  }
}

export default AutoModerationRuleDeleteAction;
