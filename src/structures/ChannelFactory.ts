import { Channel, type APIChannelData, setChannelCreator } from './Channel.js';
import DMChannel from './DMChannel.js';
import GroupDMChannel from './GroupDMChannel.js';
import TextChannel from './TextChannel.js';
import VoiceChannel from './VoiceChannel.js';
import CategoryChannel from './CategoryChannel.js';
import NewsChannel from './NewsChannel.js';
import StoreChannel from './StoreChannel.js';
import StageChannel from './StageChannel.js';
import ThreadChannel from './ThreadChannel.js';
import DirectoryChannel from './DirectoryChannel.js';
import ForumChannel from './ForumChannel.js';
import MediaChannel from './MediaChannel.js';
import { ChannelTypes } from '../util/Constants.js';
import type { Snowflake } from '../types/index.js';
import type { Client } from '../client/Client.js';
import type { Guild } from './Guild.js';

export function createChannel(
  client: Client,
  data: APIChannelData,
  guild?: Guild | null,
  { allowUnknownGuild }: { allowUnknownGuild?: boolean } = {},
): Channel | null {
  let channel: Channel | null = null;
  const typeNum =
    typeof data.type === 'number'
      ? data.type
      : (ChannelTypes as Record<string, number>)[data.type as string];

  if (!data.guild_id && !guild) {
    if ((data.recipients && typeNum !== ChannelTypes.GROUP_DM) || typeNum === ChannelTypes.DM) {
      channel = new DMChannel(client, data);
    } else if (typeNum === ChannelTypes.GROUP_DM) {
      channel = new GroupDMChannel(
        client,
        data as unknown as import('./GroupDMChannel.js').APIGroupDMChannelData,
      );
    }
  } else {
    const resolvedGuild =
      guild ??
      (client.guilds.cache as unknown as { get(id: Snowflake): Guild | undefined }).get(
        data.guild_id!,
      );

    if (resolvedGuild || allowUnknownGuild) {
      const targetGuild = resolvedGuild as Guild;
      switch (typeNum) {
        case ChannelTypes.GUILD_TEXT: {
          channel = new TextChannel(targetGuild, data, client);
          break;
        }
        case ChannelTypes.GUILD_VOICE: {
          channel = new VoiceChannel(targetGuild, data, client);
          break;
        }
        case ChannelTypes.GUILD_CATEGORY: {
          channel = new CategoryChannel(targetGuild, data, client);
          break;
        }
        case ChannelTypes.GUILD_NEWS: {
          channel = new NewsChannel(targetGuild, data, client);
          break;
        }
        case ChannelTypes.GUILD_STORE: {
          channel = new StoreChannel(targetGuild, data, client);
          break;
        }
        case ChannelTypes.GUILD_STAGE_VOICE: {
          channel = new StageChannel(targetGuild, data, client);
          break;
        }
        case ChannelTypes.GUILD_NEWS_THREAD:
        case ChannelTypes.GUILD_PUBLIC_THREAD:
        case ChannelTypes.GUILD_PRIVATE_THREAD: {
          channel = new ThreadChannel(targetGuild, data, client);
          if (!allowUnknownGuild) {
            (
              channel as unknown as {
                parent?: { threads: { cache: { set(id: Snowflake, ch: unknown): void } } };
              }
            ).parent?.threads.cache.set(channel!.id, channel);
          }
          break;
        }
        case ChannelTypes.GUILD_DIRECTORY: {
          channel = new DirectoryChannel(client, data);
          break;
        }
        case ChannelTypes.GUILD_FORUM: {
          channel = new ForumChannel(targetGuild, data, client);
          break;
        }
        case ChannelTypes.GUILD_MEDIA: {
          channel = new MediaChannel(targetGuild, data, client);
          break;
        }
      }
      if (channel && !allowUnknownGuild) {
        (
          resolvedGuild?.channels?.cache as unknown as {
            set(id: Snowflake, ch: unknown): void;
          }
        )?.set(channel.id, channel);
      }
    }
  }
  return channel;
}

setChannelCreator(createChannel);
