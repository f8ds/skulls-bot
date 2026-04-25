function registerSnipe(client) {
  client.snipes = new Map();

  client.on('messageDelete', message => {
    if (!message.guild || message.author?.bot) return;
    client.snipes.set(message.channel.id, {
      content: message.content || '*no text*',
      author: message.author?.tag || 'Unknown',
      authorId: message.author?.id || null,
      image: message.attachments.first()?.url || null,
      deletedAt: Date.now(),
      deletedBy: null
    });
  });

  client.on('messageDeleteBulk', messages => {
    for (const message of messages.values()) {
      if (!message.guild || message.author?.bot) continue;
      client.snipes.set(message.channel.id, {
        content: message.content || '*no text*',
        author: message.author?.tag || 'Unknown',
        authorId: message.author?.id || null,
        image: message.attachments.first()?.url || null,
        deletedAt: Date.now(),
        deletedBy: null
      });
    }
  });
}

function buildSnipeEmbed({ channel, snipe }) {
  const { EmbedBuilder, Colors } = require('discord.js');
  return new EmbedBuilder()
    .setColor(Colors.Orange)
    .setTitle(`Deleted message in #${channel.name}`)
    .setDescription(snipe.content || '*no text*')
    .addFields(
      { name: 'Said by', value: snipe.author || 'Unknown', inline: true },
      { name: 'Deleted', value: `<t:${Math.floor(snipe.deletedAt / 1000)}:R>`, inline: true }
    )
    .setFooter({ text: `Channel ID: ${channel.id}` })
    .setTimestamp();
}

async function handleSnipeCommand(message, client) {
  const snipe = client.snipes?.get(message.channel.id);
  if (!snipe) return message.reply('nothing to snipe in this channel.');
  return message.reply({ embeds: [buildSnipeEmbed({ channel: message.channel, snipe })] });
}

async function handleClearSnipes(message, client) {
  client.snipes?.delete(message.channel.id);
  return message.reply('cleared sniped deleted messages in this channel.');
}

module.exports = { registerSnipe, handleSnipeCommand, handleClearSnipes };
