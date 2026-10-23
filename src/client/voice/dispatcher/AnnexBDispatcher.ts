import { Buffer } from 'node:buffer';
import VideoDispatcher from './VideoDispatcher.js';
import Util from '../../../util/Util.js';
import { H264Helpers, H265Helpers, type NalFunctions } from '../player/processing/AnnexBNalSplitter.js';
import type { MediaPlayer } from '../player/MediaPlayer.js';
import type { DispatcherStreams } from './BaseDispatcher.js';

export abstract class AnnexBDispatcher extends VideoDispatcher {
  protected _nalFunctions: NalFunctions;

  public constructor(
    player: MediaPlayer,
    highWaterMark = 12,
    streams: DispatcherStreams = {},
    fps = 30,
    nalFunctions: NalFunctions = H264Helpers,
    payloadType = 101,
  ) {
    super(player, highWaterMark, streams, fps, payloadType);
    this._nalFunctions = nalFunctions;
  }

  public abstract makeFragmentationUnitHeader(isFirstPacket: boolean, isLastPacket: boolean, naluHeader: Buffer): Buffer;

  public _codecCallback(frame: Buffer): void {
    const accessUnit = frame;
    let offset = 0;

    while (offset < accessUnit.length) {
      const naluSize = accessUnit.readUInt32BE(offset);
      offset += 4;
      const nalu = accessUnit.subarray(offset, offset + naluSize);
      const isLastNal = offset + naluSize >= accessUnit.length;
      if (nalu.length <= this.mtu) {
        this._playChunk(Buffer.concat([this.createPayloadExtension(), nalu]), isLastNal);
      } else {
        const [naluHeader, naluData] = this._nalFunctions.splitHeader(nalu);
        const dataFragments = this.partitionMtu(naluData);
        for (let fragmentIndex = 0; fragmentIndex < dataFragments.length; fragmentIndex++) {
          const data = dataFragments[fragmentIndex]!;
          const isFirstPacket = fragmentIndex === 0;
          const isFinalPacket = fragmentIndex === dataFragments.length - 1;

          this._playChunk(
            Buffer.concat([
              this.createPayloadExtension(),
              this.makeFragmentationUnitHeader(isFirstPacket, isFinalPacket, naluHeader),
              data,
            ]),
            isLastNal && isFinalPacket,
          );
        }
      }
      offset += naluSize;
    }
  }
}

export class H264Dispatcher extends AnnexBDispatcher {
  public constructor(player: MediaPlayer, highWaterMark = 12, streams: DispatcherStreams = {}, fps = 30) {
    super(player, highWaterMark, streams, fps, H264Helpers, Util.getPayloadType('H264'));
  }

  public makeFragmentationUnitHeader(isFirstPacket: boolean, isLastPacket: boolean, naluHeader: Buffer): Buffer {
    const nal0 = naluHeader[0] ?? 0;
    const fuPayloadHeader = Buffer.alloc(2);
    const nalType = H264Helpers.getUnitType(naluHeader);
    const fnri = nal0 & 0xe0;

    fuPayloadHeader[0] = 0x1c | fnri;

    if (isFirstPacket) {
      fuPayloadHeader[1] = 0x80 | nalType;
    } else if (isLastPacket) {
      fuPayloadHeader[1] = 0x40 | nalType;
    } else {
      fuPayloadHeader[1] = nalType;
    }

    return fuPayloadHeader;
  }
}

export class H265Dispatcher extends AnnexBDispatcher {
  public constructor(player: MediaPlayer, highWaterMark = 12, streams: DispatcherStreams = {}, fps = 30) {
    super(player, highWaterMark, streams, fps, H265Helpers, Util.getPayloadType('H265'));
  }

  public makeFragmentationUnitHeader(isFirstPacket: boolean, isLastPacket: boolean, naluHeader: Buffer): Buffer {
    const fuIndicatorHeader = Buffer.allocUnsafe(3);
    naluHeader.copy(fuIndicatorHeader);
    const nalType = H265Helpers.getUnitType(naluHeader);

    fuIndicatorHeader[0] = ((fuIndicatorHeader[0] ?? 0) & 0b10000001) | (49 << 1);

    if (isFirstPacket) {
      fuIndicatorHeader[2] = 0x80 | nalType;
    } else if (isLastPacket) {
      fuIndicatorHeader[2] = 0x40 | nalType;
    } else {
      fuIndicatorHeader[2] = nalType;
    }

    return fuIndicatorHeader;
  }
}

export default {
  AnnexBDispatcher,
  H264Dispatcher,
  H265Dispatcher,
};
