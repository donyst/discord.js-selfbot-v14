/**
 * Demonstration of Advanced Reverse-Engineered Desktop Features:
 * - Mobile platform emulation (displays green phone indicator in Discord member lists)
 * - Embedded Discord IPC Server (Named Pipe \\.\pipe\discord-ipc-0 for external game/Spotify integration)
 * - Automatic OS process Game Detection across 24,800+ Discord registered titles
 * - Discord Soundboard audio playback into voice channels
 */

import { Client } from 'discord.js-selfbot-v14';

const client = new Client({
  // 1. Emulate Mobile device (or 'desktop' | 'web')
  platformMode: 'mobile',

  // 2. Enable local Named Pipe IPC server (\\.\pipe\discord-ipc-0)
  ipcServer: true,

  // 3. Keep client fingerprint continuously synced with official Discord CDN
  fingerprintSync: true,

  // 4. Emulate natural user heartbeats
  heartbeats: true,
});

client.on('ready', async () => {
  console.log(`[Selfbot Ready] Logged in as: ${client.user?.tag}`);

  // --- 1. Auto Game Detection ---
  // Starts scanning running processes every 15s and updates Rich Presence automatically
  console.log('Starting Auto Game Detection...');
  client.games.startAutoDetection({
    intervalMs: 15_000,
    autoSetActivity: true,
  });

  client.games.on('gameStart', game => {
    console.log(`🎮 Game detected: ${game.name} (Executable: ${game.executable})`);
  });

  client.games.on('gameStop', game => {
    console.log(`⏹️ Game exited: ${game.name}`);
  });

  // --- 2. Discord Soundboard ---
  // If you are in a voice channel, you can play custom or default soundboard sounds:
  /*
  const voiceChannelId = '123456789012345678';
  const soundId = '111111111111111111';
  try {
    await client.soundboard.play(voiceChannelId, soundId);
    console.log('🔊 Soundboard sound played!');
  } catch (err) {
    console.error('Failed to play sound:', err);
  }
  */
});

client.login(process.env.DISCORD_TOKEN);
