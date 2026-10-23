export enum WireType {
  VARINT = 0,
  FIXED64 = 1,
  LENGTH_DELIMITED = 2,
  START_GROUP = 3,
  END_GROUP = 4,
  FIXED32 = 5,
}

export interface ProtobufField {
  tag: number;
  wireType: WireType;
  rawValue: bigint | number | Buffer;
  subfields?: ProtobufField[];
}

/**
 * Lightweight native Protobuf Wire Reader without external dependencies.
 */
export class ProtobufReader {
  private buffer: Buffer;
  private offset: number = 0;

  constructor(data: Buffer | Uint8Array | string) {
    if (typeof data === 'string') {
      this.buffer = Buffer.from(data, 'base64');
    } else if (Buffer.isBuffer(data)) {
      this.buffer = data;
    } else {
      this.buffer = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
    }
  }

  public hasMore(): boolean {
    return this.offset < this.buffer.length;
  }

  public readVarint(): bigint {
    let result = 0n;
    let shift = 0n;
    while (this.offset < this.buffer.length) {
      const byte = BigInt(this.buffer[this.offset++]);
      result |= (byte & 0x7fn) << shift;
      if ((byte & 0x80n) === 0n) {
        return result;
      }
      shift += 7n;
    }
    return result;
  }

  public readBytes(len: number): Buffer {
    if (this.offset + len > this.buffer.length) {
      len = this.buffer.length - this.offset;
    }
    const chunk = this.buffer.subarray(this.offset, this.offset + len);
    this.offset += len;
    return Buffer.from(chunk);
  }

  public readFixed32(): number {
    const val = this.buffer.readUInt32LE(this.offset);
    this.offset += 4;
    return val;
  }

  public readFixed64(): bigint {
    const val = this.buffer.readBigUInt64LE(this.offset);
    this.offset += 8;
    return val;
  }

  public parseFields(): ProtobufField[] {
    const fields: ProtobufField[] = [];
    while (this.hasMore()) {
      const key = this.readVarint();
      const tag = Number(key >> 3n);
      const wireType = Number(key & 0x07n) as WireType;

      if (wireType === WireType.VARINT) {
        const val = this.readVarint();
        fields.push({ tag, wireType, rawValue: val });
      } else if (wireType === WireType.FIXED64) {
        const val = this.readFixed64();
        fields.push({ tag, wireType, rawValue: val });
      } else if (wireType === WireType.LENGTH_DELIMITED) {
        const len = Number(this.readVarint());
        const bytes = this.readBytes(len);

        // Try decoding as submessage
        let subfields: ProtobufField[] | undefined;
        try {
          const subReader = new ProtobufReader(bytes);
          const parsed = subReader.parseFields();
          if (parsed.length > 0) {
            subfields = parsed;
          }
        } catch {
          // Keep as raw buffer if not submessage
        }

        fields.push({ tag, wireType, rawValue: bytes, subfields });
      } else if (wireType === WireType.FIXED32) {
        const val = this.readFixed32();
        fields.push({ tag, wireType, rawValue: val });
      } else {
        break; // Unsupported wire type or corrupt stream
      }
    }
    return fields;
  }
}

/**
 * Lightweight native Protobuf Wire Writer without external dependencies.
 */
export class ProtobufWriter {
  private chunks: Buffer[] = [];

  public writeVarint(val: bigint | number): this {
    let big = BigInt(val);
    const bytes: number[] = [];
    while (big >= 0x80n) {
      bytes.push(Number((big & 0x7fn) | 0x80n));
      big >>= 7n;
    }
    bytes.push(Number(big & 0x7fn));
    this.chunks.push(Buffer.from(bytes));
    return this;
  }

  public writeTag(tag: number, wireType: WireType): this {
    const key = BigInt((tag << 3) | wireType);
    return this.writeVarint(key);
  }

  public writeVarintField(tag: number, val: bigint | number | boolean): this {
    this.writeTag(tag, WireType.VARINT);
    return this.writeVarint(typeof val === 'boolean' ? (val ? 1 : 0) : val);
  }

  public writeString(tag: number, str: string): this {
    const buf = Buffer.from(str, 'utf8');
    this.writeTag(tag, WireType.LENGTH_DELIMITED);
    this.writeVarint(buf.length);
    this.chunks.push(buf);
    return this;
  }

  public writeBytes(tag: number, buf: Buffer | Uint8Array): this {
    const data = Buffer.isBuffer(buf) ? buf : Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength);
    this.writeTag(tag, WireType.LENGTH_DELIMITED);
    this.writeVarint(data.length);
    this.chunks.push(data);
    return this;
  }

  public writeSubmessage(tag: number, subWriter: ProtobufWriter): this {
    const data = subWriter.toBuffer();
    this.writeTag(tag, WireType.LENGTH_DELIMITED);
    this.writeVarint(data.length);
    this.chunks.push(data);
    return this;
  }

  public toBuffer(): Buffer {
    return Buffer.concat(this.chunks);
  }

  public toBase64(): string {
    return this.toBuffer().toString('base64');
  }
}
