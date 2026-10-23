import EventEmitter from 'node:events';
import { Buffer } from 'node:buffer';

export interface VolumeInterfaceOptions {
  volume?: number;
}

export interface IVolumeInterface {
  readonly volumeDecibels: number;
  readonly volumeLogarithmic: number;
  setVolumeDecibels(db: number): void;
  setVolumeLogarithmic(value: number): void;
}

/**
 * An interface class for volume transformation.
 * @extends {EventEmitter}
 */
export class VolumeInterface extends EventEmitter implements IVolumeInterface {
  private _volume!: number;

  public constructor({ volume = 1 }: VolumeInterfaceOptions = {}) {
    super();
    this.setVolume(volume);
  }

  public get volumeEditable(): boolean {
    return true;
  }

  public get volume(): number {
    return this._volume;
  }

  public get volumeDecibels(): number {
    return Math.log10(this.volume) * 20;
  }

  public get volumeLogarithmic(): number {
    return Math.pow(this.volume, 1 / 1.660964);
  }

  public applyVolume(buffer: Buffer, volume?: number): Buffer {
    const vol = volume || this._volume;
    if (vol === 1) return buffer;

    const out = Buffer.alloc(buffer.length);
    for (let i = 0; i < buffer.length; i += 2) {
      if (i >= buffer.length - 1) break;
      const uint = Math.min(32767, Math.max(-32767, Math.floor(vol * buffer.readInt16LE(i))));
      out.writeInt16LE(uint, i);
    }

    return out;
  }

  public setVolume(volume: number): void {
    this.emit('volumeChange', this._volume, volume);
    this._volume = volume;
  }

  public setVolumeDecibels(db: number): void {
    this.setVolume(Math.pow(10, db / 20));
  }

  public setVolumeLogarithmic(value: number): void {
    this.setVolume(Math.pow(value, 1.660964));
  }

  public static applyToClass(structure: { prototype: unknown }): void {
    const props = ['volumeDecibels', 'volumeLogarithmic', 'setVolumeDecibels', 'setVolumeLogarithmic'];
    for (const prop of props) {
      Object.defineProperty(
        structure.prototype,
        prop,
        Object.getOwnPropertyDescriptor(VolumeInterface.prototype, prop)!,
      );
    }
  }
}

export const applyToClass = VolumeInterface.applyToClass;

export default VolumeInterface;
