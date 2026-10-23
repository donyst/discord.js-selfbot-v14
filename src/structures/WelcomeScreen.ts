import { Collection } from '@discordjs/collection';
import Base from './Base.js';
import WelcomeChannel, { type APIWelcomeChannelData } from './WelcomeChannel.js';
import type { Snowflake } from '../types/index.js';
import type { Guild } from './Guild.js';

export interface APIWelcomeScreenData {
  description?: string | null;
  welcome_channels: APIWelcomeChannelData[];
  [key: string]: unknown;
}

export class WelcomeScreen extends Base {
  public guild: Guild;
  public description: string | null;
  public welcomeChannels: Collection<Snowflake, WelcomeChannel>;

  public constructor(guild: Guild, data: APIWelcomeScreenData) {
    super(guild.client);
    this.guild = guild;
    this.description = data.description ?? null;
    this.welcomeChannels = new Collection();

    for (const channel of data.welcome_channels ?? []) {
      const welcomeChannel = new WelcomeChannel(this.guild, channel);
      this.welcomeChannels.set(welcomeChannel.channelId, welcomeChannel);
    }
  }

  public get enabled(): boolean {
    return this.guild.features.includes('WELCOME_SCREEN_ENABLED');
  }
}

export default WelcomeScreen;
