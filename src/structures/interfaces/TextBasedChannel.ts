import { Collection } from '@discordjs/collection';
import { s } from '@sapphire/shapeshift';
import { DiscordjsError, DiscordjsTypeError } from '../../errors/index.js';
import { ApplicationCommandOptionTypes, Events, InteractionTypes } from '../../util/Constants.js';
import { SnowflakeUtil } from '../../util/SnowflakeUtil.js';
import { Util } from '../../util/Util.js';
import type { Snowflake } from '../../types/index.js';
import type { Client } from '../../client/Client.js';
import type { Guild } from '../Guild.js';
import MessagePayload from '../MessagePayload.js';
import MessageCollector from '../MessageCollector.js';

type MessageManagerCtor = new (channel: unknown) => unknown;
let messageManagerCtor: MessageManagerCtor | null = null;
export function registerMessageManager(ctor: MessageManagerCtor): void {
  messageManagerCtor = ctor;
}

const validateName = (stringName: string): string =>
  s
    .string()
    .lengthGreaterThanOrEqual(1)
    .lengthLessThanOrEqual(32)
    .regex(/^[\p{Ll}\p{Lm}\p{Lo}\p{N}\p{sc=Devanagari}\p{sc=Thai}_-]+$/u)
    .setValidationEnabled(true)
    .parse(stringName);

export interface PollAnswerData {
  text: string;
  emoji?: unknown;
}

export interface PollData {
  question: { text: string };
  answers: PollAnswerData[];
  duration: number;
  allowMultiselect: boolean;
  layoutType?: number;
}

export interface BaseMessageOptions {
  content?: string;
  tts?: boolean;
  nonce?: string;
  embeds?: unknown[];
  allowedMentions?: unknown;
  files?: unknown[];
  components?: unknown[];
  attachments?: unknown[];
  poll?: PollData;
  [key: string]: unknown;
}

export interface MessageOptions extends BaseMessageOptions {
  reply?: {
    messageReference: Snowflake | { id: Snowflake };
    failIfNotExists?: boolean;
  };
  stickers?: unknown[];
  flags?: unknown;
}

export interface MessageCollectorOptions {
  filter?: (message: unknown, collection: Collection<Snowflake, unknown>) => boolean | Promise<boolean>;
  time?: number;
  idle?: number;
  max?: number;
  maxProcessed?: number;
  dispose?: boolean;
}

export interface AwaitMessagesOptions extends MessageCollectorOptions {
  errors?: string[];
}

export interface ChannelWebhookCreateOptions {
  avatar?: unknown;
  reason?: string;
}

export interface InteractionPostPayload {
  type: number | string;
  application_id: Snowflake;
  guild_id?: Snowflake;
  channel_id: Snowflake;
  session_id: string;
  data: {
    version?: string;
    id?: Snowflake;
    name?: string;
    type?: number | string;
    options: unknown;
    attachments: unknown[];
    guild_id?: Snowflake;
  };
  nonce: Snowflake;
}

function parseChoices(parent: string, listChoices: { name: string; value: unknown }[] | undefined, value: unknown): unknown {
  if (value !== undefined) {
    if (Array.isArray(listChoices) && listChoices.length) {
      const choice = listChoices.find(c => [c.name, c.value].includes(value as string));
      if (choice) {
        return choice.value;
      }
      throw new DiscordjsError('INVALID_SLASH_COMMAND_CHOICES', parent, String(value));
    }
    return value;
  }
  return undefined;
}

async function addDataFromAttachment(
  value: unknown,
  client: unknown,
  channelId: Snowflake,
  attachments: { id: number; filename: string; uploaded_filename: string }[],
): Promise<{ id: number; attachments: { id: number; filename: string; uploaded_filename: string }[] }> {
  const resolved = (await MessagePayload.resolveFile(value)) as {
    file: BodyInit;
    name: string;
    description?: string;
    duration_secs?: number;
    waveform?: string;
  };

  if (!resolved?.file) {
    throw new DiscordjsTypeError(
      'REQ_RESOURCE_TYPE',
    );
  }

  const data = (await Util.getUploadURL(
    client as { api: { channels: Record<string, { attachments: { post: (opts: { data: { files: unknown[] } }) => Promise<{ attachments: { upload_url: string; upload_filename: string }[] }> } }> } },
    channelId,
    [resolved],
  )) as { upload_url: string; upload_filename: string }[];

  await Util.uploadFile(resolved.file, data[0]!.upload_url);
  const id = attachments.length;
  attachments.push({
    id,
    filename: resolved.name,
    uploaded_filename: data[0]!.upload_filename,
  });
  return {
    id,
    attachments,
  };
}

function awaitAutocomplete(
  client: {
    on: (event: string, handler: (data: unknown) => void) => void;
    removeListener: (event: string, handler: (data: unknown) => void) => void;
    incrementMaxListeners: () => void;
    decrementMaxListeners: () => void;
  },
  nonce: Snowflake,
  defaultValue: unknown,
): Promise<unknown> {
  return new Promise(resolve => {
    const handler = (dataRaw: unknown): void => {
      const data = dataRaw as { t: string; d?: { nonce?: string; choices: { value: unknown }[] } };
      if (data.t !== 'APPLICATION_COMMAND_AUTOCOMPLETE_RESPONSE') return;
      if (data.d?.nonce !== nonce) return;
      clearTimeout(timeout);
      client.removeListener(Events.UNHANDLED_PACKET, handler);
      client.decrementMaxListeners();
      if (data.d.choices.length >= 1) {
        resolve(data.d.choices[0]!.value);
      } else {
        resolve(defaultValue);
      }
    };
    const timeout = setTimeout(() => {
      client.removeListener(Events.UNHANDLED_PACKET, handler);
      client.decrementMaxListeners();
      resolve(defaultValue);
    }, 5_000).unref();
    client.incrementMaxListeners();
    client.on(Events.UNHANDLED_PACKET, handler);
  });
}

function createPostData(
  client: { sessionId: string },
  isAutocomplete = false,
  applicationId: Snowflake,
  nonce: Snowflake,
  guildId: Snowflake | undefined,
  isGuildCommand: boolean,
  channelId: Snowflake,
  commandVersion: string | undefined,
  commandId: Snowflake | undefined,
  commandName: string | undefined,
  commandType: number | undefined,
  postData: unknown,
  attachments: unknown[] = [],
): InteractionPostPayload {
  const data: InteractionPostPayload = {
    type: isAutocomplete ? InteractionTypes.APPLICATION_COMMAND_AUTOCOMPLETE : InteractionTypes.APPLICATION_COMMAND,
    application_id: applicationId,
    guild_id: guildId,
    channel_id: channelId,
    session_id: client.sessionId,
    data: {
      version: commandVersion,
      id: commandId,
      name: commandName,
      type: commandType,
      options: postData,
      attachments,
    },
    nonce,
  };
  if (isGuildCommand && guildId) {
    data.data.guild_id = guildId;
  }
  return data;
}

interface CommandOptionInfo {
  type: number | string;
  name: string;
  choices?: { name: string; value: unknown }[];
  autocomplete?: boolean;
}

async function parseOption(
  client: unknown,
  optionCommand: CommandOptionInfo,
  value: unknown,
  optionFormat: Record<string, unknown>[],
  attachments: { id: number; filename: string; uploaded_filename: string }[],
  command: { id?: Snowflake; version?: string; name?: string; name_default?: string; type?: number; guild_id?: Snowflake },
  applicationId: Snowflake,
  guildId: Snowflake | undefined,
  channelId: Snowflake,
  subGroup?: { name: string },
  subCommand?: { name: string },
): Promise<{ optionFormat: Record<string, unknown>[]; attachments: { id: number; filename: string; uploaded_filename: string }[] }> {
  const data: Record<string, unknown> = {
    type: optionCommand.type,
    name: optionCommand.name,
  };
  if (value !== undefined) {
    switch (optionCommand.type) {
      case ApplicationCommandOptionTypes.BOOLEAN:
      case 'BOOLEAN': {
        data.value = Boolean(value);
        break;
      }
      case ApplicationCommandOptionTypes.INTEGER:
      case 'INTEGER': {
        data.value = Number(value);
        break;
      }
      case ApplicationCommandOptionTypes.ATTACHMENT:
      case 'ATTACHMENT': {
        const parseData = await addDataFromAttachment(value, client, channelId, attachments);
        data.value = parseData.id;
        attachments = parseData.attachments;
        break;
      }
      case ApplicationCommandOptionTypes.SUB_COMMAND_GROUP:
      case 'SUB_COMMAND_GROUP': {
        break;
      }
      default: {
        const parsedVal = parseChoices(optionCommand.name, optionCommand.choices, value);
        if (optionCommand.autocomplete) {
          const nonce = SnowflakeUtil.generate();
          let postData: unknown[];
          if (subGroup && subCommand) {
            postData = [
              {
                type: ApplicationCommandOptionTypes.SUB_COMMAND_GROUP,
                name: subGroup.name,
                options: [
                  {
                    type: ApplicationCommandOptionTypes.SUB_COMMAND,
                    name: subCommand.name,
                    options: [
                      {
                        type: optionCommand.type,
                        name: optionCommand.name,
                        value: parsedVal,
                        focused: true,
                      },
                    ],
                  },
                ],
              },
            ];
          } else if (subCommand) {
            postData = [
              {
                type: ApplicationCommandOptionTypes.SUB_COMMAND,
                name: subCommand.name,
                options: [
                  {
                    type: optionCommand.type,
                    name: optionCommand.name,
                    value: parsedVal,
                    focused: true,
                  },
                ],
              },
            ];
          } else {
            postData = [
              {
                type: optionCommand.type,
                name: optionCommand.name,
                value: parsedVal,
                focused: true,
              },
            ];
          }
          const cli = client as {
            sessionId: string;
            api: { interactions: { post: (opts: { data: unknown }) => Promise<unknown> } };
            on: (event: string, handler: (data: unknown) => void) => void;
            removeListener: (event: string, handler: (data: unknown) => void) => void;
            incrementMaxListeners: () => void;
            decrementMaxListeners: () => void;
          };
          const body = createPostData(
            cli,
            true,
            applicationId,
            nonce,
            guildId,
            Boolean(command.guild_id),
            channelId,
            command.version,
            command.id,
            command.name_default || command.name,
            command.type,
            postData,
            [],
          );
          await cli.api.interactions.post({
            data: body,
          });
          data.value = await awaitAutocomplete(cli, nonce, parsedVal);
        } else {
          data.value = parsedVal;
        }
      }
    }
    optionFormat.push(data);
  }
  return {
    optionFormat,
    attachments,
  };
}

interface ITextBasedChannelContext {
  readonly client: Client;
  guild?: Guild | null;
  messages?: unknown;
  lastMessageId?: Snowflake | null;
  lastPinTimestamp?: number | null;
  id: Snowflake;
}

function self(target: unknown): ITextBasedChannelContext {
  return target as ITextBasedChannelContext;
}

/**
 * Interface for classes that have text-channel-like features.
 */
export class TextBasedChannel {
  public constructor() {
    if (messageManagerCtor) {
      self(this).messages = new messageManagerCtor(this);
    }
    self(this).lastMessageId = null;
    self(this).lastPinTimestamp = null;
  }

  public get lastMessage(): unknown | null {
    return (self(this).messages as { resolve: (id: unknown) => unknown } | undefined)?.resolve(self(this).lastMessageId) ?? null;
  }

  public get lastPinAt(): Date | null {
    return self(this).lastPinTimestamp ? new Date(self(this).lastPinTimestamp!) : null;
  }

  public async send(options: string | BaseMessageOptions): Promise<unknown> {
    if ('createDM' in this && typeof (this as { createDM?: unknown }).createDM === 'function') {
      const dm = await (this as unknown as { createDM: () => Promise<{ send: (opts: unknown) => Promise<unknown> }> }).createDM();
      return dm.send(options);
    }

    const messagePayload =
      typeof options === 'object' && options !== null && 'resolveData' in options
        ? (options as { resolveData: () => { resolveFiles: () => Promise<unknown> } }).resolveData()
        : MessagePayload.create(
            this as unknown as import('../MessagePayload.js').MessageTarget,
            options as unknown as import('../MessagePayload.js').BaseMessageOptions,
          ).resolveData();

    const { data, files } = (await messagePayload.resolveFiles()) as {
      data: Record<string, unknown>;
      files: { file: BodyInit; name: string; description?: string; duration_secs?: number; waveform?: string }[];
    };

    const attachments = (await Util.getUploadURL(
      self(this).client as unknown as { api: { channels: Record<string, { attachments: { post: (opts: { data: { files: unknown[] } }) => Promise<{ attachments: unknown[] }> } }> } },
      self(this).id,
      files,
    )) as { id: number; upload_url: string; upload_filename: string }[];

    const requestPromises = attachments.map(async attachment => {
      await Util.uploadFile(files[attachment.id]!.file, attachment.upload_url);
      return {
        id: attachment.id,
        filename: files[attachment.id]!.name,
        uploaded_filename: attachment.upload_filename,
        description: files[attachment.id]!.description,
        duration_secs: files[attachment.id]!.duration_secs,
        waveform: files[attachment.id]!.waveform,
      };
    });

    const attachmentsData = await Promise.all(requestPromises);
    attachmentsData.sort((a, b) => a.id - b.id);
    data.attachments = attachmentsData;

    const cli = self(this).client as unknown as {
      api: { channels: Record<string, { messages: { post: (opts: { data: unknown }) => Promise<{ id: Snowflake }> } }> };
    };
    const d = await cli.api.channels[self(this).id]!.messages.post({ data });

    const msgs = self(this).messages as unknown as {
      cache: { get: (id: string) => unknown };
      _add: (data: unknown) => unknown;
    };
    return msgs.cache.get(d.id) ?? msgs._add(d);
  }

  public searchInteractionFromGuildAndPrivateChannel(): Promise<{
    application_commands: { name: string; name_default?: string; application_id: Snowflake; options?: unknown[]; version?: string; id?: Snowflake; type?: number; guild_id?: Snowflake }[];
    applications: { id: Snowflake; bot_id?: Snowflake }[];
    version: string;
  }> {
    const cli = self(this).client as unknown as {
      api: Record<string, Record<string, { 'application-command-index': { get: () => Promise<{ application_commands: unknown[]; applications: unknown[]; version: string }> } }>>;
    };
    const target = self(this).guild ? 'guilds' : 'channels';
    const targetId = self(this).guild?.id || self(this).id;
    return (cli.api[target]![targetId]!['application-command-index'].get() as Promise<{
      application_commands: { name: string; name_default?: string; application_id: Snowflake; options?: unknown[]; version?: string; id?: Snowflake; type?: number; guild_id?: Snowflake }[];
      applications: { id: Snowflake; bot_id?: Snowflake }[];
      version: string;
    }>).catch(() => ({
      application_commands: [],
      applications: [],
      version: '',
    }));
  }

  public searchInteractionUserApps(): Promise<{
    application_commands: { name: string; name_default?: string; application_id: Snowflake; options?: unknown[]; version?: string; id?: Snowflake; type?: number; guild_id?: Snowflake }[];
    applications: { id: Snowflake; bot_id?: Snowflake }[];
    version: string;
  }> {
    const cli = self(this).client as unknown as {
      api: { users: { '@me': { 'application-command-index': { get: () => Promise<{ application_commands: unknown[]; applications: unknown[]; version: string }> } } } };
    };
    return (cli.api.users['@me']['application-command-index'].get() as Promise<{
      application_commands: { name: string; name_default?: string; application_id: Snowflake; options?: unknown[]; version?: string; id?: Snowflake; type?: number; guild_id?: Snowflake }[];
      applications: { id: Snowflake; bot_id?: Snowflake }[];
      version: string;
    }>).catch(() => ({
      application_commands: [],
      applications: [],
      version: '',
    }));
  }

  public async searchInteraction(): Promise<{
    applications: { id: Snowflake; bot_id?: Snowflake }[];
    application_commands: { name: string; name_default?: string; application_id: Snowflake; options?: unknown[]; version?: string; id?: Snowflake; type?: number; guild_id?: Snowflake }[];
  }> {
    const [dataA, dataB] = await Promise.all([
      this.searchInteractionFromGuildAndPrivateChannel(),
      this.searchInteractionUserApps(),
    ]);
    return {
      applications: [...dataA.applications, ...dataB.applications],
      application_commands: [...dataA.application_commands, ...dataB.application_commands],
    };
  }

  public async sendSlash(botOrApplicationId: Snowflake | { id: Snowflake }, commandNameString: string, ...args: unknown[]): Promise<unknown> {
    const cmd = commandNameString.trim().split(' ');
    const commandName = validateName(cmd[0]!);
    const sub = cmd.slice(1);
    for (let i = 0; i < sub.length; i++) {
      if (sub.length > 2) {
        throw new DiscordjsError('INVALID_COMMAND_NAME', cmd);
      }
      validateName(sub[i]!);
    }
    const data = await this.searchInteraction();
    const filterCommand = data.application_commands.filter(obj =>
      [obj.name, obj.name_default].includes(commandName),
    );
    const cliUsers = self(this).client as unknown as { users: { resolveId: (u: unknown) => Snowflake } };
    const resolvedBotId = cliUsers.users.resolveId(botOrApplicationId);
    const application = data.applications.find(obj => obj.id === resolvedBotId || obj.bot_id === resolvedBotId);
    if (!application) {
      throw new DiscordjsError('INVALID_APPLICATION_COMMAND', "Bot/Application doesn't exist");
    }
    const command = filterCommand.find(c => c.application_id === application.id);
    if (!command) {
      throw new DiscordjsError('INVALID_APPLICATION_COMMAND', application.id);
    }
    const flattenedArgs = args.flat(2);
    let optionFormat: Record<string, unknown>[] = [];
    let attachments: { id: number; filename: string; uploaded_filename: string }[] = [];
    let optionsMaxdepth: CommandOptionInfo[] | undefined;
    let subGroup: { name: string; options?: CommandOptionInfo[] } | undefined;
    let subCommand: { name: string; options?: CommandOptionInfo[] } | undefined;

    const commandOptions = command.options as ({ type: number | string; name: string; name_default?: string; options?: CommandOptionInfo[]; required?: boolean }[]) | undefined;

    if (sub.length === 2) {
      subGroup = commandOptions?.find(
        obj =>
          obj.type === ApplicationCommandOptionTypes.SUB_COMMAND_GROUP &&
          [obj.name, obj.name_default].includes(sub[0]!),
      ) as { name: string; options?: CommandOptionInfo[] } | undefined;
      if (!subGroup) throw new DiscordjsError('SLASH_COMMAND_SUB_COMMAND_GROUP_INVALID', sub[0]);
      subCommand = subGroup.options?.find(
        (obj: { type: number | string; name: string; name_default?: string }) =>
          obj.type === ApplicationCommandOptionTypes.SUB_COMMAND &&
          [obj.name, obj.name_default].includes(sub[1]!),
      ) as { name: string; options?: CommandOptionInfo[] } | undefined;
      if (!subCommand) throw new DiscordjsError('SLASH_COMMAND_SUB_COMMAND_INVALID', sub[1]);
      optionsMaxdepth = subCommand.options;
    } else if (sub.length === 1) {
      subCommand = commandOptions?.find(
        obj =>
          obj.type === ApplicationCommandOptionTypes.SUB_COMMAND &&
          [obj.name, obj.name_default].includes(sub[0]!),
      ) as { name: string; options?: CommandOptionInfo[] } | undefined;
      if (!subCommand) throw new DiscordjsError('SLASH_COMMAND_SUB_COMMAND_INVALID', sub[0]);
      optionsMaxdepth = subCommand.options;
    } else {
      optionsMaxdepth = commandOptions as CommandOptionInfo[] | undefined;
    }

    const valueRequired = (optionsMaxdepth as unknown as { required?: boolean }[])?.filter(o => o.required).length || 0;
    for (let i = 0; i < Math.min(flattenedArgs.length, optionsMaxdepth?.length || 0); i++) {
      const optionInput = optionsMaxdepth![i]!;
      const value = flattenedArgs[i];
      const parseData = await parseOption(
        self(this).client,
        optionInput,
        value,
        optionFormat,
        attachments,
        command,
        application.id,
        self(this).guild?.id,
        self(this).id,
        subGroup,
        subCommand,
      );
      optionFormat = parseData.optionFormat;
      attachments = parseData.attachments;
    }
    if (valueRequired > flattenedArgs.length) {
      throw new DiscordjsError('SLASH_COMMAND_REQUIRED_OPTIONS_MISSING', String(valueRequired), String(optionFormat.length));
    }

    let postData: unknown;
    if (subGroup && subCommand) {
      postData = [
        {
          type: ApplicationCommandOptionTypes.SUB_COMMAND_GROUP,
          name: subGroup.name,
          options: [
            {
              type: ApplicationCommandOptionTypes.SUB_COMMAND,
              name: subCommand.name,
              options: optionFormat,
            },
          ],
        },
      ];
    } else if (subCommand) {
      postData = [
        {
          type: ApplicationCommandOptionTypes.SUB_COMMAND,
          name: subCommand.name,
          options: optionFormat,
        },
      ];
    } else {
      postData = optionFormat;
    }

    const nonce = SnowflakeUtil.generate();
    const cli = self(this).client as unknown as {
      sessionId: string;
      api: { interactions: { post: (opts: { data: unknown; usePayloadJSON: boolean }) => Promise<unknown> } };
      on: (event: string, handler: (data: unknown) => void) => void;
      removeListener: (event: string, handler: (data: unknown) => void) => void;
      incrementMaxListeners: () => void;
      decrementMaxListeners: () => void;
    };
    const body = createPostData(
      cli,
      false,
      application.id,
      nonce,
      self(this).guild?.id,
      Boolean(command.guild_id),
      self(this).id,
      command.version,
      command.id,
      command.name_default || command.name,
      command.type,
      postData,
      attachments,
    );
    await cli.api.interactions.post({
      data: body,
      usePayloadJSON: true,
    });
    return Util.createPromiseInteraction(cli, nonce, 5000);
  }

  public sendTyping(): Promise<{ message_send_cooldown_ms: number; thread_create_cooldown_ms: number } | undefined> {
    const cli = self(this).client as unknown as {
      api: { channels: (id: Snowflake) => { typing: { post: () => Promise<{ message_send_cooldown_ms: number; thread_create_cooldown_ms: number } | undefined> } } };
    };
    return cli.api.channels(self(this).id).typing.post();
  }

  public createMessageCollector(options: MessageCollectorOptions = {}): unknown {
    return new MessageCollector(this as unknown as import('../../types/index.js').TextBasedChannels, options as unknown as import('../MessageCollector.js').MessageCollectorOptions);
  }

  public awaitMessages(options: AwaitMessagesOptions = {}): Promise<Collection<Snowflake, unknown>> {
    return new Promise((resolve, reject) => {
      const collector = this.createMessageCollector(options) as {
        once: (event: string, listener: (col: Collection<Snowflake, unknown>, reason: string) => void) => void;
      };
      collector.once('end', (collection: Collection<Snowflake, unknown>, reason: string) => {
        if (options.errors?.includes(reason)) {
          reject(collection);
        } else {
          resolve(collection);
        }
      });
    });
  }

  public fetchWebhooks(): Promise<unknown> {
    return self(this).guild!.channels.fetchWebhooks(self(this).id);
  }

  public createWebhook(name: string, options: import('../../managers/GuildChannelManager.js').ChannelWebhookCreateOptions = {}): Promise<unknown> {
    return self(this).guild!.channels.createWebhook(self(this).id, name, options);
  }

  public setRateLimitPerUser(rateLimitPerUser: number, reason?: string): Promise<this> {
    return (this as unknown as { edit: (data: { rateLimitPerUser: number }, reason?: string) => Promise<unknown> })
      .edit({ rateLimitPerUser }, reason) as Promise<this>;
  }

  public setNSFW(nsfw = true, reason?: string): Promise<this> {
    return (this as unknown as { edit: (data: { nsfw: boolean }, reason?: string) => Promise<unknown> })
      .edit({ nsfw }, reason) as Promise<this>;
  }

  public static applyToClass(structure: { prototype: unknown }, full = false, ignore: string[] = []): void {
    const props = ['send'];
    if (full) {
      props.push(
        'sendSlash',
        'searchInteraction',
        'searchInteractionFromGuildAndPrivateChannel',
        'searchInteractionUserApps',
        'lastMessage',
        'lastPinAt',
        'sendTyping',
        'createMessageCollector',
        'awaitMessages',
        'fetchWebhooks',
        'createWebhook',
        'setRateLimitPerUser',
        'setNSFW',
      );
    }
    for (const prop of props) {
      if (ignore.includes(prop)) continue;
      const desc = Object.getOwnPropertyDescriptor(TextBasedChannel.prototype, prop);
      if (desc) {
        Object.defineProperty(structure.prototype as object, prop, desc);
      }
    }
  }
}

export default TextBasedChannel;
