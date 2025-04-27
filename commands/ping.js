const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Checks the bot's latency"),
  async execute(interaction) {
    await interaction.reply({
      content: `Pong! Latency: ${Math.round(interaction.client.ws.ping)}ms`,
      ephemeral: true,
    });
  },
};