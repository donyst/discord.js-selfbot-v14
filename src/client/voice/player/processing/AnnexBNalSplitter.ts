import { Buffer } from 'node:buffer';
import { Transform, type TransformCallback } from 'node:stream';

export const H264NalUnitTypes = {
  Unspecified: 0,
  CodedSliceNonIDR: 1,
  CodedSlicePartitionA: 2,
  CodedSlicePartitionB: 3,
  CodedSlicePartitionC: 4,
  CodedSliceIdr: 5,
  SEI: 6,
  SPS: 7,
  PPS: 8,
  AccessUnitDelimiter: 9,
  EndOfSequence: 10,
  EndOfStream: 11,
  FillerData: 12,
  SEIExtenstion: 13,
  PrefixNalUnit: 14,
  SubsetSPS: 15,
} as const;

export const H265NalUnitTypes = {
  TRAIL_N: 0,
  TRAIL_R: 1,
  TSA_N: 2,
  TSA_R: 3,
  STSA_N: 4,
  STSA_R: 5,
  RADL_N: 6,
  RADL_R: 7,
  RASL_N: 8,
  RASL_R: 9,
  RSV_VCL_N10: 10,
  RSV_VCL_R11: 11,
  RSV_VCL_N12: 12,
  RSV_VCL_R13: 13,
  RSV_VCL_N14: 14,
  RSV_VCL_R15: 15,
  BLA_W_LP: 16,
  BLA_W_RADL: 17,
  BLA_N_LP: 18,
  IDR_W_RADL: 19,
  IDR_N_LP: 20,
  CRA_NUT: 21,
  RSV_IRAP_VCL22: 22,
  RSV_IRAP_VCL23: 23,
  RSV_VCL24: 24,
  RSV_VCL25: 25,
  RSV_VCL26: 26,
  RSV_VCL27: 27,
  RSV_VCL28: 28,
  RSV_VCL29: 29,
  RSV_VCL30: 30,
  RSV_VCL31: 31,
  VPS_NUT: 32,
  SPS_NUT: 33,
  PPS_NUT: 34,
  AUD_NUT: 35,
  EOS_NUT: 36,
  EOB_NUT: 37,
  FD_NUT: 38,
  PREFIX_SEI_NUT: 39,
  SUFFIX_SEI_NUT: 40,
  RSV_NVCL41: 41,
  RSV_NVCL42: 42,
  RSV_NVCL43: 43,
  RSV_NVCL44: 44,
  RSV_NVCL45: 45,
  RSV_NVCL46: 46,
  RSV_NVCL47: 47,
  UNSPEC48: 48,
  UNSPEC49: 49,
  UNSPEC50: 50,
  UNSPEC51: 51,
  UNSPEC52: 52,
  UNSPEC53: 53,
  UNSPEC54: 54,
  UNSPEC55: 55,
  UNSPEC56: 56,
  UNSPEC57: 57,
  UNSPEC58: 58,
  UNSPEC59: 59,
  UNSPEC60: 60,
  UNSPEC61: 61,
  UNSPEC62: 62,
  UNSPEC63: 63,
} as const;

export interface NalFunctions {
  getUnitType(frame: Buffer): number;
  splitHeader(frame: Buffer): [Buffer, Buffer];
  isAUD(unitType: number): boolean;
}

export const H264Helpers: NalFunctions = {
  getUnitType(frame: Buffer): number {
    return (frame[0] ?? 0) & 0x1f;
  },
  splitHeader(frame: Buffer): [Buffer, Buffer] {
    return [frame.subarray(0, 1), frame.subarray(1)];
  },
  isAUD(unitType: number): boolean {
    return unitType === H264NalUnitTypes.AccessUnitDelimiter;
  },
};

export const H265Helpers: NalFunctions = {
  getUnitType(frame: Buffer): number {
    return ((frame[0] ?? 0) >> 1) & 0x3f;
  },
  splitHeader(frame: Buffer): [Buffer, Buffer] {
    return [frame.subarray(0, 2), frame.subarray(2)];
  },
  isAUD(unitType: number): boolean {
    return unitType === H265NalUnitTypes.AUD_NUT;
  },
};

const emptyBuffer = Buffer.allocUnsafe(0);
const epbPrefix = Buffer.from([0x00, 0x00, 0x03]);
const nalSuffix = Buffer.from([0x00, 0x00, 0x01]);

export abstract class AnnexBNalSplitter extends Transform {
  protected _buffer: Buffer | null;
  protected _accessUnit: Buffer[];
  protected _nalFunctions: NalFunctions;

  public constructor(nalFunctions: NalFunctions) {
    super();
    this._buffer = null;
    this._accessUnit = [];
    this._nalFunctions = nalFunctions;
  }

  public rbsp(data: Buffer): Buffer {
    const newData = Buffer.allocUnsafe(data.length);
    let newLength = 0;

    let current = data;
    while (true) {
      const epbsPos = current.indexOf(epbPrefix);
      if (epbsPos === -1) {
        current.copy(newData, newLength);
        newLength += current.length;
        break;
      }
      const copyRange = (current[epbsPos + 3] ?? 0) <= 0x03 ? epbsPos + 2 : epbsPos + 3;
      current.copy(newData, newLength, 0, copyRange);
      newLength += copyRange;
      current = current.subarray(epbsPos + 3);
    }

    return newData.subarray(0, newLength);
  }

  public findNalStart(buf: Buffer): { index: number; length: number } | null {
    const pos = buf.indexOf(nalSuffix);
    if (pos === -1) return null;
    return pos > 0 && buf[pos - 1] === 0 ? { index: pos - 1, length: 4 } : { index: pos, length: 3 };
  }

  public abstract removeEpbs(frame: Buffer, unitType: number): Buffer;

  public processFrame(frame: Buffer): void {
    if (frame.length === 0) return;

    const unitType = this._nalFunctions.getUnitType(frame);
    if (this._nalFunctions.isAUD(unitType) && this._accessUnit.length > 0) {
      const sizeOfAccessUnit = this._accessUnit.reduce((acc, nalu) => acc + nalu.length + 4, 0);
      const accessUnitBuf = Buffer.allocUnsafe(sizeOfAccessUnit);

      let offset = 0;
      this._accessUnit.forEach(nalu => {
        accessUnitBuf.writeUInt32BE(nalu.length, offset);
        offset += 4;
        nalu.copy(accessUnitBuf, offset);
        offset += nalu.length;
      });

      this.push(accessUnitBuf);
      this._accessUnit = [];
    } else {
      this._accessUnit.push(this.removeEpbs(frame, unitType));
    }
  }

  public override _transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback): void {
    let currentChunk = chunk;
    let nalStart = this.findNalStart(currentChunk);
    if (!this._buffer) {
      if (!nalStart) {
        callback();
        return;
      }
      currentChunk = currentChunk.subarray(nalStart.index + nalStart.length);
      this._buffer = emptyBuffer;
    }

    currentChunk = Buffer.concat([this._buffer, currentChunk]);
    while ((nalStart = this.findNalStart(currentChunk))) {
      const frame = currentChunk.subarray(0, nalStart.index);
      this.processFrame(frame);
      currentChunk = currentChunk.subarray(nalStart.index + nalStart.length);
    }
    this._buffer = currentChunk;
    callback();
  }
}

export class H264NalSplitter extends AnnexBNalSplitter {
  public constructor() {
    super(H264Helpers);
  }

  public removeEpbs(frame: Buffer, unitType: number): Buffer {
    return unitType === H264NalUnitTypes.SPS || unitType === H264NalUnitTypes.SEI ? this.rbsp(frame) : frame;
  }
}

export class H265NalSplitter extends AnnexBNalSplitter {
  public constructor() {
    super(H265Helpers);
  }

  public removeEpbs(frame: Buffer): Buffer {
    return frame;
  }
}

export default {
  H264NalUnitTypes,
  H265NalUnitTypes,
  H264Helpers,
  H265Helpers,
  H264NalSplitter,
  H265NalSplitter,
};
