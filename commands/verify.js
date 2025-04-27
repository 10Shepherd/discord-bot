const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("verify")
    .setDescription("Start the verification process"),
  async execute(interaction, logger) {
    const embed = new EmbedBuilder()
      .setTitle("Verification")
      .setDescription("Click the button below to verify and gain access to the server!")
      .setColor(0x00ff00)
      .setFooter({ text: "MDRP Verification System" })
      .setTimestamp();

    const verifyButton = new ButtonBuilder()
      .setCustomId("verify_button")
      .setLabel("Verify")
      .setStyle(ButtonStyle.Success);

    const row = new ActionRowBuilder().addComponents(verifyButton);

    if (!interaction.channel.permissionsFor(interaction.client.user).has(["SendMessages", "EmbedLinks"])) {
      logger.error(`Missing permissions to send verification embed in channel ${interaction.channelId}`);
      await interaction.reply({
        content: "Error: I lack permissions to send embeds in this channel.",
        ephemeral: true,
      });
      return;
    }

    await interaction.reply({ embeds: [embed], components: [row] });
  },
};