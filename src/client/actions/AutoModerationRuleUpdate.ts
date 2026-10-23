import type { Snowflake } from 'discord-api-types/v10';
import GenericAction from './Action.js';
import { Events } from '../../util/Constants.js';
import type { RawAutoModerationRuleData } from '../../structures/AutoModerationRule.js';

export class AutoModerationRuleUpdateAction extends GenericAction {
  public override handle(data: RawAutoModerationRuleData & { id: Snowflake; guild_id: Snowflake }): Record<string, unknown> {
    const { client } = this;
    const guild = client.guilds.cache.get(data.guild_id);

    if (guild) {
      const oldAutoModerationRule = guild.autoModerationRules.cache.get(data.id)?._clone() ?? null;
      const newAutoModerationRule = guild.autoModerationRules._add(data);

      client.emit(Events.AUTO_MODERATION_RULE_UPDATE, oldAutoModerationRule, newAutoModerationRule);
    }

    return {};
  }
}

export default AutoModerationRuleUpdateAction;
