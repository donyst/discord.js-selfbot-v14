# 📖 discord.js-selfbot-v13 Documentation

Welcome to the official documentation for **`discord.js-selfbot-v13`**, the actively maintained Node.js library for Discord user accounts, maintained by **[Phạm Minh Đồng (@donyst)](https://github.com/donyst)**.

---

## 🧭 Documentation Index

| Section | Description |
| :--- | :--- |
| [🚀 Getting Started](./getting-started.md) | Installation, client instantiation, token setup, event handling, and options. |
| [🖥️ Client Emulation](./client-emulation.md) | Details on `X-Super-Properties`, User-Agent, Chromium 148 / Electron 42 parity, and detection avoidance. |
| [⚡ Interactions & Slash Commands](./interactions.md) | Executing slash commands, clicking buttons, selecting dropdown menus, and submitting modals. |
| [🛡️ Captcha & MFA Handler](./captcha-and-mfa.md) | Handling HCaptcha challenges, 2FA TOTP verification, and automated workflows. |
| [🎙️ Voice & Video Streaming](./voice-and-video.md) | Joining voice channels, playing audio, and streaming video / Go-Live screen shares. |
| [❓ Frequently Asked Questions (FAQ)](./faq.md) | Common errors, safety best practices, and troubleshooting tips. |

---

## ⚡ Quick Reference

```typescript
import { Client } from 'discord.js-selfbot-v13';

const client = new Client({
  checkUpdate: false,
});

client.on('ready', () => {
  console.log(`Connected as: ${client.user?.tag} (${client.user?.id})`);
});

client.login(process.env.DISCORD_TOKEN);
```

---

## 👥 Authors & Maintainers

- **Lead Maintainer**: Phạm Minh Đồng ([@donyst](https://github.com/donyst)) <dongdz.user@gmail.com>
- **Original Fork Creator**: [aiko-chan-ai](https://github.com/aiko-chan-ai)
- **Upstream Engine**: [discord.js Team](https://github.com/discordjs)

See [AUTHORS.md](../AUTHORS.md) and [LICENSE](../LICENSE) for complete licensing and attribution information.