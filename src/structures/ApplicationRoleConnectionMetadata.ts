import { ApplicationRoleConnectionMetadataTypes } from '../util/Constants.js';

export interface RawApplicationRoleConnectionMetadataData {
  name: string;
  name_localizations?: Record<string, string> | null;
  description: string;
  description_localizations?: Record<string, string> | null;
  key: string;
  type: number | string;
}

/**
 * Role connection metadata object for an application.
 */
export class ApplicationRoleConnectionMetadata {
  public name: string;
  public nameLocalizations: Record<string, string> | null;
  public description: string;
  public descriptionLocalizations: Record<string, string> | null;
  public key: string;
  public type: string | number;

  public constructor(data: RawApplicationRoleConnectionMetadataData) {
    this.name = data.name;
    this.nameLocalizations = data.name_localizations ?? null;
    this.description = data.description;
    this.descriptionLocalizations = data.description_localizations ?? null;
    this.key = data.key;
    this.type = typeof data.type === 'number' ? ApplicationRoleConnectionMetadataTypes[data.type]! : data.type;
  }
}

export default ApplicationRoleConnectionMetadata;
