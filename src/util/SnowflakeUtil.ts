import type { Snowflake, DeconstructedSnowflake } from '../types/index.js';

// Discord epoch (2015-01-01T00:00:00.000Z)
const EPOCH = 1_420_070_400_000;
let INCREMENT = 0n;

/**
 * A container for useful snowflake-related methods.
 */
export class SnowflakeUtil {
  private constructor() {}

  /**
   * Generates a Discord snowflake.
   * <info>This hardcodes the worker's id as 1 and the process's id as 0.</info>
   * @param timestamp Timestamp or date of the snowflake to generate
   * @returns The generated snowflake
   */
  public static generate(timestamp: number | Date = Date.now()): Snowflake {
    const ts = timestamp instanceof Date ? timestamp.getTime() : timestamp;
    if (typeof ts !== 'number' || Number.isNaN(ts)) {
      throw new TypeError(
        `"timestamp" argument must be a number (received ${Number.isNaN(ts) ? 'NaN' : typeof ts})`,
      );
    }
    if (INCREMENT >= 4095n) INCREMENT = 0n;

    // Assign WorkerId as 1 and ProcessId as 0:
    return ((BigInt(ts - EPOCH) << 22n) | (1n << 17n) | INCREMENT++).toString() as Snowflake;
  }

  /**
   * Deconstructs a Discord snowflake.
   * @param snowflake Snowflake to deconstruct
   * @returns The deconstructed snowflake object
   */
  public static deconstruct(snowflake: Snowflake): DeconstructedSnowflake {
    const bigIntSnowflake = BigInt(snowflake);
    const timestamp = Number(bigIntSnowflake >> 22n) + EPOCH;
    return {
      timestamp,
      get date(): Date {
        return new Date(timestamp);
      },
      workerId: Number((bigIntSnowflake >> 17n) & 0b11111n),
      processId: Number((bigIntSnowflake >> 12n) & 0b11111n),
      increment: Number(bigIntSnowflake & 0b111111111111n),
      binary: bigIntSnowflake.toString(2).padStart(64, '0'),
    };
  }

  /**
   * Retrieves the timestamp field's value from a Discord snowflake.
   * @param snowflake Snowflake to get the timestamp value from
   * @returns Milliseconds since UNIX epoch
   */
  public static timestampFrom(snowflake: Snowflake): number {
    return Number(BigInt(snowflake) >> 22n) + EPOCH;
  }

  /**
   * Discord's epoch value (2015-01-01T00:00:00.000Z).
   */
  public static get EPOCH(): number {
    return EPOCH;
  }
}

export default SnowflakeUtil;
