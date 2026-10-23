import Util from '../util/Util.js';

export interface RawVoiceRegionData {
  id: string;
  name: string;
  vip?: boolean;
  deprecated: boolean;
  optimal: boolean;
  custom: boolean;
}

/**
 * Represents a Discord voice region for guilds.
 */
export class VoiceRegion {
  /**
   * The region's id
   */
  public id: string;

  /**
   * Name of the region
   */
  public name: string;

  /**
   * Whether the region is VIP-only
   * @deprecated This property is no longer being sent by the API.
   */
  public vip?: boolean;

  /**
   * Whether the region is deprecated
   */
  public deprecated: boolean;

  /**
   * Whether the region is optimal
   */
  public optimal: boolean;

  /**
   * Whether the region is custom
   */
  public custom: boolean;

  public constructor(data: RawVoiceRegionData) {
    this.id = data.id;
    this.name = data.name;
    this.vip = data.vip;
    this.deprecated = data.deprecated;
    this.optimal = data.optimal;
    this.custom = data.custom;
  }

  public toJSON(): Record<string, unknown> {
    return Util.flatten(this) as Record<string, unknown>;
  }
}

export default VoiceRegion;
