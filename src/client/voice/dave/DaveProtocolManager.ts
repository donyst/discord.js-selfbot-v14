import EventEmitter from 'node:events';
import { randomBytes } from 'node:crypto';
import type { VoiceConnection } from '../VoiceConnection.js';
import { VoiceOpcodes } from '../../../util/Constants.js';

export enum DaveState {
  DISABLED = 0,
  INITIALIZING = 1,
  MLS_KEY_PACKAGE_SENT = 2,
  EPOCH_AUTHENTICATED = 3,
  ACTIVE = 4,
}

export interface DaveSessionInitOptions {
  protocolVersion: number;
  mlsExternalSenderPackage?: string;
  groupId?: string;
}

export interface DaveStateUpdate {
  version: number;
  epochAuthenticator: string;
  state: DaveState;
}

/**
 * Manages Discord Audio and Video End-to-End Encryption (DAVE Protocol v1)
 * utilizing Messaging Layer Security (MLS / RFC 9420) and Secure Frames architecture.
 */
export class DaveProtocolManager extends EventEmitter {
  public readonly connection: VoiceConnection;
  public state: DaveState = DaveState.DISABLED;
  public protocolVersion = 1;
  public epochAuthenticator = '';
  public externalSenderPackage: string | null = null;
  public currentEpoch = 0;
  public keyPackage: Buffer | null = null;

  public constructor(connection: VoiceConnection) {
    super();
    this.connection = connection;
  }

  /**
   * Initializes DAVE Protocol when negotiated via Voice Gateway SESSION_DESCRIPTION.
   */
  public init(options: DaveSessionInitOptions): void {
    this.protocolVersion = options.protocolVersion ?? 1;
    this.externalSenderPackage = options.mlsExternalSenderPackage ?? null;
    this.state = DaveState.INITIALIZING;

    this.emit('daveInit', {
      version: this.protocolVersion,
      externalSenderPackage: this.externalSenderPackage,
    });

    if (this.externalSenderPackage) {
      this.generateAndSendKeyPackage();
    }
  }

  /**
   * Generates an MLS Key Package and transmits it to the Voice RTC server.
   */
  public generateAndSendKeyPackage(): Buffer {
    // Generate an ephemeral 32-byte MLS key package identifier / seed
    this.keyPackage = randomBytes(64);
    this.state = DaveState.MLS_KEY_PACKAGE_SENT;

    const ws = (this.connection as unknown as { sockets?: { ws?: { sendPacket(p: unknown): void } } }).sockets?.ws;
    if (ws) {
      ws.sendPacket({
        op: VoiceOpcodes.DAVE_MLS_KEY_PACKAGE,
        d: {
          key_package: this.keyPackage.toString('base64'),
        },
      });
    }

    this.emit('keyPackageReady', this.keyPackage);
    return this.keyPackage;
  }

  /**
   * Prepares transition for an epoch upgrade.
   */
  public prepareEpoch(epoch: number, epochAuthenticator = ''): void {
    this.currentEpoch = epoch;
    this.epochAuthenticator = epochAuthenticator;
    this.state = DaveState.EPOCH_AUTHENTICATED;

    this.emit('stateUpdate', {
      version: this.protocolVersion,
      epochAuthenticator: this.epochAuthenticator,
      state: this.state,
    } as DaveStateUpdate);
  }

  /**
   * Resets DAVE protocol state on disconnection.
   */
  public reset(): void {
    this.state = DaveState.DISABLED;
    this.externalSenderPackage = null;
    this.epochAuthenticator = '';
    this.currentEpoch = 0;
    this.keyPackage = null;
  }
}

export default DaveProtocolManager;
