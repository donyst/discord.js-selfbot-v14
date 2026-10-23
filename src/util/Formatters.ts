import {
  blockQuote,
  bold,
  channelMention,
  codeBlock,
  formatEmoji,
  hideLinkEmbed,
  hyperlink,
  inlineCode,
  italic,
  quote,
  roleMention,
  spoiler,
  strikethrough,
  time,
  TimestampStyles,
  TimestampStylesString,
  underscore,
  userMention,
} from '@discordjs/builders';
import type { Snowflake } from '../types/index.js';

/**
 * Contains various Discord-specific functions for formatting messages.
 */
export class Formatters {
  private constructor() {}

  public static blockQuote = blockQuote;
  public static bold = bold;
  public static channelMention = channelMention;
  public static codeBlock = codeBlock;
  public static formatEmoji = formatEmoji;
  public static hideLinkEmbed = hideLinkEmbed;
  public static hyperlink = hyperlink;
  public static inlineCode = inlineCode;
  public static italic = italic;
  public static quote = quote;
  public static roleMention = roleMention;
  public static spoiler = spoiler;
  public static strikethrough = strikethrough;
  public static time = time;
  public static TimestampStyles = TimestampStyles;
  public static underscore = underscore;
  public static userMention = userMention;

  /**
   * Formats an application command name, subcommand group name, subcommand name, and ID
   * into an application command mention
   */
  public static chatInputApplicationCommandMention(
    commandName: string,
    subcommandGroupOrSubOrId: string | Snowflake,
    subcommandNameOrId?: string | Snowflake,
    commandId?: Snowflake,
  ): string {
    if (typeof commandId !== 'undefined') {
      return `</${commandName} ${subcommandGroupOrSubOrId} ${subcommandNameOrId}:${commandId}>`;
    }

    if (typeof subcommandNameOrId !== 'undefined') {
      return `</${commandName} ${subcommandGroupOrSubOrId}:${subcommandNameOrId}>`;
    }

    return `</${commandName}:${subcommandGroupOrSubOrId}>`;
  }
}

export {
  blockQuote,
  bold,
  channelMention,
  codeBlock,
  formatEmoji,
  hideLinkEmbed,
  hyperlink,
  inlineCode,
  italic,
  quote,
  roleMention,
  spoiler,
  strikethrough,
  time,
  TimestampStyles,
  TimestampStylesString,
  underscore,
  userMention,
};

export default Formatters;
