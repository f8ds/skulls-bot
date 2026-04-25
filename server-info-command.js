const { EmbedBuilder, Colors } = require('discord.js');

function guildIconUrl(guild) {
  return guild.iconURL({ dynamic: true, size: 1024 });
}

function guildBannerUrl(guild) {
  return guild.bannerURL?.({ dynamic: true, size: 1024 }) || null;
}

async function countBotsAndHumans(guild) {
  const members = await guild.members.fetch().catch(() => guild.members.cache);
  let bots = 0;
  let humans = 0;
  members.forEach(m => {
    if (m.user.bot) bots += 1;
    else humans += 1;
  });
  return { total: members.size, humans, bots };
}

async function buildServerInfoEmbed(guild) {
  const { total, humans, bots } = await countBotsAndHumans(guild);
  const textChannels = guild.channels.cache.filter(c => c.type === 0).size;
  const voiceChannels = guild.channels.cache.filter(c => c.type === 2).size;
  const categories = guild.channels.cache.filter(c => c.type === 4).size;
  const roles = guild.roles.cache.size;
  const emojis = guild.emojis.cache.size;
  const boosts = guild.premiumSubscriptionCount ?? 0;
  const owner = await guild.fetchOwner().catch(() => null);
  const shardText = guild.shardId != null ? `${guild.shardId + 1}/${guild.client.shard?.count || 1}` : 'N/A';

  const embed = new EmbedBuilder()
    .setColor(Colors.DarkButNotBlack)
    .setTitle(guild.name)
    .setThumbnail(guildIconUrl(guild) || null)
    .setDescription(`Server created on <t:${Math.floor(guild.createdTimestamp / 1000)}:D> (<t:${Math.floor(guild.createdTimestamp / 1000)}:R>)\n${guild.name} is on bot shard ID: **${shardText}**`)
    .addFields(
      { name: 'Owner', value: owner ? `${owner.user.tag}` : 'Unknown', inline: false },
      { name: 'Members', value: `Total: **${total}**\nHumans: **${humans}**\nBots: **${bots}**`, inline: false },
      { name: 'Information', value: `Verification: **${guild.verificationLevel}**\nBoosts: **${boosts}** (level ${guild.premiumTier})`, inline: false },
      { name: 'Design', value: `Splash: ${guild.splash ? 'Click here' : 'N/A'}\nBanner: ${guildBannerUrl(guild) ? '[Click here](' + guildBannerUrl(guild) + ')' : 'N/A'}\nIcon: ${guildIconUrl(guild) ? '[Click here](' + guildIconUrl(guild) + ')' : 'N/A'}`, inline: false },
      { name: 'Channels', value: `Text: **${textChannels}**\nVoice: **${voiceChannels}**\nCategory: **${categories}**`, inline: false },
      { name: 'Counts', value: `Roles: **${roles}**\nEmojis: **${emojis}**\nBoosters: **${boosts}**`, inline: false }
    )
    .setFooter({ text: `Guild ID: ${guild.id}` })
    .setTimestamp();

  return embed;
}

module.exports = { buildServerInfoEmbed };
