# Captcha & Multi-Factor Authentication (MFA)

When Discord detects unusual activity, or when performing sensitive actions (joining servers, adding friends in bulk, transferring guild ownership), Discord may issue an **HCaptcha** challenge or require **2FA/TOTP verification**.

---

## 1. Automated Captcha Solving

You can supply a custom `captchaSolver` callback function in the `Client` options:

```typescript
import { Client } from 'discord.js-selfbot-v13';

const client = new Client({
  captchaSolver: async (captchaData) => {
    /*
      captchaData contains:
      - captcha_key: HCaptcha site key
      - captcha_sitekey: e.g. "a9b5fb07-92ff-493f-86fe-352a2843b3df"
      - captcha_service: "hcaptcha"
      - captcha_rqdata: request-specific security context
      - captcha_rqtoken: request-specific token
    */
    console.log('[Captcha Triggered]', captchaData);

    // Call your captcha solving API (CapSolver, 2Captcha, AntiCaptcha, etc.)
    const solution = await solveHCaptcha({
      sitekey: captchaData.captcha_sitekey,
      rqdata: captchaData.captcha_rqdata,
      url: 'https://discord.com',
    });

    return solution; // return the solved token string
  },
});
```

---

## 2. Handling 2FA / TOTP for Sensitive Actions

When performing actions that require an MFA code (e.g. changing passwords, deleting servers), you can generate TOTP codes using the included `otplib`:

```typescript
import { authenticator } from 'otplib';

const secret = 'YOUR_2FA_SECRET_BASE32';
const token = authenticator.generate(secret);

// Provide code to the action:
await guild.delete(token);
```

---

## 3. Remote Auth Login via QR Code

`discord.js-selfbot-v13` supports Discord's native QR code Remote Authentication gateway:

```typescript
import { Client } from 'discord.js-selfbot-v13';

const client = new Client();

client.on('qrCode', (qr) => {
  console.log('Scan this QR code using the Discord mobile app:');
  console.log(qr);
});

// Start remote auth gateway session:
client.QRLogin();
```
