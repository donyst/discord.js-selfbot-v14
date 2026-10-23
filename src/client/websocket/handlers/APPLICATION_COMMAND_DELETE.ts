import type { Client } from '../../Client.js';
import type { GatewayPacket } from '../WebSocketManager.js';
import { Events } from '../../../util/Constants.js';
import type { ApplicationCommand } from '../../../structures/ApplicationCommand.js';

export default (client: Client, { d: data }: GatewayPacket): void => {
  const d = data as { id: string; guild_id?: string; application_id?: string; [key: string]: unknown };
  const commandManager = (d.guild_id ? client.guilds.cache.get(d.guild_id)?.commands : (client as unknown as { application: { id: string; commands: { _add(data: unknown, isOwn: boolean): ApplicationCommand; cache: Map<string, unknown> } } }).application?.commands) as { _add(data: unknown, isOwn: boolean): ApplicationCommand; cache: Map<string, unknown> } | undefined;
  if (!commandManager) return;

  const app = (client as unknown as { application: { id: string } }).application;
  const isOwn = d.application_id === app?.id;
  const command = commandManager._add(d, isOwn);
  if (isOwn) commandManager.cache.delete(d.id);

  client.emit(Events.APPLICATION_COMMAND_DELETE, command);
};
