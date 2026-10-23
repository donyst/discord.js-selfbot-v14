<div align="center">
  <br />
  <p>
    <a href="https://github.com/donyst/discord.js-selfbot-v14"><img src="https://discord.js.org/static/logo.svg" width="450" alt="discord.js-selfbot-v14" /></a>
  </p>
  <h1>discord.js-selfbot-v14</h1>
  <p>
    <strong>A modern, powerful, and actively maintained Node.js library for Discord User Accounts (Selfbots).</strong>
  </p>
  <p>
    <a href="https://github.com/donyst/discord.js-selfbot-v14/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-GPL--3.0-blue.svg?style=flat-square" alt="License" /></a>
    <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D20.18.0-brightgreen.svg?style=flat-square" alt="Node Version" /></a>
    <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-Ready-blue.svg?style=flat-square" alt="TypeScript" /></a>
    <a href="https://github.com/donyst/discord.js-selfbot-v14/stargazers"><img src="https://img.shields.io/github/stars/donyst/discord.js-selfbot-v14?style=flat-square" alt="GitHub Stars" /></a>
    <a href="https://github.com/donyst/discord.js-selfbot-v14/issues"><img src="https://img.shields.io/github/issues/donyst/discord.js-selfbot-v14?style=flat-square" alt="GitHub Issues" /></a>
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
- **Dynamic Fingerprinting**: Real-time CDN scraper & multi-device profiles (`desktop`, `mobile` with green phone icon, `web`).
- **Embedded Discord IPC Server**: Built-in Windows Named Pipe (`\\.\pipe\discord-ipc-0`) allowing Spotify, games, and external tools to update Rich Presence automatically without running the official client!
- **Automatic Game Detection**: Scans running processes on the host machine against 24,800+ registered Discord games and auto-syncs Rich Presence.
- **Soundboard Controller**: Full soundboard playback and management directly in voice and stage channels.
- **DAVE Voice v8 Architecture**: Modern Voice Gateway v8 with DAVE MLS End-to-End Encryption and `aead_aes256_gcm_rtpsize` cipher support.
- **Complete Interactions**: Full support for slash commands (`/`), buttons, select menus, modal popups, and deferred responses.
- **Modern Architecture**: Full **TypeScript** typing, native **ESM** (`import`) and **CommonJS** (`require`) dual support.
- **Voice & Video**: Voice channels, screenshare / Go-Live video streaming via WebRTC/Werift RTP.
- **Advanced Auth**: QR code Remote Auth login, 2FA/TOTP verification handler, and Captcha callback hooks.

---

## 📦 Installation

> **Requirement**: [Node.js](https://nodejs.org) **20.18.0** or newer.

Install via your preferred package manager:

```bash
# Using npm
npm install https://github.com/donyst/discord.js-selfbot-v14.git

# Using pnpm
pnpm add https://github.com/donyst/discord.js-selfbot-v14.git

# Using yarn
yarn add https://github.com/donyst/discord.js-selfbot-v14.git
```

---

## 🚀 Quick Start

### 1. Modern ESM / TypeScript

```typescript
import { Client } from 'discord.js-selfbot-v14';

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
const { Client } = require('discord.js-selfbot-v14');

const client = new Client();

client.on('ready', async () => {
  console.log(`${client.user.username} is ready!`);
});

client.login('YOUR_DISCORD_TOKEN');
```

### 3. Modern discord.js v14 Parity (Builders, Enums & BitFields)

Fully compatible with discord.js v14 (`14.27.0`) syntax while maintaining selfbot capabilities:

```typescript
import {
  Client,
  Events,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js-selfbot-v14';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
  partials: [Partials.Channel, Partials.Message],
});

client.on(Events.ClientReady, () => {
  console.log(`Connected as ${client.user?.tag}!`);
});

client.on(Events.MessageCreate, async (message) => {
  if (message.content === '!v14') {
    const embed = new EmbedBuilder()
      .setTitle('discord.js v14 Architecture')
      .setDescription('Modern builders with complete user automation support!')
      .setColor(0x5865F2);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('demo_btn')
        .setLabel('v14 Button')
        .setStyle(ButtonStyle.Primary),
    );

    await message.channel.send({ embeds: [embed], components: [row] });
  }
});

client.login(process.env.DISCORD_TOKEN);
```

### 4. QR Code Remote Auth (No Token Needed!)

Log in directly by scanning an ASCII QR code with your Discord mobile app:

```typescript
import { Client } from 'discord.js-selfbot-v14';

const client = new Client();

client.on('ready', () => {
  console.log(`Connected as ${client.user?.tag}!`);
});

// Starts remote auth session, prints QR to console, and auto-logs in:
await client.QRLogin();
```

### 5. Advanced Reverse-Engineered Desktop Features

Leverage cutting-edge desktop capabilities reverse-engineered directly from official Discord Desktop:

```typescript
import { Client } from 'discord.js-selfbot-v14';

const client = new Client({
  // 1. Emulate Mobile device (displays green phone icon in server member lists)
  platformMode: 'mobile', // 'desktop' | 'mobile' | 'web'

  // 2. Enable embedded Named Pipe IPC server (\\.\pipe\discord-ipc-0)
  // External apps (Spotify, games, OBS) will automatically update your Rich Presence!
  ipcServer: true,

  // 3. Keep client fingerprint continuously auto-synced with Discord CDN
  fingerprintSync: true,

  // 4. Emulate natural user heartbeats
  heartbeats: true,
});

client.on('ready', async () => {
  console.log(`Selfbot ready as ${client.user?.tag}!`);

  // --- Auto Game Detection (24,800+ games) ---
  // Automatically detects when you start playing games on your PC and updates your activity:
  client.games.startAutoDetection({
    intervalMs: 15_000,
    autoSetActivity: true,
  });

  // --- Discord Soundboard ---
  // Play soundboard sounds directly into a voice channel:
  // await client.soundboard.play('VOICE_CHANNEL_ID', 'SOUND_ID');
});

client.login(process.env.DISCORD_TOKEN);
```

---

## ⚡ Interactions & Slash Commands

Triggering slash commands with user accounts:

```typescript
import { Client, TextChannel } from 'discord.js-selfbot-v14';

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
        details: 'Developing discord.js-selfbot-v14',
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

### 👑 Project Lead & Current Maintainer (2025 - Present)
- **[Phạm Minh Đồng (@donyst)](https://github.com/donyst)**
  - Email: [dongdz.user@gmail.com](mailto:dongdz.user@gmail.com)
  - Lead developer, protocol reverse-engineering, Discord Desktop parity sync, TypeScript architecture.

### 💡 Original Selfbot Creator (2022 - 2025)
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
discord.js-selfbot-v14
Copyright (C) 2025-2026 Phạm Minh Đồng (donyst) <dongdz.user@gmail.com>
Copyright (C) 2022-2025 aiko-chan-ai
Copyright (C) 2015-2022 discord.js contributors
```
