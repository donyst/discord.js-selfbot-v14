import AnonymousGuild, { type AnonymousGuildData } from './AnonymousGuild.js';
import WelcomeScreen, { type APIWelcomeScreenData } from './WelcomeScreen.js';
import type { Client } from '../client/Client.js';
import type { Guild } from './Guild.js';

export interface InviteGuildData extends AnonymousGuildData {
  welcome_screen?: APIWelcomeScreenData;
}

export class InviteGuild extends AnonymousGuild {
  public welcomeScreen: WelcomeScreen | null = null;

  public constructor(client: Client, data: InviteGuildData) {
    super(client, data);

    this.welcomeScreen =
      typeof data.welcome_screen !== 'undefined'
        ? new WelcomeScreen(this as unknown as Guild, data.welcome_screen)
        : null;
  }
}

export default InviteGuild;
