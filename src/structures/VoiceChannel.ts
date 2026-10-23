import process from 'node:process';
import BaseGuildVoiceChannel from './BaseGuildVoiceChannel.js';
import Permissions from '../util/Permissions.js';

let deprecationEmittedForEditable = false;

/**
 * Represents a guild voice channel on Discord.
 */
export class VoiceChannel extends BaseGuildVoiceChannel {
  /**
   * Whether the channel is editable by the client user
   * @deprecated Use {@link VoiceChannel#manageable} instead
   */
  public get editable(): boolean {
    if (!deprecationEmittedForEditable) {
      process.emitWarning(
        'The VoiceChannel#editable getter is deprecated. Use VoiceChannel#manageable instead.',
        'DeprecationWarning',
      );
      deprecationEmittedForEditable = true;
    }
    return this.manageable;
  }

  public override get joinable(): boolean {
    if (!super.joinable) return false;
    if (!this.client.user) return false;
    const perms = this.permissionsFor(this.client.user.id);
    if (this.full && !perms?.has(Permissions.FLAGS.MOVE_MEMBERS, false)) return false;
    return true;
  }

  public get speakable(): boolean {
    if (!this.client.user) return false;
    const permissions = this.permissionsFor(this.client.user.id);
    if (!permissions) return false;

    if (permissions.has(Permissions.FLAGS.ADMINISTRATOR, false)) return true;

    const me = this.guild.members.me;
    const commDisabled = me ? (me.communicationDisabledUntilTimestamp ?? 0) : 0;
    return commDisabled < Date.now() && permissions.has(Permissions.FLAGS.SPEAK, false);
  }
}

export default VoiceChannel;
