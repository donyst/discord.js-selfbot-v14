# Getting Started with discord.js-selfbot-v13

This guide walks you through setting up, configuring, and running your selfbot application using **`discord.js-selfbot-v13`** (maintained by [Phạm Minh Đồng](https://github.com/donyst)).

---

## 1. System Requirements

- **Node.js**: `v20.18.0` or higher
- **npm**, **pnpm**, or **yarn**
- Basic knowledge of JavaScript or TypeScript and asynchronous programming (Promises / async-await)

---

## 2. Installation

```bash
# Via git repository:
npm install https://github.com/donyst/discord.js-selfbot-v13.git
```

---

## 3. Initializing the Client

```typescript
import { Client } from 'discord.js-selfbot-v13';

const client = new Client({
  checkUpdate: false, // Set to false to disable automated update check notices
  // Optional: Custom WebSocket super properties can be supplied here
});

client.on('ready', () => {
  console.log(`[+] Logged in as ${client.user?.tag} (${client.user?.id})`);
  console.log(`[+] In ${client.guilds.cache.size} guilds and ${client.channels.cache.size} channels`);
});

client.on('messageCreate', async (message) => {
  // Ignore messages from other accounts if desired
  if (message.author.id !== client.user?.id) return;

  if (message.content === '!ping') {
    await message.edit('Pong! 🏓');
  }
});

client.login(process.env.DISCORD_TOKEN);
```

---

## 4. Key Client Options

When instantiating `new Client(options)`, you can configure:

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `checkUpdate` | `boolean` | `true` | Checks npm registry for new versions of the library. |
| `captchaSolver` | `Function` | `undefined` | Callback function to solve HCaptcha challenges when encountered. |
| `ws.properties` | `SuperProperties` | *Desktop 1.0.9265* | Custom super-properties payload for Discord Gateway IDENTIFY. |
| `rest.userAgent` | `string` | *Chrome 148 / Electron 42* | Custom User-Agent header for Discord REST API requests. |

---

## 5. TypeScript Setup

For TypeScript projects, ensure your `tsconfig.json` contains:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```

---

## 6. Safe Token Handling

Always load your user token from environment variables or a secure secret manager:

```typescript
import 'dotenv/config';
import { Client } from 'discord.js-selfbot-v13';

const client = new Client();
client.login(process.env.DISCORD_USER_TOKEN);
```

> [!CAUTION]
> Never hardcode tokens in git repositories or commit `.env` files.
