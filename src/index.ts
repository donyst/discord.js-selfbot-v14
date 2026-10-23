import './structures/ComponentFactory.js';
import './structures/ChannelFactory.js';

// Builders & Formatters from @discordjs/builders (v14 parity)
export {
  ActionRowBuilder,
  ButtonBuilder,
  ChannelSelectMenuBuilder,
  ContextMenuCommandBuilder,
  EmbedBuilder,
  MentionableSelectMenuBuilder,
  ModalBuilder,
  RoleSelectMenuBuilder,
  SelectMenuBuilder,
  SelectMenuOptionBuilder,
  SlashCommandAttachmentOption,
  SlashCommandBooleanOption,
  SlashCommandBuilder,
  SlashCommandChannelOption,
  SlashCommandIntegerOption,
  SlashCommandMentionableOption,
  SlashCommandNumberOption,
  SlashCommandRoleOption,
  SlashCommandStringOption,
  SlashCommandSubcommandBuilder,
  SlashCommandSubcommandGroupBuilder,
  SlashCommandUserOption,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  UserSelectMenuBuilder,
  blockQuote,
  bold,
  channelLink,
  channelMention,
  chatInputApplicationCommandMention,
  codeBlock,
  formatEmoji,
  heading,
  HeadingLevel,
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
  underscore,
  userMention,
  Faces,
} from '@discordjs/builders';

// "Root" classes (starting points)
export { default as BaseClient } from './client/BaseClient.js';
export { Client } from './client/Client.js';
/** @deprecated This will be removed in the next major version */
export { default as Shard } from './sharding/Shard.js';
/** @deprecated This will be removed in the next major version */
export { default as ShardClientUtil } from './sharding/ShardClientUtil.js';
/** @deprecated This will be removed in the next major version */
export { default as ShardingManager } from './sharding/ShardingManager.js';
export { default as WebhookClient } from './client/WebhookClient.js';

// Utilities & BitFields
export { default as ActivityFlags } from './util/ActivityFlags.js';
export { default as ApplicationFlags } from './util/ApplicationFlags.js';
export { default as AttachmentFlags } from './util/AttachmentFlags.js';
export { default as BaseManager } from './managers/BaseManager.js';
export { default as BitField } from './util/BitField.js';
export { Collection } from '@discordjs/collection';
export * as Constants from './util/Constants.js';
export {
  ChannelType,
  GatewayIntentBits,
  PermissionFlagsBits,
  ActivityType,
  ComponentType,
  ButtonStyle,
  TextInputStyle,
  FormattingPatterns,
  Partials,
  Events,
} from './util/Constants.js';
export { default as DataResolver } from './util/DataResolver.js';
export { default as DiscordAPIError } from './rest/DiscordAPIError.js';
export * as Formatters from './util/Formatters.js';
export { default as GuildMemberFlags } from './util/GuildMemberFlags.js';
export { default as HTTPError } from './rest/HTTPError.js';
export {
  IntentsBitField,
  Intents,
} from './util/Intents.js';
export { default as LimitedCollection } from './util/LimitedCollection.js';
export {
  MessageFlagsBitField,
  MessageFlags,
} from './util/MessageFlags.js';
export { default as Options } from './util/Options.js';
export {
  PermissionsBitField,
  Permissions,
} from './util/Permissions.js';
export { default as RateLimitError } from './rest/RateLimitError.js';
export { default as RoleFlags } from './util/RoleFlags.js';
export { default as SnowflakeUtil } from './util/SnowflakeUtil.js';
export { default as Sweepers } from './util/Sweepers.js';
export { default as SystemChannelFlags } from './util/SystemChannelFlags.js';
export { default as ThreadMemberFlags } from './util/ThreadMemberFlags.js';
export { default as UserFlags } from './util/UserFlags.js';
export { default as Util } from './util/Util.js';
export const version: string = '14.27.0';

// Managers
export { default as ApplicationCommandManager } from './managers/ApplicationCommandManager.js';
export { default as ApplicationCommandPermissionsManager } from './managers/ApplicationCommandPermissionsManager.js';
export { default as AutoModerationRuleManager } from './managers/AutoModerationRuleManager.js';
export { default as BaseGuildEmojiManager } from './managers/BaseGuildEmojiManager.js';
export { default as CachedManager } from './managers/CachedManager.js';
export { default as ChannelManager } from './managers/ChannelManager.js';
export { default as ClientVoiceManager } from './client/voice/ClientVoiceManager.js';
export { default as DataManager } from './managers/DataManager.js';
export { default as GuildBanManager } from './managers/GuildBanManager.js';
export { default as GuildChannelManager } from './managers/GuildChannelManager.js';
export { default as GuildEmojiManager } from './managers/GuildEmojiManager.js';
export { default as GuildEmojiRoleManager } from './managers/GuildEmojiRoleManager.js';
export { default as GuildInviteManager } from './managers/GuildInviteManager.js';
export { default as GuildManager } from './managers/GuildManager.js';
export { default as GuildMemberManager } from './managers/GuildMemberManager.js';
export { default as GuildMemberRoleManager } from './managers/GuildMemberRoleManager.js';
export { default as GuildScheduledEventManager } from './managers/GuildScheduledEventManager.js';
export { default as GuildStickerManager } from './managers/GuildStickerManager.js';
export { default as MessageManager } from './managers/MessageManager.js';
export { default as PermissionOverwriteManager } from './managers/PermissionOverwriteManager.js';
export { default as PresenceManager } from './managers/PresenceManager.js';
export { default as ReactionManager } from './managers/ReactionManager.js';
export { default as ReactionUserManager } from './managers/ReactionUserManager.js';
export { default as RoleManager } from './managers/RoleManager.js';
export { default as SessionManager } from './managers/SessionManager.js';
export { default as StageInstanceManager } from './managers/StageInstanceManager.js';
export { default as ThreadManager } from './managers/ThreadManager.js';
export { default as ThreadMemberManager } from './managers/ThreadMemberManager.js';
export { default as UserManager } from './managers/UserManager.js';
export { default as VoiceStateManager } from './managers/VoiceStateManager.js';
export { default as WebSocketManager } from './client/websocket/WebSocketManager.js';
export { default as WebSocketShard } from './client/websocket/WebSocketShard.js';
export { default as RelationshipManager } from './managers/RelationshipManager.js';
export { default as UserNoteManager } from './managers/UserNoteManager.js';

// Structures
export {
  Activity,
  Presence,
  RichPresenceAssets,
  CustomStatus,
  RichPresence,
  SpotifyRPC,
} from './structures/Presence.js';
export { default as AnonymousGuild } from './structures/AnonymousGuild.js';
export { default as Application } from './structures/interfaces/Application.js';
export { default as ApplicationCommand } from './structures/ApplicationCommand.js';
export {
  default as ApplicationRoleConnectionMetadata,
  ApplicationRoleConnectionMetadata as ApplicationRoleConnectionMetadataClass,
} from './structures/ApplicationRoleConnectionMetadata.js';
export { default as AutoModerationActionExecution } from './structures/AutoModerationActionExecution.js';
export { default as AutoModerationRule } from './structures/AutoModerationRule.js';
export { default as Base } from './structures/Base.js';
export { default as BaseGuild } from './structures/BaseGuild.js';
export { default as BaseGuildEmoji } from './structures/BaseGuildEmoji.js';
export { default as BaseGuildTextChannel } from './structures/BaseGuildTextChannel.js';
export { default as BaseGuildVoiceChannel } from './structures/BaseGuildVoiceChannel.js';
export { default as CategoryChannel } from './structures/CategoryChannel.js';
export { Channel } from './structures/Channel.js';
export { default as ClientPresence } from './structures/ClientPresence.js';
export { default as ClientUser } from './structures/ClientUser.js';
export { default as Collector } from './structures/interfaces/Collector.js';
export { default as DirectoryChannel } from './structures/DirectoryChannel.js';
export { default as DMChannel } from './structures/DMChannel.js';
export { Emoji } from './structures/Emoji.js';
export { default as ForumChannel } from './structures/ForumChannel.js';
export { Guild } from './structures/Guild.js';
export {
  GuildAuditLogs,
  GuildAuditLogsEntry,
  GuildAuditLogsEntry as Entry,
} from './structures/GuildAuditLogs.js';
export { default as GuildBan } from './structures/GuildBan.js';
export { default as GuildChannel } from './structures/GuildChannel.js';
export { default as GuildEmoji } from './structures/GuildEmoji.js';
export { GuildMember } from './structures/GuildMember.js';
export { default as GuildPreview } from './structures/GuildPreview.js';
export { default as GuildPreviewEmoji } from './structures/GuildPreviewEmoji.js';
export { GuildScheduledEvent } from './structures/GuildScheduledEvent.js';
export { default as GuildTemplate } from './structures/GuildTemplate.js';
export { default as Integration } from './structures/Integration.js';
export { default as IntegrationApplication } from './structures/IntegrationApplication.js';
export { default as Invite } from './structures/Invite.js';
export { default as InviteStageInstance } from './structures/InviteStageInstance.js';
export { default as InviteGuild } from './structures/InviteGuild.js';
export { default as MediaChannel } from './structures/MediaChannel.js';
export { Message } from './structures/Message.js';
export { default as MessageActionRow } from './structures/MessageActionRow.js';
export {
  MessageAttachment,
  AttachmentBuilder,
} from './structures/MessageAttachment.js';
export { default as MessageButton } from './structures/MessageButton.js';
export { default as MessageCollector } from './structures/MessageCollector.js';
export { default as MessageEmbed } from './structures/MessageEmbed.js';
export { default as MessageMentions } from './structures/MessageMentions.js';
export { default as MessagePayload } from './structures/MessagePayload.js';
export { default as MessageReaction } from './structures/MessageReaction.js';
export { default as Modal } from './structures/Modal.js';
export { default as NewsChannel } from './structures/NewsChannel.js';
export { default as OAuth2Guild } from './structures/OAuth2Guild.js';
export { default as GroupDMChannel } from './structures/GroupDMChannel.js';
export { default as PermissionOverwrites } from './structures/PermissionOverwrites.js';
export { default as ReactionCollector } from './structures/ReactionCollector.js';
export { default as ReactionEmoji } from './structures/ReactionEmoji.js';
export { Role } from './structures/Role.js';
export { default as Session } from './structures/Session.js';
export { default as StageChannel } from './structures/StageChannel.js';
export { StageInstance } from './structures/StageInstance.js';
export { Sticker } from './structures/Sticker.js';
export { default as StickerPack } from './structures/StickerPack.js';
export { default as StoreChannel } from './structures/StoreChannel.js';
export { default as Team } from './structures/Team.js';
export { default as TeamMember } from './structures/TeamMember.js';
export { default as TextChannel } from './structures/TextChannel.js';
export { default as TextInputComponent } from './structures/TextInputComponent.js';
export { default as ThreadChannel } from './structures/ThreadChannel.js';
export { default as ThreadOnlyChannel } from './structures/ThreadOnlyChannel.js';
export { default as ThreadMember } from './structures/ThreadMember.js';
export { default as Typing } from './structures/Typing.js';
export { default as User } from './structures/User.js';
export { default as VoiceChannel } from './structures/VoiceChannel.js';
export { default as VoiceChannelEffect } from './structures/VoiceChannelEffect.js';
export { default as VoiceRegion } from './structures/VoiceRegion.js';
export { default as VoiceState } from './structures/VoiceState.js';
export { default as Webhook } from './structures/Webhook.js';
export { default as Widget } from './structures/Widget.js';
export { default as WidgetMember } from './structures/WidgetMember.js';
export { default as WelcomeChannel } from './structures/WelcomeChannel.js';
export { default as WelcomeScreen } from './structures/WelcomeScreen.js';

// Interactions
export { default as AutocompleteInteraction } from './structures/AutocompleteInteraction.js';
export { default as BaseCommandInteraction } from './structures/BaseCommandInteraction.js';
export { default as ButtonInteraction } from './structures/ButtonInteraction.js';
export { default as CommandInteraction } from './structures/CommandInteraction.js';
export { default as ContextMenuInteraction } from './structures/ContextMenuInteraction.js';
export { default as Interaction } from './structures/Interaction.js';
export { default as InteractionCollector } from './structures/InteractionCollector.js';
export { default as InteractionResponse } from './structures/InteractionResponse.js';
export { default as InteractionWebhook } from './structures/InteractionWebhook.js';
export { default as MessageComponentInteraction } from './structures/MessageComponentInteraction.js';
export { default as MessageContextMenuInteraction } from './structures/MessageContextMenuInteraction.js';
export { default as ModalSubmitInteraction } from './structures/ModalSubmitInteraction.js';
export { default as SelectMenuInteraction } from './structures/SelectMenuInteraction.js';
export { default as UserContextMenuInteraction } from './structures/UserContextMenuInteraction.js';

export { default as WebSocket } from './WebSocket.js';

export { default as WebEmbed } from './structures/WebEmbed.js';
export {
  default as DiscordAuthWebsocket,
  Event as RemoteAuthEvent,
  type UserRaw,
  type QRLoginOptions,
  type ClientFingerprintContext,
} from './util/RemoteAuth.js';
export { default as PurchasedFlags } from './util/PurchasedFlags.js';
export { Poll } from './structures/Poll.js';
export { PollAnswer } from './structures/PollAnswer.js';
export { default as Recorder } from './client/voice/receiver/Recorder.js';
export { default as VoiceConnection, StreamConnection, StreamConnectionReadonly } from './client/voice/VoiceConnection.js';
export { GoLiveStreamer, type GoLiveStreamOptions } from './client/voice/video/GoLiveStreamer.js';

// Reverse-Engineered Desktop Subsystems & Anti-Detection
export { ClientFingerprintManager, type FingerprintData, type ClientPlatformMode } from './util/ClientFingerprintManager.js';
export { ClientHeartbeatManager, type ClientHeartbeatSessionData } from './client/ClientHeartbeatManager.js';
export { DiscordIPCServer, IPCOpcodes, type DiscordIPCServerOptions, type ActivityPayload } from './client/DiscordIPCServer.js';
export { SoundboardManager, type SoundboardCreateData, type SoundboardPlayOptions } from './managers/SoundboardManager.js';
export { SoundboardSound, type SoundboardEditData, type RawSoundboardSoundData } from './structures/SoundboardSound.js';
export { GameDetectionManager, type DetectableApplication, type RunningGameInfo, type GameDetectionOptions } from './managers/GameDetectionManager.js';
export { DaveProtocolManager, DaveState, type DaveSessionInitOptions, type DaveStateUpdate } from './client/voice/dave/DaveProtocolManager.js';
export { ProtobufReader, ProtobufWriter, WireType, type ProtobufField } from './util/ProtobufWire.js';
export { UserSettingsProto, type PreloadedUserSettingsData, type AppearanceSettings, type CustomStatusSettings } from './util/UserSettingsProto.js';

export * from './types/index.js';
export * from './errors/index.js';
