/**
 * Demonstration of Go-Live / Screen Share Video & Audio Broadcasting:
 * - Uses GoLiveStreamer coordinator with WebRTC / Werift RTP
 * - Streams high-definition video (60fps, 1080p/720p) with synchronized Opus audio
 */

import { Client, GoLiveStreamer } from 'discord.js-selfbot-v14';

const client = new Client();

client.on('ready', async () => {
  console.log(`[GoLive Stream Demo] Logged in as: ${client.user?.tag}`);

  const channelId = 'VOICE_CHANNEL_ID_HERE';
  const channel = client.channels.cache.get(channelId);

  if (!channel || !channel.isVoiceBased()) {
    console.log('Please provide a valid voice channel ID');
    return;
  }

  // Join the voice channel
  const connection = await client.voice.joinChannel(channel, {
    selfMute: false,
    selfDeaf: true,
    videoCodec: 'H264',
  });

  // Create GoLiveStreamer coordinator
  const streamer = connection.createGoLiveStreamer();

  streamer.on('start', () => {
    console.log('🎥 Stream has started broadcasting!');
  });

  streamer.on('finish', () => {
    console.log('🏁 Stream broadcast finished!');
  });

  streamer.on('error', err => {
    console.error('Stream error:', err);
  });

  // Media file or online URL
  const videoSource = 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';

  // Start broadcasting video + audio
  await streamer.start(videoSource, {
    fps: 60,
    bitrate: 4500,
    videoCodec: 'H264',
    includeAudio: true,
  });

  // Controls:
  // streamer.pause();
  // streamer.resume();
  // streamer.stop();
});

client.login(process.env.DISCORD_TOKEN);
