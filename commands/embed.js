const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("embed")
    .setDescription("Creates an embedded message")
    .addStringOption((option) =>
      option.setName("title").setDescription("The title of the embed").setRequired(true)
    )
    .addStringOption((option) =>
      option.setName("description").setDescription("The description of the embed").setRequired(true)
    )
    .addStringOption((option) =>
      option.setName("image").setDescription("URL of an image to include in the embed (optional)").setRequired(false)
    ),
  async execute(interaction, logger) {
    const title = interaction.options.getString("title");
    const description = interaction.options.getString("description");
    const image = interaction.options.getString("image");

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(description)
      .setColor(0x0099ff)
      .setAuthor({
        name: interaction.user.username,
        iconURL: interaction.user.displayAvatarURL(),
      })
      .setFooter({ text: "Created with MDRP | Assistant" })
      .setTimestamp();

    if (image) {
      try {
        const response = await fetch(image);
        if (!response.ok || !response.headers.get("content-type")?.startsWith("image/")) {
          throw new Error("Invalid image");
        }
        embed.setImage(image);
      } catch (error) {
        logger.warn(`Invalid image URL provided by ${interaction.user.tag}: ${image}`);
        await interaction.reply({
          content: "Invalid image URL provided. Embed created without image.",
          ephemeral: true,
        });
        return;
      }
    }

    if (!interaction.channel.permissionsFor(interaction.client.user).has(["SendMessages", "EmbedLinks"])) {
      logger.error(`Missing permissions to send embeds in channel ${interaction.channelId}`);
      await interaction.reply({
        content: "Error: I lack permissions to send embeds in this channel.",
        ephemeral: true,
      });
      return;
    }

    await interaction.reply({ embeds: [embed] });
  },
};