# Interactions & Slash Commands

One of the standout features of `discord.js-selfbot-v13` is full support for executing bot interactions as a user account.

---

## 1. Sending Slash Commands

Use `TextBasedChannel.sendSlash`:

```typescript
channel.sendSlash(
  botId: Snowflake | User,
  commandName: string, // e.g., 'help' or 'config set'
  ...args: (string | number | boolean | FileLike | undefined)[]
): Promise<Message<true> | Modal>
```

### Basic Slash Command

```typescript
import { Client, TextChannel } from 'discord.js-selfbot-v13';

const client = new Client();

client.on('ready', async () => {
  const channel = (await client.channels.fetch('CHANNEL_ID')) as TextChannel;

  // Execute /ping on bot application ID
  const response = await channel.sendSlash('BOT_ID', 'ping');
  console.log('Bot replied:', response.content);
});
```

### Slash Commands with Subcommands

```typescript
// Triggers: /user info user:@someone
await channel.sendSlash('BOT_ID', 'user info', 'USER_ID');
```

---

## 2. Handling Deferred Responses ("Bot is thinking...")

When a bot takes time to process a command, it returns a deferred response with the `LOADING` flag. You can wait for the final message update:

```typescript
const channel = client.channels.cache.get('CHANNEL_ID') as TextChannel;
const response = await channel.sendSlash('BOT_ID', 'generate', 'prompt text');

if (response.flags.has('LOADING')) {
  // Wait for the bot to edit the message with the final result
  const finalMessage = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      client.off('messageUpdate', onUpdate);
      reject(new Error('Interaction timed out'));
    }, 60000);

    function onUpdate(oldMsg: any, newMsg: any) {
      if (oldMsg.id === response.id && !newMsg.flags?.has('LOADING')) {
        clearTimeout(timer);
        client.off('messageUpdate', onUpdate);
        resolve(newMsg);
      }
    }

    client.on('messageUpdate', onUpdate);
  });

  console.log('Final output:', (finalMessage as any).content);
}
```

---

## 3. Clicking Buttons

To click a button component on a message:

```typescript
const message = await channel.messages.fetch('MESSAGE_ID');

// Click a button by index or customId
await message.clickButton({
  row: 0,
  col: 0,
});

// Or click by button component:
const button = message.components[0].components[0];
await message.clickButton(button.customId);
```

---

## 4. Selecting Dropdown Menus

```typescript
const message = await channel.messages.fetch('MESSAGE_ID');

// Select options from select menu
await message.selectMenu({
  row: 0,
  values: ['option_value_1'],
});
```

---

## 5. Submitting Modals

If a slash command or button opens a Modal dialog:

```typescript
const modal = await channel.sendSlash('BOT_ID', 'feedback');

if (!modal.isMessage) {
  // Fill text input components
  modal.components[0].components[0].setValue('This is my feedback message');
  
  // Submit the modal back to Discord
  await modal.reply();
}
```
