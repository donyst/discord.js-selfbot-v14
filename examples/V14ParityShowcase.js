/**
 * Demonstration of discord.js v14 Parity:
 * - EmbedBuilder, ActionRowBuilder, ButtonBuilder, StringSelectMenuBuilder
 * - GatewayIntentBits, ChannelType, PermissionFlagsBits, Partials
 * - Sending rich interactive messages
 */

import {
  Client,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  StringSelectMenuBuilder,
  ButtonStyle,
  GatewayIntentBits,
  Partials,
  Events,
} from 'discord.js-selfbot-v14';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel, Partials.Message],
});

client.on(Events.ClientReady, async readyClient => {
  console.log(`[V14 Parity] Logged in as: ${readyClient.user.tag}`);

  // Create rich EmbedBuilder (v14 syntax)
  const embed = new EmbedBuilder()
    .setTitle('⚡ discord.js-selfbot-v14 Parity Showcase')
    .setDescription('Full v14 developer ergonomics with selfbot account capabilities.')
    .setColor(0x5865f2)
    .addFields(
      { name: 'Pure ESM & CJS', value: 'Seamless `import` and `require` support', inline: true },
      { name: 'TypeScript', value: '100% strict type definitions', inline: true },
      { name: 'Anti-Detection', value: 'Discord Desktop 1.0.9265 emulation', inline: false },
    )
    .setFooter({ text: 'Powered by discord.js-selfbot-v14' })
    .setTimestamp();

  // Create Buttons with ActionRowBuilder (v14 syntax)
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('primary_action')
      .setLabel('Confirm')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('secondary_action')
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setURL('https://github.com/donyst/discord.js-selfbot-v14')
      .setLabel('GitHub Repo')
      .setStyle(ButtonStyle.Link),
  );

  // Create Select Menu
  const selectMenuRow = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('select_option')
      .setPlaceholder('Choose a desktop profile')
      .addOptions([
        { label: 'Desktop', value: 'desktop', description: 'Windows 10/11 x64 Client' },
        { label: 'Mobile', value: 'mobile', description: 'iOS / Android green indicator' },
        { label: 'Web', value: 'web', description: 'Chrome WebApp' },
      ]),
  );

  console.log('Sample V14 Payload ready:');
  console.log(JSON.stringify({ embeds: [embed.toJSON()], components: [row.toJSON(), selectMenuRow.toJSON()] }, null, 2));

  // Example: send to a channel
  /*
  const channel = client.channels.cache.get('YOUR_CHANNEL_ID');
  if (channel && channel.isTextBased()) {
    await channel.send({
      content: 'Hello from discord.js-selfbot-v14!',
      embeds: [embed],
      components: [row, selectMenuRow],
    });
  }
  */
});

client.login(process.env.DISCORD_TOKEN);
