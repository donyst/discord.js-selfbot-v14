import type { Client } from '../../Client.js';
import type { GatewayPacket } from '../WebSocketManager.js';

export default (client: Client, { d: data }: GatewayPacket): void => {
  const d = data as { required_action?: string | null };
  let msg: string;
  switch (d.required_action) {
    case undefined:
    case null: {
      msg = 'All required actions have been completed.';
      break;
    }
    case 'AGREEMENTS': {
      msg = 'You need to accept the new Terms of Service and Privacy Policy.';
      (client.api as unknown as { users(u: string): { agreements: { patch(opts: unknown): Promise<void> } } })
        .users('@me')
        .agreements.patch({
          data: {
            terms: true,
            privacy: true,
          },
        })
        .then(() => {
          client.emit(
            'debug',
            '[USER_REQUIRED_ACTION] Successfully accepted the new Terms of Service and Privacy Policy.',
          );
        })
        .catch(e => {
          client.emit(
            'debug',
            `[USER_REQUIRED_ACTION] Failed to accept the new Terms of Service and Privacy Policy: ${e}`,
          );
        });
      break;
    }
    case 'REQUIRE_CAPTCHA': {
      msg = 'You need to complete a captcha.';
      break;
    }
    case 'REQUIRE_VERIFIED_EMAIL': {
      msg = 'You need to verify your email.';
      break;
    }
    case 'REQUIRE_REVERIFIED_EMAIL': {
      msg = 'You need to reverify your email.';
      break;
    }
    case 'REQUIRE_VERIFIED_PHONE': {
      msg = 'You need to verify your phone number.';
      break;
    }
    case 'REQUIRE_REVERIFIED_PHONE': {
      msg = 'You need to reverify your phone number.';
      break;
    }
    case 'REQUIRE_VERIFIED_EMAIL_OR_VERIFIED_PHONE': {
      msg = 'You need to verify your email or verify your phone number.';
      break;
    }
    case 'REQUIRE_REVERIFIED_EMAIL_OR_VERIFIED_PHONE': {
      msg = 'You need to reverify your email or verify your phone number.';
      break;
    }
    case 'REQUIRE_VERIFIED_EMAIL_OR_REVERIFIED_PHONE': {
      msg = 'You need to verify your email or reverify your phone number.';
      break;
    }
    case 'REQUIRE_REVERIFIED_EMAIL_OR_REVERIFIED_PHONE': {
      msg = 'You need to reverify your email or reverify your phone number.';
      break;
    }
    default: {
      msg = `Unknown required action: ${d.required_action}`;
      break;
    }
  }
  client.emit('debug', `[USER_REQUIRED_ACTION] ${msg}`);
};
