# Voice & Video Streaming

`discord.js-selfbot-v14` includes support for Discord user voice connections and Go-Live video streaming, powered by WebRTC and `werift-rtp`.

---

## 1. Joining a Voice Channel

```typescript
import { Client, StageChannel, VoiceChannel } from 'discord.js-selfbot-v14';

const client = new Client();

client.on('ready', async () => {
  const channel = (await client.channels.fetch('VOICE_CHANNEL_ID')) as VoiceChannel;

  const connection = await channel.join({
    selfDeaf: false,
    selfMute: false,
    selfVideo: false, // Set to true to broadcast webcam
  });

  console.log('[+] Connected to voice channel:', channel.name);
});
```

---

## 2. Go-Live Screen Share / Video Streaming

Selfbot accounts can broadcast video streams directly into Discord voice channels:

```typescript
import { Client, VoiceChannel } from 'discord.js-selfbot-v14';

const client = new Client();

client.on('ready', async () => {
  const channel = (await client.channels.fetch('VOICE_CHANNEL_ID')) as VoiceChannel;

  const connection = await channel.join();

  // Create stream connection
  const stream = await connection.createStreamConnection();

  // Play video stream using custom stream player / ffmpeg
  console.log('[+] Go-Live screen share active!');
});
```

See [examples/VoiceChannel/](examples/VoiceChannel/) for complete scripts and ffmpeg piping implementations.
