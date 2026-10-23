import Base from './Base.js';
import SnowflakeUtil from '../util/SnowflakeUtil.js';
import type { Snowflake } from '../types/index.js';
import type { Client } from '../client/Client.js';
import type { Guild } from './Guild.js';

export interface BaseGuildData {
  id: Snowflake;
  name: string;
  icon?: string | null;
  features?: string[];
  [key: string]: unknown;
}

export abstract class BaseGuild extends Base {
  public name!: string;
  public icon: string | null = null;
  public features: string[] = [];

  public constructor(client: Client, data: BaseGuildData) {
    super(client);
    this.id = data.id;
    this.name = data.name;
    this.icon = data.icon ?? null;
    this.features = data.features ?? [];
  }

  public get createdTimestamp(): number {
    return SnowflakeUtil.timestampFrom(this.id);
  }

  public get createdAt(): Date {
    return new Date(this.createdTimestamp);
  }

  public get nameAcronym(): string {
    return this.name
      .replace(/'s /g, ' ')
      .replace(/\w+/g, e => e[0] ?? '')
      .replace(/\s/g, '');
  }

  public get partnered(): boolean {
    return this.features.includes('PARTNERED');
  }

  public get verified(): boolean {
    return this.features.includes('VERIFIED');
  }

  public iconURL({ format, size, dynamic }: { format?: string; size?: number; dynamic?: boolean } = {}): string | null {
    if (!this.icon) return null;
    return (this.client.rest as unknown as { cdn: { Icon(id: Snowflake, icon: string, format?: string, size?: number, dynamic?: boolean): string } }).cdn.Icon(
      this.id,
      this.icon,
      format,
      size,
      dynamic,
    );
  }

  public async fetch(): Promise<Guild> {
    const data = await (this.client as unknown as { api: { guilds(id: Snowflake): { get(opts: unknown): Promise<unknown> } } })
      .api.guilds(this.id)
      .get({ query: { with_counts: true } });
    return (this.client.guilds as unknown as { _add(data: unknown): Guild })._add(data);
  }

  public override toString(): string {
    return this.name;
  }
}

export default BaseGuild;
