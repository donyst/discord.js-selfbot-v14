import { ProtobufReader, ProtobufWriter, type ProtobufField } from './ProtobufWire.js';

export interface AppearanceSettings {
  theme?: 'dark' | 'light' | 'midnight';
  developerMode?: boolean;
  compactMode?: boolean;
}

export interface CustomStatusSettings {
  text?: string;
  emojiId?: string;
  emojiName?: string;
  expiresAtMs?: number;
}

export interface PreloadedUserSettingsData {
  appearance?: AppearanceSettings;
  customStatus?: CustomStatusSettings;
  status?: 'online' | 'idle' | 'dnd' | 'invisible';
  rawFields?: ProtobufField[];
}

/**
 * High-level parser and builder for Discord Desktop's Type 1 (PreloadedUserSettings) Protobuf.
 */
export class UserSettingsProto {
  /**
   * Decodes a base64 string or Buffer into structured User Settings.
   */
  public static decodePreloaded(data: string | Buffer): PreloadedUserSettingsData {
    const reader = new ProtobufReader(data);
    const fields = reader.parseFields();
    const result: PreloadedUserSettingsData = {
      rawFields: fields,
    };

    for (const field of fields) {
      // Tag 7: Appearance
      if (field.tag === 7 && field.subfields) {
        result.appearance = {};
        for (const sub of field.subfields) {
          if (sub.tag === 1 && Buffer.isBuffer(sub.rawValue)) {
            result.appearance.theme = sub.rawValue.toString('utf8') as 'dark' | 'light' | 'midnight';
          } else if (sub.tag === 2 && typeof sub.rawValue === 'bigint') {
            result.appearance.developerMode = sub.rawValue !== 0n;
          } else if (sub.tag === 3 && typeof sub.rawValue === 'bigint') {
            result.appearance.compactMode = sub.rawValue !== 0n;
          }
        }
      }

      // Tag 8: Custom Status
      if (field.tag === 8 && field.subfields) {
        result.customStatus = {};
        for (const sub of field.subfields) {
          if (sub.tag === 1 && Buffer.isBuffer(sub.rawValue)) {
            result.customStatus.text = sub.rawValue.toString('utf8');
          } else if (sub.tag === 2 && (Buffer.isBuffer(sub.rawValue) || typeof sub.rawValue === 'bigint')) {
            result.customStatus.emojiId = sub.rawValue.toString();
          } else if (sub.tag === 3 && Buffer.isBuffer(sub.rawValue)) {
            result.customStatus.emojiName = sub.rawValue.toString('utf8');
          } else if (sub.tag === 4 && typeof sub.rawValue === 'bigint') {
            result.customStatus.expiresAtMs = Number(sub.rawValue);
          }
        }
      }

      // Tag 9: Status
      if (field.tag === 9 && field.subfields) {
        for (const sub of field.subfields) {
          if (sub.tag === 1 && Buffer.isBuffer(sub.rawValue)) {
            result.status = sub.rawValue.toString('utf8') as 'online' | 'idle' | 'dnd' | 'invisible';
          }
        }
      }
    }

    return result;
  }

  /**
   * Encodes partial User Settings into a base64 encoded Protobuf string.
   */
  public static encodePreloaded(settings: PreloadedUserSettingsData): string {
    const writer = new ProtobufWriter();

    // Appearance (Tag 7)
    if (settings.appearance) {
      const sub = new ProtobufWriter();
      if (settings.appearance.theme !== undefined) {
        sub.writeString(1, settings.appearance.theme);
      }
      if (settings.appearance.developerMode !== undefined) {
        sub.writeVarintField(2, settings.appearance.developerMode);
      }
      if (settings.appearance.compactMode !== undefined) {
        sub.writeVarintField(3, settings.appearance.compactMode);
      }
      writer.writeSubmessage(7, sub);
    }

    // Custom Status (Tag 8)
    if (settings.customStatus) {
      const sub = new ProtobufWriter();
      if (settings.customStatus.text !== undefined) {
        sub.writeString(1, settings.customStatus.text);
      }
      if (settings.customStatus.emojiId !== undefined) {
        sub.writeString(2, settings.customStatus.emojiId);
      }
      if (settings.customStatus.emojiName !== undefined) {
        sub.writeString(3, settings.customStatus.emojiName);
      }
      if (settings.customStatus.expiresAtMs !== undefined) {
        sub.writeVarintField(4, BigInt(settings.customStatus.expiresAtMs));
      }
      writer.writeSubmessage(8, sub);
    }

    // Status (Tag 9)
    if (settings.status) {
      const sub = new ProtobufWriter();
      sub.writeString(1, settings.status);
      writer.writeSubmessage(9, sub);
    }

    return writer.toBase64();
  }
}
