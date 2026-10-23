# Discord Client Emulation & Super-Properties

To avoid rapid flagging and security detections by Discord's anti-abuse systems, selfbots must accurately mirror official Discord client fingerprints.

This fork of **`discord.js-selfbot-v14`** (maintained by [Phạm Minh Đồng](https://github.com/donyst)) features synchronized client emulation aligned with **Discord Desktop 1.0.9265**.

---

## 1. What are `X-Super-Properties`?

When the official Discord client talks to `discord.com/api` or connects to `gateway.discord.gg`, it transmits a base64-encoded JSON payload containing metadata about the environment, browser, operating system, and build number.

### Calibrated Baseline:

```json
{
  "os": "Windows",
  "browser": "Discord Client",
  "release_channel": "stable",
  "client_version": "1.0.9265",
  "os_version": "10.0.26300",
  "os_arch": "x64",
  "app_arch": "x64",
  "system_locale": "en-US",
  "browser_user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) discord/1.0.9265 Chrome/148.0.7778.280 Electron/42.11.15 Safari/537.36",
  "browser_version": "42.11.15",
  "client_build_number": 647615,
  "native_build_number": 96160,
  "os_sdk_version": "26300",
  "client_event_source": null,
  "has_client_mods": false
}
```

---

## 2. HTTP Headers Synchronization

Every REST API request made by the library mirrors the exact headers dispatched by Chromium:

| Header | Value |
| :--- | :--- |
| `User-Agent` | `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) discord/1.0.9265 Chrome/148.0.7778.280 Electron/42.11.15 Safari/537.36` |
| `sec-ch-ua` | `"Not/A)Brand";v="99", "Chromium";v="148"` |
| `sec-ch-ua-mobile` | `?0` |
| `sec-ch-ua-platform` | `"Windows"` |
| `sec-fetch-dest` | `empty` |
| `sec-fetch-mode` | `cors` |
| `sec-fetch-site` | `same-origin` |
| `x-super-properties` | Base64-encoded payload matching client options |

---

## 3. Customizing Emulation Properties

If you need to emulate macOS, Linux, or a web browser, customize `ws.properties`:

```typescript
import { Client } from 'discord.js-selfbot-v14';

const client = new Client({
  ws: {
    properties: {
      os: 'Mac OS X',
      browser: 'Discord Client',
      release_channel: 'stable',
      client_version: '1.0.9265',
      os_version: '23.4.0',
      os_arch: 'arm64',
      app_arch: 'arm64',
      system_locale: 'en-US',
      browser_user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)...',
      browser_version: '42.11.15',
      client_build_number: 647615,
      native_build_number: 96160,
      client_event_source: null,
      has_client_mods: false,
    },
  },
});
```
