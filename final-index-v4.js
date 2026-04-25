const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  PermissionsBitField,
  Colors
} = require('discord.js');
const { QuickDB } = require('quick.db');
const { handleQuoteCommand } = require('./quote-system-perfect-v3');
const { sendPagedHelp } = require('./help-pagination-v3');
const { buildServerInfoEmbed } = require('./server-info-command');
const { registerSnipe, handleSnipeCommand, handleClearSnipes } = require('./snipe-event-v2');

const db = new QuickDB();
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.User, Partials.GuildMember, Partials.Message, Partials.Channel, Partials.Reaction]
});

function baseEmbed(color = Colors.DarkButNotBlack) { return new EmbedBuilder().setColor(color).setTimestamp(); }
function cleanMessageContent(content) { return !content ? '*no text message*' : content.length > 950 ? `${content.slice(0, 950)}...` : content; }
function hasModPerms(member) {
  return member.permissions.has(PermissionsBitField.Flags.ModerateMembers) || member.permissions.has(PermissionsBitField.Flags.KickMembers) || member.permissions.has(PermissionsBitField.Flags.BanMembers) || member.permissions.has(PermissionsBitField.Flags.ManageMessages) || member.permissions.has(PermissionsBitField.Flags.Administrator);
}
async function getPrefix(guildId) { return (await db.get(`guilds.${guildId}.prefix`)) || '!'; }
async function getSetting(guildId, key) { return (await db.get(`guilds.${guildId}.settings.${key}`)) || null; }
async function setSetting(guildId, key, value) { return db.set(`guilds.${guildId}.settings.${key}`, value); }
async function nextCase(guildId) { const current = (await db.get(`guilds.${guildId}.caseNumber`)) || 0; const next = current + 1; await db.set(`guilds.${guildId}.caseNumber`, next); return next; }
function modlogEmbed({ action, caseNumber, moderatorTag, moderatorId, targetText, reason, channelText }) {
  return baseEmbed(Colors.DarkBlue).setAuthor({ name: 'Modlog Entry' }).setDescription(`**Information**\n**Case #${caseNumber}** | ${action}\n${targetText ? `**User:** ${targetText}\n` : ''}${channelText ? `**Channel:** ${channelText}\n` : ''}**Moderator:** ${moderatorTag} (${moderatorId})\n**Reason:** ${reason}`);
}

async function runAutomod(message) {
  if (!message.guild || message.author.bot) return false;
  const member = message.member;
  if (!member || hasModPerms(member)) return false;
  const enabled = await getSetting(message.guild.id, 'automodEnabled');
  if (!enabled) return false;
  const content = message.content.toLowerCase();
  if (content.includes('discord.gg/') || content.includes('discord.com/invite/')) {
    await message.delete().catch(() => null);
    await message.channel.send({ content: `${message.author}, invite links are not allowed.` }).then(m => setTimeout(() => m.delete().catch(() => {}), 4000)).catch(() => null);
    return true;
  }
  return false;
}

client.once('ready', async () => {
  registerSnipe(client);
  console.log(`logged in as ${client.user.tag}`);
});

client.on('messageReactionAdd', async (reaction, user) => {
  try {
    if (user.bot) return;
    if (reaction.message?.partial) await reaction.message.fetch().catch(() => null);
    if (reaction.partial) await reaction.fetch().catch(() => null);
    if (reaction.emoji?.name !== '💀') return;
    if (!reaction.message?.guild) return;
    const msg = reaction.message;
    const guild = msg.guild;
    const author = msg.author;
    if (!author || author.bot || author.id === user.id) return;
    const uniqueKey = `guilds.${guild.id}.skulls.counted.${msg.id}.${user.id}`;
    if (await db.get(uniqueKey)) return;
    await db.set(uniqueKey, true);
    await db.add(`guilds.${guild.id}.users.${author.id}.received`, 1);
    await db.add(`guilds.${guild.id}.users.${user.id}.given`, 1);
    const totalReceived = (await db.get(`guilds.${guild.id}.users.${author.id}.received`)) || 0;
    const skullChannelId = await getSetting(guild.id, 'skullChannel');
    if (!skullChannelId) return;
    const skullChannel = await client.channels.fetch(skullChannelId).catch(() => null);
    if (!skullChannel || !skullChannel.isTextBased()) return;
    await skullChannel.send({ embeds: [baseEmbed().setAuthor({ name: author.tag, iconURL: author.displayAvatarURL({ dynamic: true }) }).setDescription(`> ${cleanMessageContent(msg.content)}`).addFields({ name: 'from', value: `<#${msg.channel.id}>`, inline: true }, { name: 'skulls', value: `${totalReceived} skulls`, inline: true }, { name: 'jump', value: `[view message](${msg.url})`, inline: false }).setFooter({ text: `added by ${user.tag}` })] }).catch(() => null);
  } catch (err) { console.error(err); }
});

client.on('messageCreate', async message => {
  try {
    if (message.author.bot || !message.guild) return;
    if (await runAutomod(message)) return;
    const guildId = message.guild.id;
    const prefix = await getPrefix(guildId);
    if (!message.content.startsWith(prefix)) return;
    const rawAfterPrefix = message.content.slice(prefix.length).trim();
    const firstSpace = rawAfterPrefix.indexOf(' ');
    const command = (firstSpace === -1 ? rawAfterPrefix : rawAfterPrefix.slice(0, firstSpace)).toLowerCase();
    const rest = firstSpace === -1 ? '' : rawAfterPrefix.slice(firstSpace + 1).trim();
    const args = rest ? rest.split(/ +/) : [];

    if (command === 'quote') return handleQuoteCommand(message, args, prefix);
    if (command === 'si') return message.reply({ embeds: [await buildServerInfoEmbed(message.guild)] });
    if (command === 'help' || command === 'commands') return sendPagedHelp(message, prefix);
    if (command === 'snipe' || command === 's') return handleSnipeCommand(message, client);
    if (command === 'cs') return handleClearSnipes(message, client);

    if (command === 'setup') return message.reply('use `setstaffroles`, `setskullchannel`, `setprefix`, or `automod on/off`.');
    if (command === 'setprefix') { const newPrefix = args[0]; if (!newPrefix) return message.reply('give me a prefix.'); await db.set(`guilds.${guildId}.prefix`, newPrefix); return message.reply(`prefix set to \`${newPrefix}\``); }
    if (command === 'setskullchannel') { const ch = message.mentions.channels.first() || message.guild.channels.cache.get(args[0]?.replace(/[<#>]/g, '')); if (!ch) return message.reply('mention a channel.'); await setSetting(guildId, 'skullChannel', ch.id); return message.reply(`skull channel set to ${ch}`); }
    if (command === 'automod') { const mode = (args[0] || '').toLowerCase(); if (mode === 'on') { await setSetting(guildId, 'automodEnabled', true); return message.reply('automod enabled.'); } if (mode === 'off') { await setSetting(guildId, 'automodEnabled', false); return message.reply('automod disabled.'); } return message.reply('use `on` or `off`.'); }

    if (command === 'warn') { const user = message.mentions.members.first(); const reason = args.slice(1).join(' ') || 'No reason'; if (!user) return message.reply('mention a user.'); const caseNumber = await nextCase(guildId); await db.add(`guilds.${guildId}.warns.${user.id}`, 1); const modlog = modlogEmbed({ action: 'WARN', caseNumber, moderatorTag: message.author.tag, moderatorId: message.author.id, targetText: `${user.user.tag} (${user.id})`, reason }); const logChannelId = await getSetting(guildId, 'modlog'); if (logChannelId) client.channels.fetch(logChannelId).then(ch => ch?.send({ embeds: [modlog] }).catch(() => null)).catch(() => null); return message.reply(`warned ${user.user.tag}.`); }
    if (command === 'warnings') { const user = message.mentions.users.first() || message.author; const count = (await db.get(`guilds.${guildId}.warns.${user.id}`)) || 0; return message.reply(`${user.tag} has ${count} warning(s).`); }
    if (command === 'clearwarns') { const user = message.mentions.users.first(); if (!user) return message.reply('mention a user.'); await db.delete(`guilds.${guildId}.warns.${user.id}`); return message.reply(`cleared warnings for ${user.tag}.`); }
    if (command === 'mute') { const user = message.mentions.members.first(); const time = args[1]; if (!user || !time) return message.reply('use `mute @user 10m reason`.'); const role = message.guild.roles.cache.find(r => r.name.toLowerCase() === 'muted'); if (!role) return message.reply('make a Muted role first.'); await user.roles.add(role).catch(() => null); return message.reply(`muted ${user.user.tag} for ${time}.`); }
    if (command === 'unmute') { const user = message.mentions.members.first(); if (!user) return message.reply('mention a user.'); const role = message.guild.roles.cache.find(r => r.name.toLowerCase() === 'muted'); if (!role) return message.reply('no Muted role found.'); await user.roles.remove(role).catch(() => null); return message.reply(`unmuted ${user.user.tag}.`); }
    if (command === 'jail') { const user = message.mentions.members.first(); if (!user) return message.reply('mention a user.'); const role = message.guild.roles.cache.find(r => r.name.toLowerCase() === 'jail'); if (!role) return message.reply('make a Jail role first.'); await user.roles.add(role).catch(() => null); return message.reply(`jailed ${user.user.tag}.`); }
    if (command === 'unjail') { const user = message.mentions.members.first(); if (!user) return message.reply('mention a user.'); const role = message.guild.roles.cache.find(r => r.name.toLowerCase() === 'jail'); if (!role) return message.reply('no Jail role found.'); await user.roles.remove(role).catch(() => null); return message.reply(`unjailed ${user.user.tag}.`); }
    if (command === 'kick') { const user = message.mentions.members.first(); const reason = args.slice(1).join(' ') || 'No reason'; if (!user) return message.reply('mention a user.'); await user.kick(reason).catch(() => null); return message.reply(`kicked ${user.user.tag}.`); }
    if (command === 'ban') { const user = message.mentions.members.first(); const reason = args.slice(1).join(' ') || 'No reason'; if (!user) return message.reply('mention a user.'); await user.ban({ reason }).catch(() => null); return message.reply(`banned ${user.user.tag}.`); }
    if (command === 'purge') { const amount = Math.min(parseInt(args[0]) || 0, 100); if (!amount) return message.reply('give me a number.'); await message.channel.bulkDelete(amount + 1, true).catch(() => null); }
    if (command === 'lock') { await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false }).catch(() => null); return message.reply('channel locked.'); }
    if (command === 'unlock') { await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: null }).catch(() => null); return message.reply('channel unlocked.'); }
    if (command === 'slowmode') { const secs = Math.min(parseInt(args[0]) || 0, 21600); if (!secs) return message.reply('give me seconds.'); await message.channel.setRateLimitPerUser(secs).catch(() => null); return message.reply(`slowmode set to ${secs}s.`); }

    if (command === 'skullme') return message.reply('react with 💀 to people you want to skull.');
    if (command === 'skullstats') { const user = message.mentions.users.first() || message.author; const received = (await db.get(`guilds.${guildId}.users.${user.id}.received`)) || 0; const given = (await db.get(`guilds.${guildId}.users.${user.id}.given`)) || 0; return message.reply(`${user.tag}: ${given} given, ${received} received.`); }
    if (command === 'skulltop') return message.reply('skull leaderboard coming soon.');

    if (command === 'userinfo') { const user = message.mentions.users.first() || message.author; const member = await message.guild.members.fetch(user.id).catch(() => null); const e = baseEmbed().setTitle(`${user.tag}`).setThumbnail(user.displayAvatarURL({ dynamic: true })).addFields({ name: 'ID', value: user.id, inline: true }, { name: 'Joined', value: member?.joinedAt ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : 'N/A', inline: true }, { name: 'Created', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true }); return message.reply({ embeds: [e] }); }
    if (command === 'serverinfo') return message.reply({ embeds: [await buildServerInfoEmbed(message.guild)] });
    if (command === 'avatar') { const user = message.mentions.users.first() || message.author; return message.reply({ content: user.displayAvatarURL({ dynamic: true, size: 1024 }) }); }
    if (command === 'say') { if (!args.join(' ')) return; return message.channel.send(args.join(' ')); }

    if (command === '8ball') return message.reply(['Yes.', 'No.', 'Maybe.', 'Definitely.', 'Not right now.'].sort(() => Math.random() - 0.5)[0]);
    if (command === 'coinflip') return message.reply(Math.random() < 0.5 ? 'Heads' : 'Tails');
    if (command === 'roll') return message.reply(`You rolled ${Math.ceil(Math.random() * (parseInt(args[0]) || 100))}.`);
  } catch (err) {
    console.error(err);
  }
});

client.login(process.env.DISCORD_TOKEN);
