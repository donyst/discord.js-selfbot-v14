/**
 * Demonstration of Binary Protobuf User Settings:
 * - Read typed PreloadedUserSettings (Theme, Developer Mode, Custom Status, Online Status)
 * - Modify settings using the official Discord Desktop binary endpoint (/users/@me/settings-proto/1)
 */

import { Client } from 'discord.js-selfbot-v14';

const client = new Client();

client.on('ready', async () => {
  console.log(`[User Settings Demo] Logged in as: ${client.user?.tag}`);

  try {
    // 1. Fetch and decode current settings
    console.log('Fetching binary PreloadedUserSettings...');
    const settings = await client.settings.getPreloadedSettings();
    console.log('Current Appearance:', settings.appearance);
    console.log('Current Status:', settings.status);
    console.log('Current Custom Status:', settings.customStatus);

    // 2. Update settings using typed helper
    console.log('Updating settings to Midnight theme & Developer Mode...');
    await client.settings.updatePreloadedSettings({
      appearance: {
        theme: 'midnight', // 'dark' | 'light' | 'midnight'
        developerMode: true,
      },
      status: 'idle',
      customStatus: {
        text: 'Coding with discord.js-selfbot-v14 🚀',
        emojiName: '⚡',
      },
    });

    console.log('Settings successfully synced to Discord server!');
  } catch (err) {
    console.error('Failed to sync settings:', err);
  }
});

client.login(process.env.DISCORD_TOKEN);
