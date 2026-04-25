const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

function page(title, subtitle, groups, footer) {
  const e = new EmbedBuilder().setColor(0x2b2d31).setTitle(title).setDescription(subtitle);
  for (const g of groups) e.addFields({ name: g.name, value: g.value, inline: false });
  return e.setFooter({ text: footer });
}

function buildHelpPages(prefix) {
  return [
    page('Skulls bot', 'Page 1/4 • setup and utility', [
      { name: 'Setup / Admin', value: `\`${prefix}setup\`\n\`${prefix}setstaffroles @mod @admin\`\n\`${prefix}setskullchannel #channel\`\n\`${prefix}setprefix ?\`\n\`${prefix}automod on/off\`` },
      { name: 'Server Info / Quote', value: `\`${prefix}si\`\n\`${prefix}quote\` (reply)\n\`${prefix}quote MESSAGE_ID\`` },
      { name: 'Skulls', value: `\`${prefix}skullme\`\n\`${prefix}skullstats @user\`\n\`${prefix}skulltop\`` }
    ], 'Use the buttons below to change pages.'),
    page('Skulls bot', 'Page 2/4 • moderation', [
      { name: 'Moderation', value: `\`${prefix}warn @user reason\`\n\`${prefix}warnings @user\`\n\`${prefix}clearwarns @user\`\n\`${prefix}mute @user 10m reason\`\n\`${prefix}unmute @user\`\n\`${prefix}jail @user reason\`\n\`${prefix}unjail @user\`\n\`${prefix}kick @user reason\`\n\`${prefix}ban @user reason\`\n\`${prefix}purge 10\`\n\`${prefix}lock\`\n\`${prefix}unlock\`\n\`${prefix}slowmode 5\`` }
    ], 'Use the buttons below to change pages.'),
    page('Skulls bot', 'Page 3/4 • fun', [
      { name: 'Fun', value: `\`${prefix}8ball question\`\n\`${prefix}coinflip\`\n\`${prefix}roll 100\`\n\`${prefix}ship @user1 @user2\`\n\`${prefix}rate text\`\n\`${prefix}pp\`\n\`${prefix}gayrate @user\`\n\`${prefix}lesbianrate @user\`\n\`${prefix}cute @user\`\n\`${prefix}slutrate @user\`\n\`${prefix}howdumb @user\`\n\`${prefix}wyr\`\n\`${prefix}truth\`\n\`${prefix}dare\`` }
    ], 'Use the buttons below to change pages.'),
    page('Skulls bot', 'Page 4/4 • community and giveaways', [
      { name: 'Community', value: `\`${prefix}poll question\`\n\`${prefix}suggest text\`` },
      { name: 'Giveaways', value: `\`${prefix}gstart 3 days | 1 | Nitro\`\n\`${prefix}gextend MESSAGE_ID 1 week 2 days\`\n\`${prefix}gend MESSAGE_ID\`\n\`${prefix}greroll MESSAGE_ID\`` }
    ], 'Use the buttons below to change pages.')
  ];
}

function buildButtons(page) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('help_prev').setEmoji('⬅️').setStyle(ButtonStyle.Primary).setDisabled(page === 0),
    new ButtonBuilder().setCustomId('help_next').setEmoji('➡️').setStyle(ButtonStyle.Primary).setDisabled(page === 3),
    new ButtonBuilder().setCustomId('help_jump').setEmoji('↕️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('help_close').setEmoji('❌').setStyle(ButtonStyle.Danger)
  );
}

async function sendPagedHelp(message, prefix) {
  const pages = buildHelpPages(prefix);
  let page = 0;
  const sent = await message.reply({ embeds: [pages[page]], components: [buildButtons(page)] });
  const collector = sent.createMessageComponentCollector({ time: 120000 });
  collector.on('collect', async interaction => {
    if (interaction.user.id !== message.author.id) return interaction.reply({ content: 'This menu is not for you.', ephemeral: true });
    if (interaction.customId === 'help_prev') page = Math.max(0, page - 1);
    if (interaction.customId === 'help_next') page = Math.min(pages.length - 1, page + 1);
    if (interaction.customId === 'help_jump') page = (page + 1) % pages.length;
    if (interaction.customId === 'help_close') return interaction.update({ components: [] }).then(() => collector.stop('closed'));
    await interaction.update({ embeds: [pages[page]], components: [buildButtons(page)] });
  });
  collector.on('end', async () => { await sent.edit({ components: [] }).catch(() => null); });
}

module.exports = { sendPagedHelp };
