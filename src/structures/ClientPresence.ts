import { Presence, type RawPresenceData, type RawActivityData, type PresenceStatus, type Activity } from './Presence.js';
import { TypeError } from '../errors/index.js';
import { ActivityTypes, Opcodes } from '../util/Constants.js';
import type { Client } from '../client/Client.js';

const CustomStatusActivityTypes = [
  ActivityTypes.CUSTOM,
  (ActivityTypes as unknown as Record<number, string>)[ActivityTypes.CUSTOM as number],
];

export interface PresenceData {
  status?: PresenceStatus;
  since?: number | null;
  afk?: boolean;
  activities?: (RawActivityData | Activity | Record<string, unknown>)[];
  shardId?: number | number[];
}

export interface APIPresence {
  activities: (RawActivityData | Activity | Record<string, unknown>)[];
  afk: boolean;
  since: number;
  status: PresenceStatus;
}

/**
 * Represents the client's presence.
 * @extends {Presence}
 */
export class ClientPresence extends Presence {
  public constructor(client: Client, data: RawPresenceData = {}) {
    super(client, Object.assign(data, { status: data.status ?? 'online', user: { id: null } }));
  }

  /**
   * Sets the client's presence
   * @param presence The data to set the presence to
   */
  public set(presence: PresenceData): this {
    const packet = this._parse(presence);
    this._patch(packet as unknown as RawPresenceData);
    packet.activities = this.activities.map(a => a.toJSON());
    (this.client as unknown as { ws: { broadcast: (data: { op: number; d: APIPresence }) => void } }).ws.broadcast({
      op: Opcodes.STATUS_UPDATE,
      d: packet,
    });
    return this;
  }

  /**
   * Parses presence data into a packet ready to be sent to Discord
   * @param presence The data to parse
   * @private
   */
  public _parse({ status, since, afk, activities }: PresenceData): APIPresence {
    const data: APIPresence = {
      activities: [],
      afk: typeof afk === 'boolean' ? afk : this.afk,
      since: typeof since === 'number' && !Number.isNaN(since) ? this.since : 0,
      status: status ?? this.status,
    };

    if (activities?.length) {
      for (const [i, act] of activities.entries()) {
        const activity = act as RawActivityData;
        if (typeof activity.name !== 'string') {
          throw new TypeError('INVALID_TYPE', `activities[${i}].name`, 'string');
        }

        activity.type ??= ActivityTypes.PLAYING;
        if (typeof activity.type === 'string') {
          activity.type = (ActivityTypes as unknown as Record<string, number>)[activity.type];
        }

        if (CustomStatusActivityTypes.includes(activity.type as number) && !activity.state) {
          activity.state = activity.name;
          activity.name = 'Custom Status';
        }

        data.activities.push(activity);
      }
    } else if (!activities && (status || afk || since) && this.activities.length) {
      data.activities.push(
        ...this.activities.map(a => {
          if (typeof a.type === 'string') {
            (a as { type: number | string }).type = (ActivityTypes as unknown as Record<string, number>)[a.type];
          }
          return a;
        }),
      );
    }

    return data;
  }
}

export default ClientPresence;
