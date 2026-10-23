<div align="center">
  <br />
  <p>
    <a href="https://github.com/donyst/discord.js-selfbot-v13"><img src="https://discord.js.org/static/logo.svg" width="450" alt="discord.js-selfbot-v13" /></a>
  </p>
  <h1>discord.js-selfbot-v13</h1>
  <p>
    <strong>A modern, powerful, and actively maintained Node.js library for Discord User Accounts (Selfbots).</strong>
  </p>
  <p>
    <a href="https://github.com/donyst/discord.js-selfbot-v13/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-GPL--3.0-blue.svg?style=flat-square" alt="License" /></a>
    <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D20.18.0-brightgreen.svg?style=flat-square" alt="Node Version" /></a>
    <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-Ready-blue.svg?style=flat-square" alt="TypeScript" /></a>
    <a href="https://github.com/donyst/discord.js-selfbot-v13/stargazers"><img src="https://img.shields.io/github/stars/donyst/discord.js-selfbot-v13?style=flat-square" alt="GitHub Stars" /></a>
    <a href="https://github.com/donyst/discord.js-selfbot-v13/issues"><img src="https://img.shields.io/github/issues/donyst/discord.js-selfbot-v13?style=flat-square" alt="GitHub Issues" /></a>
  </p>
</div>

---

> [!NOTE]
> ### 🚀 Active Maintenance & Continuation
> The original upstream repository (`aiko-chan-ai/discord.js-selfbot-v13`) was archived by its original author. This repository is the **actively maintained fork** maintained by **[Phạm Minh Đồng (@donyst)](https://github.com/donyst)**.
>
> We continuously maintain compatibility with Discord's evolving APIs and provide high-fidelity client fingerprinting aligned with official Discord Desktop clients.

> [!CAUTION]
> ### ⚠️ Discord Terms of Service & Disclaimer
> - Automating user accounts (Selfbotting) is strictly against the **[Discord Terms of Service](https://discord.com/terms)** and Community Guidelines.
> - Using this library may result in account termination or phone/captcha verification.
> - This software is created for educational, research, and reverse-engineering purposes. **The authors and maintainers take no responsibility for any actions taken on your account.**
> - **Never share your Discord token with anyone.**

---

## 🌟 Key Highlights

- **Desktop Client Parity**: Built with **Discord Desktop 1.0.9265** parity (Chromium 148, Electron 42.11.15, Build `647615`, Native `96160`).
- **Complete Interactions**: Full support for slash commands (`/`), buttons, select menus, modal popups, and deferred responses.
- **Modern Architecture**: Full **TypeScript** typing, native **ESM** (`import`) and **CommonJS** (`require`) dual support.
- **Voice & Video**: Voice channels, screenshare / Go-Live video streaming via WebRTC/Werift RTP.
- **Advanced Auth**: QR code Remote Auth login, 2FA/TOTP verification handler, and Captcha callback hooks.
- **Rich Presence**: Custom Status, Activity with Spotify / Samsung Galaxy RPC, and User Application authorization.

---

## 📦 Installation

> **Requirement**: [Node.js](https://nodejs.org) **20.18.0** or newer.

Install via your preferred package manager:

```bash
# Using npm
npm install https://github.com/donyst/discord.js-selfbot-v13.git

# Using pnpm
pnpm add https://github.com/donyst/discord.js-selfbot-v13.git

# Using yarn
yarn add https://github.com/donyst/discord.js-selfbot-v13.git
```

---

## 🚀 Quick Start

### 1. Modern ESM / TypeScript

```typescript
import { Client } from 'discord.js-selfbot-v13';

const client = new Client({
  checkUpdate: false,
});

client.on('ready', () => {
  console.log(`Logined in as ${client.user?.tag} (${client.user?.id})!`);
});

client.on('messageCreate', async (message) => {
  if (message.content === '!ping') {
    await message.reply('Pong! 🏓');
  }
});

client.login(process.env.DISCORD_TOKEN);
```

### 2. CommonJS (CJS)

```javascript
const { Client } = require('discord.js-selfbot-v13');

const client = new Client();

client.on('ready', async () => {
  console.log(`${client.user.username} is ready!`);
});

client.login('YOUR_DISCORD_TOKEN');
```

---

## ⚡ Interactions & Slash Commands

Triggering slash commands with user accounts:

```typescript
import { Client, TextChannel } from 'discord.js-selfbot-v13';

const client = new Client();

client.on('ready', async () => {
  const channel = (await client.channels.fetch('CHANNEL_ID')) as TextChannel;

  // Send a slash command: /help
  const response = await channel.sendSlash('BOT_APPLICATION_ID', 'help');
  console.log('Command response:', response);

  // Send a slash command with arguments: /ban user:123 reason:"Spam"
  await channel.sendSlash('BOT_APPLICATION_ID', 'ban', '1234567890', 'Spam');
});

client.login(process.env.DISCORD_TOKEN);
```

For advanced interactions (Modals, Select Menus, Subcommands), check out our [Slash Command Guide](docs/slash-commands.md) and [Examples Directory](examples/).

---

## 📱 Rich Presence & Custom Status

```typescript
client.on('ready', () => {
  client.user?.setPresence({
    status: 'online',
    activities: [
      {
        name: 'Visual Studio Code',
        type: 'PLAYING',
        details: 'Developing discord.js-selfbot-v13',
        state: 'Workspace: TypeScript',
        timestamps: { start: Date.now() },
      },
    ],
  });
});
```

See [examples/RichPresence.js](examples/RichPresence.js) and [examples/SamsungRPC.js](examples/SamsungRPC.js) for more presets.

---

## 🔑 How to Retrieve Your User Token

1. Open Discord in your desktop browser (Chrome, Brave, Edge, etc.) or open Discord Desktop.
2. Press <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>I</kbd> (or <kbd>Cmd</kbd> + <kbd>Option</kbd> + <kbd>I</kbd> on macOS) to open Developer Tools.
3. Switch to the **Console** tab and execute:

```javascript
window.webpackChunkdiscord_app.push([
  [Symbol()],
  {},
  (req) => {
    if (!req.c) return;
    for (let m of Object.values(req.c)) {
      try {
        if (!m.exports || m.exports === window) continue;
        if (m.exports?.getToken) return copy(m.exports.getToken());
        for (let ex in m.exports) {
          if (m.exports?.[ex]?.getToken && m.exports[ex][Symbol.toStringTag] !== 'IntlMessagesProxy') {
            return copy(m.exports[ex].getToken());
          }
        }
      } catch {}
    }
  },
]);
window.webpackChunkdiscord_app.pop();
console.log('%cSuccess! Token copied to clipboard.', 'color: #57F287; font-size: 16px;');
```

> [!WARNING]
> Keep your token secret. Anyone with your token has full access to your Discord account.

---

## 📚 Documentation

Detailed guides and references can be found in the [`docs/`](docs/) directory:

- [Documentation Index](docs/readme.md)
- [Getting Started & Configuration](docs/getting-started.md)
- [Client Emulation & Super-Properties](docs/client-emulation.md)
- [Interactions & Slash Commands](docs/interactions.md)
- [Captcha & MFA Handling](docs/captcha-and-mfa.md)
- [Voice & Video Streaming](docs/voice-and-video.md)
- [Frequently Asked Questions & Safety](docs/faq.md)

---

## 👥 Authors & Contributors

This project is made possible thanks to the following authors and contributors:

### 👑 Project Lead & Current Maintainer (2024 - Present)
- **[Phạm Minh Đồng (@donyst)](https://github.com/donyst)**
  - Email: [dongdz.user@gmail.com](mailto:dongdz.user@gmail.com)
  - Lead developer, protocol reverse-engineering, Discord Desktop parity sync, TypeScript architecture.

### 💡 Original Selfbot Creator (2022 - 2024)
- **[aiko-chan-ai](https://github.com/aiko-chan-ai)**
  - Original architect of `discord.js-selfbot-v13`.

### 🏛️ Upstream Foundation
- **[discord.js Team](https://github.com/discordjs)**
  - Creators of the foundation library `discord.js`.

See [AUTHORS.md](AUTHORS.md) for full attribution details.

---

## 📄 License

This project is licensed under the **GNU General Public License v3.0 (GPL-3.0)**.  
See the [LICENSE](LICENSE) file for complete terms.

```
discord.js-selfbot-v13
Copyright (C) 2024-2026 Phạm Minh Đồng (donyst) <dongdz.user@gmail.com>
Copyright (C) 2022-2024 aiko-chan-ai
Copyright (C) 2015-2022 discord.js contributors
```
