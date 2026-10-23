import { Channel, type APIChannelData } from './Channel.js';

export interface DirectoryChannelData extends APIChannelData {
  name?: string;
}

/**
 * Represents a channel that displays a directory of guilds.
 */
export class DirectoryChannel extends Channel {
  public name: string = '';

  public override _patch(data: DirectoryChannelData): this {
    super._patch(data);

    if ('name' in data && data.name != null) {
      this.name = data.name;
    }

    return this;
  }
}

export default DirectoryChannel;
