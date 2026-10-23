import type { Client } from '../Client.js';
import Action from './Action.js';

import ApplicationCommandPermissionsUpdate from './ApplicationCommandPermissionsUpdate.js';
import AutoModerationActionExecution from './AutoModerationActionExecution.js';
import AutoModerationRuleCreate from './AutoModerationRuleCreate.js';
import AutoModerationRuleDelete from './AutoModerationRuleDelete.js';
import AutoModerationRuleUpdate from './AutoModerationRuleUpdate.js';
import ChannelCreate from './ChannelCreate.js';
import ChannelDelete from './ChannelDelete.js';
import ChannelUpdate from './ChannelUpdate.js';
import GuildAuditLogEntryCreate from './GuildAuditLogEntryCreate.js';
import GuildBanAdd from './GuildBanAdd.js';
import GuildBanRemove from './GuildBanRemove.js';
import GuildChannelsPositionUpdate from './GuildChannelsPositionUpdate.js';
import GuildDelete from './GuildDelete.js';
import GuildEmojiCreate from './GuildEmojiCreate.js';
import GuildEmojiDelete from './GuildEmojiDelete.js';
import GuildEmojiUpdate from './GuildEmojiUpdate.js';
import GuildEmojisUpdate from './GuildEmojisUpdate.js';
import GuildIntegrationsUpdate from './GuildIntegrationsUpdate.js';
import GuildMemberRemove from './GuildMemberRemove.js';
import GuildMemberUpdate from './GuildMemberUpdate.js';
import GuildRoleCreate from './GuildRoleCreate.js';
import GuildRoleDelete from './GuildRoleDelete.js';
import GuildRoleUpdate from './GuildRoleUpdate.js';
import GuildRolesPositionUpdate from './GuildRolesPositionUpdate.js';
import GuildScheduledEventCreate from './GuildScheduledEventCreate.js';
import GuildScheduledEventDelete from './GuildScheduledEventDelete.js';
import GuildScheduledEventUpdate from './GuildScheduledEventUpdate.js';
import GuildScheduledEventUserAdd from './GuildScheduledEventUserAdd.js';
import GuildScheduledEventUserRemove from './GuildScheduledEventUserRemove.js';
import GuildStickerCreate from './GuildStickerCreate.js';
import GuildStickerDelete from './GuildStickerDelete.js';
import GuildStickerUpdate from './GuildStickerUpdate.js';
import GuildStickersUpdate from './GuildStickersUpdate.js';
import GuildUpdate from './GuildUpdate.js';
import InviteCreate from './InviteCreate.js';
import InviteDelete from './InviteDelete.js';
import MessageCreate from './MessageCreate.js';
import MessageDelete from './MessageDelete.js';
import MessageDeleteBulk from './MessageDeleteBulk.js';
import MessagePollVoteAdd from './MessagePollVoteAdd.js';
import MessagePollVoteRemove from './MessagePollVoteRemove.js';
import MessageReactionAdd from './MessageReactionAdd.js';
import MessageReactionRemove from './MessageReactionRemove.js';
import MessageReactionRemoveAll from './MessageReactionRemoveAll.js';
import MessageReactionRemoveEmoji from './MessageReactionRemoveEmoji.js';
import MessageUpdate from './MessageUpdate.js';
import PresenceUpdate from './PresenceUpdate.js';
import StageInstanceCreate from './StageInstanceCreate.js';
import StageInstanceDelete from './StageInstanceDelete.js';
import StageInstanceUpdate from './StageInstanceUpdate.js';
import ThreadCreate from './ThreadCreate.js';
import ThreadDelete from './ThreadDelete.js';
import ThreadListSync from './ThreadListSync.js';
import ThreadMemberUpdate from './ThreadMemberUpdate.js';
import ThreadMembersUpdate from './ThreadMembersUpdate.js';
import TypingStart from './TypingStart.js';
import UserUpdate from './UserUpdate.js';
import VoiceStateUpdate from './VoiceStateUpdate.js';
import WebhooksUpdate from './WebhooksUpdate.js';

export interface ActionConstructor<T extends Action = Action> {
  new (client: Client): T;
}

export class ActionsManager {
  public client: Client;
  public readonly injectedUser: symbol;
  public readonly injectedChannel: symbol;
  public readonly injectedMessage: symbol;

  public ApplicationCommandPermissionsUpdate!: ApplicationCommandPermissionsUpdate;
  public AutoModerationActionExecution!: AutoModerationActionExecution;
  public AutoModerationRuleCreate!: AutoModerationRuleCreate;
  public AutoModerationRuleDelete!: AutoModerationRuleDelete;
  public AutoModerationRuleUpdate!: AutoModerationRuleUpdate;
  public ChannelCreate!: ChannelCreate;
  public ChannelDelete!: ChannelDelete;
  public ChannelUpdate!: ChannelUpdate;
  public GuildAuditLogEntryCreate!: GuildAuditLogEntryCreate;
  public GuildBanAdd!: GuildBanAdd;
  public GuildBanRemove!: GuildBanRemove;
  public GuildChannelsPositionUpdate!: GuildChannelsPositionUpdate;
  public GuildDelete!: GuildDelete;
  public GuildEmojiCreate!: GuildEmojiCreate;
  public GuildEmojiDelete!: GuildEmojiDelete;
  public GuildEmojiUpdate!: GuildEmojiUpdate;
  public GuildEmojisUpdate!: GuildEmojisUpdate;
  public GuildIntegrationsUpdate!: GuildIntegrationsUpdate;
  public GuildMemberRemove!: GuildMemberRemove;
  public GuildMemberUpdate!: GuildMemberUpdate;
  public GuildRoleCreate!: GuildRoleCreate;
  public GuildRoleDelete!: GuildRoleDelete;
  public GuildRoleUpdate!: GuildRoleUpdate;
  public GuildRolesPositionUpdate!: GuildRolesPositionUpdate;
  public GuildScheduledEventCreate!: GuildScheduledEventCreate;
  public GuildScheduledEventDelete!: GuildScheduledEventDelete;
  public GuildScheduledEventUpdate!: GuildScheduledEventUpdate;
  public GuildScheduledEventUserAdd!: GuildScheduledEventUserAdd;
  public GuildScheduledEventUserRemove!: GuildScheduledEventUserRemove;
  public GuildStickerCreate!: GuildStickerCreate;
  public GuildStickerDelete!: GuildStickerDelete;
  public GuildStickerUpdate!: GuildStickerUpdate;
  public GuildStickersUpdate!: GuildStickersUpdate;
  public GuildUpdate!: GuildUpdate;
  public InviteCreate!: InviteCreate;
  public InviteDelete!: InviteDelete;
  public MessageCreate!: MessageCreate;
  public MessageDelete!: MessageDelete;
  public MessageDeleteBulk!: MessageDeleteBulk;
  public MessagePollVoteAdd!: MessagePollVoteAdd;
  public MessagePollVoteRemove!: MessagePollVoteRemove;
  public MessageReactionAdd!: MessageReactionAdd;
  public MessageReactionRemove!: MessageReactionRemove;
  public MessageReactionRemoveAll!: MessageReactionRemoveAll;
  public MessageReactionRemoveEmoji!: MessageReactionRemoveEmoji;
  public MessageUpdate!: MessageUpdate;
  public PresenceUpdate!: PresenceUpdate;
  public StageInstanceCreate!: StageInstanceCreate;
  public StageInstanceDelete!: StageInstanceDelete;
  public StageInstanceUpdate!: StageInstanceUpdate;
  public ThreadCreate!: ThreadCreate;
  public ThreadDelete!: ThreadDelete;
  public ThreadListSync!: ThreadListSync;
  public ThreadMemberUpdate!: ThreadMemberUpdate;
  public ThreadMembersUpdate!: ThreadMembersUpdate;
  public TypingStart!: TypingStart;
  public UserUpdate!: UserUpdate;
  public VoiceStateUpdate!: VoiceStateUpdate;
  public WebhooksUpdate!: WebhooksUpdate;

  [key: string]: unknown;

  public constructor(client: Client) {
    this.client = client;

    // These symbols represent fully built data that we inject at times when calling actions manually.
    // Action#getUser for example, will return the injected data (which is assumed to be a built structure)
    // instead of trying to make it from provided data
    this.injectedUser = Symbol('djs.actions.injectedUser');
    this.injectedChannel = Symbol('djs.actions.injectedChannel');
    this.injectedMessage = Symbol('djs.actions.injectedMessage');

    this.register(ApplicationCommandPermissionsUpdate);
    this.register(AutoModerationActionExecution);
    this.register(AutoModerationRuleCreate);
    this.register(AutoModerationRuleDelete);
    this.register(AutoModerationRuleUpdate);
    this.register(ChannelCreate);
    this.register(ChannelDelete);
    this.register(ChannelUpdate);
    this.register(GuildAuditLogEntryCreate);
    this.register(GuildBanAdd);
    this.register(GuildBanRemove);
    this.register(GuildChannelsPositionUpdate);
    this.register(GuildDelete);
    this.register(GuildEmojiCreate);
    this.register(GuildEmojiDelete);
    this.register(GuildEmojiUpdate);
    this.register(GuildEmojisUpdate);
    this.register(GuildIntegrationsUpdate);
    this.register(GuildMemberRemove);
    this.register(GuildMemberUpdate);
    this.register(GuildRoleCreate);
    this.register(GuildRoleDelete);
    this.register(GuildRoleUpdate);
    this.register(GuildRolesPositionUpdate);
    this.register(GuildScheduledEventCreate);
    this.register(GuildScheduledEventDelete);
    this.register(GuildScheduledEventUpdate);
    this.register(GuildScheduledEventUserAdd);
    this.register(GuildScheduledEventUserRemove);
    this.register(GuildStickerCreate);
    this.register(GuildStickerDelete);
    this.register(GuildStickerUpdate);
    this.register(GuildStickersUpdate);
    this.register(GuildUpdate);
    this.register(InviteCreate);
    this.register(InviteDelete);
    this.register(MessageCreate);
    this.register(MessageDelete);
    this.register(MessageDeleteBulk);
    this.register(MessagePollVoteAdd);
    this.register(MessagePollVoteRemove);
    this.register(MessageReactionAdd);
    this.register(MessageReactionRemove);
    this.register(MessageReactionRemoveAll);
    this.register(MessageReactionRemoveEmoji);
    this.register(MessageUpdate);
    this.register(PresenceUpdate);
    this.register(StageInstanceCreate);
    this.register(StageInstanceDelete);
    this.register(StageInstanceUpdate);
    this.register(ThreadCreate);
    this.register(ThreadDelete);
    this.register(ThreadListSync);
    this.register(ThreadMemberUpdate);
    this.register(ThreadMembersUpdate);
    this.register(TypingStart);
    this.register(UserUpdate);
    this.register(VoiceStateUpdate);
    this.register(WebhooksUpdate);
  }

  public register<T extends Action>(ActionClass: ActionConstructor<T>): void {
    const key = ActionClass.name.replace(/Action$/, '');
    this[key] = new ActionClass(this.client);
  }
}

export default ActionsManager;
