import type { BitFieldResolvable } from '../types/index.js';

/**
 * Data structure that makes it easy to interact with a bitfield.
 */
export class BitField<T extends string = string, N extends number | bigint = number | bigint> {
  public static FLAGS: Record<string, bigint | number> = {};
  public static defaultBit: bigint | number = 0;

  public bitfield: N;

  /**
   * @param bits Bit(s) to read from
   */
  public constructor(bits?: BitFieldResolvable<T, N>) {
    const ctor = this.constructor as typeof BitField;
    this.bitfield = ctor.resolve<T, N>(bits ?? (ctor.defaultBit as N));
  }

  /**
   * Checks whether the bitfield has a bit, or any of multiple bits.
   * @param bit Bit(s) to check for
   */
  public any(bit: BitFieldResolvable<T, N>): boolean {
    const ctor = this.constructor as typeof BitField;
    const resolved = ctor.resolve<T, N>(bit);
    if (typeof this.bitfield === 'bigint' && typeof resolved === 'bigint') {
      return (this.bitfield & resolved) !== 0n;
    }
    return ((this.bitfield as number) & (resolved as number)) !== 0;
  }

  /**
   * Checks if this bitfield equals another
   * @param bit Bit(s) to check for
   */
  public equals(bit: BitFieldResolvable<T, N>): boolean {
    const ctor = this.constructor as typeof BitField;
    return this.bitfield === ctor.resolve<T, N>(bit);
  }

  /**
   * Checks whether the bitfield has a bit, or multiple bits.
   * @param bit Bit(s) to check for
   */
  public has(bit: BitFieldResolvable<T, N>): boolean {
    const ctor = this.constructor as typeof BitField;
    const resolved = ctor.resolve<T, N>(bit);
    if (typeof this.bitfield === 'bigint' && typeof resolved === 'bigint') {
      return (this.bitfield & resolved) === resolved;
    }
    return ((this.bitfield as number) & (resolved as number)) === resolved;
  }

  /**
   * Gets all given bits that are missing from the bitfield.
   * @param bits Bit(s) to check for
   */
  public missing(bits: BitFieldResolvable<T, N>): T[] {
    const ctor = this.constructor as typeof BitField;
    return new (ctor as new (b: BitFieldResolvable<T, N>) => BitField<T, N>)(bits)
      .remove(this as unknown as BitFieldResolvable<T, N>)
      .toArray();
  }

  /**
   * Freezes these bits, making them immutable.
   */
  public freeze(): Readonly<this> {
    return Object.freeze(this);
  }

  /**
   * Adds bits to these ones.
   * @param bits Bits to add
   */
  public add(...bits: BitFieldResolvable<T, N>[]): this {
    const ctor = this.constructor as typeof BitField;
    let total = ctor.defaultBit as N;

    for (const bit of bits) {
      const resolved = ctor.resolve<T, N>(bit);
      if (typeof total === 'bigint' && typeof resolved === 'bigint') {
        total = (total | resolved) as N;
      } else {
        total = ((total as number) | (resolved as number)) as N;
      }
    }

    if (Object.isFrozen(this)) {
      const combined =
        typeof this.bitfield === 'bigint' && typeof total === 'bigint'
          ? ((this.bitfield | total) as N)
          : (((this.bitfield as number) | (total as number)) as N);
      return new (ctor as unknown as new (b: N) => this)(combined);
    }

    if (typeof this.bitfield === 'bigint' && typeof total === 'bigint') {
      this.bitfield = (this.bitfield | total) as N;
    } else {
      this.bitfield = ((this.bitfield as number) | (total as number)) as N;
    }
    return this;
  }

  /**
   * Removes bits from these.
   * @param bits Bits to remove
   */
  public remove(...bits: BitFieldResolvable<T, N>[]): this {
    const ctor = this.constructor as typeof BitField;
    let total = ctor.defaultBit as N;

    for (const bit of bits) {
      const resolved = ctor.resolve<T, N>(bit);
      if (typeof total === 'bigint' && typeof resolved === 'bigint') {
        total = (total | resolved) as N;
      } else {
        total = ((total as number) | (resolved as number)) as N;
      }
    }

    if (Object.isFrozen(this)) {
      const remaining =
        typeof this.bitfield === 'bigint' && typeof total === 'bigint'
          ? ((this.bitfield & ~total) as N)
          : (((this.bitfield as number) & ~(total as number)) as N);
      return new (ctor as unknown as new (b: N) => this)(remaining);
    }

    if (typeof this.bitfield === 'bigint' && typeof total === 'bigint') {
      this.bitfield = (this.bitfield & ~total) as N;
    } else {
      this.bitfield = ((this.bitfield as number) & ~(total as number)) as N;
    }
    return this;
  }

  /**
   * Gets an object mapping field names to a boolean indicating whether the bit is available.
   */
  public serialize(): Record<T, boolean> {
    const ctor = this.constructor as typeof BitField;
    const serialized = {} as Record<T, boolean>;
    for (const [flag, bit] of Object.entries(ctor.FLAGS)) {
      serialized[flag as T] = this.has(bit as BitFieldResolvable<T, N>);
    }
    return serialized;
  }

  /**
   * Gets an Array of bitfield names based on the bits available.
   */
  public toArray(): T[] {
    const ctor = this.constructor as typeof BitField;
    return (Object.keys(ctor.FLAGS) as T[]).filter(bit =>
      this.has(ctor.FLAGS[bit] as BitFieldResolvable<T, N>),
    );
  }

  public toJSON(): N extends bigint ? string : number {
    return (typeof this.bitfield === 'number'
      ? this.bitfield
      : this.bitfield.toString()) as N extends bigint ? string : number;
  }

  public valueOf(): N {
    return this.bitfield;
  }

  public *[Symbol.iterator](): Generator<T, void, undefined> {
    yield* this.toArray();
  }

  /**
   * Resolves bitfields to their numeric or bigint form.
   */
  public static resolve<T extends string = string, N extends number | bigint = number | bigint>(
    bit?: BitFieldResolvable<T, N>,
  ): N {
    const { defaultBit, FLAGS } = this;
    if (bit === undefined) return defaultBit as N;

    if (typeof defaultBit === typeof bit && (bit as N) >= (defaultBit as N)) {
      return bit as N;
    }

    if (bit instanceof BitField) {
      return bit.bitfield as N;
    }

    if (Array.isArray(bit)) {
      return bit.map(p => this.resolve<T, N>(p)).reduce((prev, p) => {
        if (typeof prev === 'bigint' && typeof p === 'bigint') {
          return (prev | p) as N;
        }
        return ((prev as number) | (p as number)) as N;
      }, defaultBit as N);
    }

    if (typeof bit === 'string') {
      if (!Number.isNaN(Number(bit))) {
        return (typeof defaultBit === 'bigint' ? BigInt(bit) : Number(bit)) as N;
      }
      if (FLAGS[bit] !== undefined) {
        return FLAGS[bit] as N;
      }
    }

    throw new RangeError(`[BITFIELD_INVALID]: Invalid bitfield flag or number: ${String(bit)}`);
  }
}

export default BitField;
