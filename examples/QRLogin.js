import { Client } from '../dist/index.js';

const client = new Client({
  checkUpdate: false,
});

client.on('ready', () => {
  console.log(`\n🎉 Logged in as ${client.user?.tag} (${client.user?.id})!`);
});

// Start interactive QR Login
// Will display ASCII QR code in the terminal and wait for mobile scan
console.log('⚡ Initializing Discord Remote Auth Gateway...');
console.log('📲 Scan the QR code below using Discord mobile app (Settings -> Scan QR Code)\n');

client
  .QRLogin({
    terminal: true, // Automatically prints ASCII QR in terminal
    onQR: (qrUrl) => {
      console.log(`🔗 Link: ${qrUrl}`);
    },
    onScan: (user) => {
      if (user) {
        console.log(`📱 Scan detected for: ${user.username}#${user.discriminator} (${user.id})`);
        console.log('👉 Please confirm login on your mobile device...');
      }
    },
  })
  .then((token) => {
    console.log('\n✅ Successfully authenticated with Discord via QR!');
    console.log(`🔑 Token: ${token.substring(0, 10)}...${token.substring(token.length - 6)}`);
  })
  .catch((err) => {
    console.error('❌ QR Login failed:', err.message);
    process.exit(1);
  });
