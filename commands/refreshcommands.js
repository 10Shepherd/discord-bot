const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("refreshcommands")
    .setDescription("Refreshes global application commands (Admin only)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction, logger, rest, commands, Routes, clientId) {
    if (!interaction.member.permissions.has("Administrator")) {
      await interaction.reply({
        content: "You need Administrator permissions to use this command.",
        ephemeral: true,
      });
      return;
    }

    try {
      await rest.put(Routes.applicationCommands(clientId), {
        body: commands,
      });
      logger.info(`Global commands refreshed by ${interaction.user.tag}`);
      await interaction.reply({
        content: "Successfully refreshed global application commands.",
        ephemeral: true,
      });
    } catch (error) {
      logger.error(`Failed to refresh commands: ${error.message}`);
      await interaction.reply({
        content: "Failed to refresh commands. Check logs for details.",
        ephemeral: true,
      });
    }
  },
};