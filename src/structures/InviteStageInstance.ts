import { Collection } from '@discordjs/collection';
import Base from './Base.js';
import type { Snowflake } from '../types/index.js';
import type { Client } from '../client/Client.js';
import type { Guild } from './Guild.js';
import type { GuildMember } from './GuildMember.js';
import type { StageChannel } from './StageChannel.js';

export interface APIInviteStageInstanceData {
  topic?: string;
  participant_count?: number;
  speaker_count?: number;
  members: Record<string, unknown>[];
  [key: string]: unknown;
}

export class InviteStageInstance extends Base {
  public channelId: Snowflake;
  public guildId: Snowflake;
  public members: Collection<Snowflake, GuildMember> = new Collection();
  public topic?: string;
  public participantCount?: number;
  public speakerCount?: number;

  public constructor(client: Client, data: APIInviteStageInstanceData, channelId: Snowflake, guildId: Snowflake) {
    super(client);
    this.channelId = channelId;
    this.guildId = guildId;
    this._patch(data);
  }

  public override _patch(data: APIInviteStageInstanceData): this {
    if ('topic' in data) {
      this.topic = data.topic;
    }

    if ('participant_count' in data) {
      this.participantCount = data.participant_count;
    }

    if ('speaker_count' in data) {
      this.speakerCount = data.speaker_count;
    }

    this.members.clear();
    const guild = this.guild;
    if (guild && data.members) {
      for (const rawMember of data.members) {
        const member = (guild.members as unknown as { _add(m: unknown): GuildMember })._add(rawMember);
        this.members.set(member.id, member);
      }
    }

    return this;
  }

  public get channel(): StageChannel | null {
    return (this.client.channels as unknown as { resolve(id: Snowflake): StageChannel | null }).resolve(this.channelId);
  }

  public get guild(): Guild | null {
    return (this.client.guilds as unknown as { resolve(id: Snowflake): Guild | null }).resolve(this.guildId);
  }
}

export default InviteStageInstance;
