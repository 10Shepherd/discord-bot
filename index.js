const {
  Client,
  IntentsBitField,
  EmbedBuilder,
  REST,
  Routes,
  PermissionFlagsBits,
} = require("discord.js");
const { createLogger, format, transports } = require("winston");
const fs = require("fs");
require("dotenv").config();

// Validate environment variables
const requiredEnvVars = [
  "TOKEN",
  "CLIENT_ID",
  "VERIFIED_ROLE_ID",
  "LOG_CHANNEL_ID",
  "WELCOME_CHANNEL_ID",
];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Missing ${envVar} in .env file.`);
    process.exit(1);
  }
}

// Initialize logger
const logger = createLogger({
  level: "info",
  format: format.combine(format.timestamp(), format.json()),
  transports: [
    new transports.Console(),
    new transports.File({ filename: "bot.log" }),
  ],
});

// Create client instance
const client = new Client({
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.MessageContent,
    IntentsBitField.Flags.GuildMembers,
  ],
});

// Load commands
const commands = [];
const commandFiles = fs
  .readdirSync("./commands")
  .filter((file) => file.endsWith(".js"));
for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  commands.push(command.data.toJSON());
}

// Register slash commands
const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

(async () => {
  try {
    logger.info("Started refreshing global application (/) commands.");
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), {
      body: commands,
    });
    // For guild-specific commands (uncomment for testing):
    // await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, "your_guild_id"), {
    //   body: commands,
    // });
    logger.info("Successfully reloaded global application (/) commands.");
  } catch (error) {
    logger.error(`Failed to register commands: ${error.message}`);
  }
})();

// Command cooldowns
const cooldowns = new Map();

// Event: Bot is ready
client.on("ready", () => {
  logger.info(`Logged in as ${client.user.tag}`);

  // Set custom status
  client.user.setPresence({
    activities: [
      {
        name: "Over MDRP Members", // Custom status text
        type: 3, // 0 = Playing, 1 = Streaming, 2 = Listening, 3 = Watching, 4 = Custom, 5 = Competing
      },
    ],
    status: "online", // Can be 'online', 'idle', 'dnd', or 'invisible'
  });
});

// Event: Handle rate limits
client.on("rateLimited", (rateLimitInfo) => {
  logger.warn(`Rate limit hit: ${JSON.stringify(rateLimitInfo)}`);
});

// Event: Handle new member joining
client.on("guildMemberAdd", async (member) => {
  const welcomeChannel = member.guild.channels.cache.get(
    process.env.WELCOME_CHANNEL_ID
  );

  // Check if welcome channel exists and is text-based
  if (!welcomeChannel || !welcomeChannel.isTextBased()) {
    logger.warn(
      `Welcome channel ${process.env.WELCOME_CHANNEL_ID} not found or is not text-based.`
    );
    return;
  }

  // Check permissions
  if (
    !welcomeChannel
      .permissionsFor(client.user)
      .has(["SendMessages", "EmbedLinks"])
  ) {
    logger.warn(
      `Missing permissions to send welcome message in channel ${process.env.WELCOME_CHANNEL_ID}`
    );
    return;
  }

  try {
    // Create welcome embed
    const welcomeEmbed = new EmbedBuilder()
      .setTitle("Welcome!")
      .setDescription(
        `Hello ${member.user.tag}, 
        welcome to **${member.guild.name}**! We're thrilled to have you here. Please verify yourself to gain access to the server from <#1336391080173768805>.
        Make Sure to read the rules in <#1336390288801005598> and enjoy your stay!`
      )
      .setColor(0x4b0066)
      .setThumbnail(member.user.displayAvatarURL())
      .setFooter({ text: "MDRP Welcome System" })
      .setTimestamp();
    // Optional: Add an image (uncomment and replace with a valid image URL)
    // .setImage("https://example.com/welcome-image.png");

    await welcomeChannel.send({ embeds: [welcomeEmbed] });

    // Log the join event
    const logChannel = member.guild.channels.cache.get(
      process.env.LOG_CHANNEL_ID
    );
    if (logChannel) {
      if (
        !logChannel
          .permissionsFor(client.user)
          .has(["SendMessages", "EmbedLinks"])
      ) {
        logger.warn(
          `Missing permissions to send logs in channel ${process.env.LOG_CHANNEL_ID}`
        );
      } else {
        const logEmbed = new EmbedBuilder()
          .setTitle("New Member Joined")
          .setDescription(`${member.user.tag} joined the server.`)
          .setColor(0x00ff00)
          .addFields({ name: "User ID", value: member.user.id, inline: true })
          .setFooter({ text: "MDRP Join Log" })
          .setTimestamp();
        await logChannel.send({ embeds: [logEmbed] });
      }
    } else {
      logger.warn(`Log channel ${process.env.LOG_CHANNEL_ID} not found.`);
    }
  } catch (error) {
    logger.error(
      `Error sending welcome message for ${member.user.tag}: ${error.message}`
    );
  }
});

// Event: Handle slash command and button interactions
client.on("interactionCreate", async (interaction) => {
  // Handle slash commands
  if (interaction.isChatInputCommand()) {
    const { commandName, user } = interaction;

    // Check cooldown
    const cooldownKey = `${user.id}-${commandName}`;
    const cooldownTime = 5000; // 5 seconds
    if (cooldowns.has(cooldownKey)) {
      const expiration = cooldowns.get(cooldownKey);
      if (Date.now() < expiration) {
        await interaction.reply({
          content: `Please wait ${((expiration - Date.now()) / 1000).toFixed(
            1
          )} seconds before using /${commandName} again.`,
          ephemeral: true,
        });
        return;
      }
    }
    cooldowns.set(cooldownKey, Date.now() + cooldownTime);
    setTimeout(() => cooldowns.delete(cooldownKey), cooldownTime);

    // Find and execute command
    const commandFile = commandFiles.find(
      (file) => file === `${commandName}.js`
    );
    if (!commandFile) {
      logger.warn(`Command ${commandName} not found.`);
      await interaction.reply({
        content: "Error: Command not found.",
        ephemeral: true,
      });
      return;
    }

    const command = require(`./commands/${commandFile}`);
    try {
      await command.execute(
        interaction,
        logger,
        rest,
        commands,
        Routes,
        process.env.CLIENT_ID
      );
    } catch (error) {
      logger.error(`Error executing command ${commandName}: ${error.message}`);
      await interaction.reply({
        content: "An error occurred while executing the command.",
        ephemeral: true,
      });
    }
  }

  // Handle button interactions
  if (interaction.isButton() && interaction.customId === "verify_button") {
    await interaction.deferReply({ ephemeral: true });

    const member = interaction.member;
    const role = interaction.guild.roles.cache.get(
      process.env.VERIFIED_ROLE_ID
    );

    // Check bot permissions
    if (!interaction.guild.members.me.permissions.has("ManageRoles")) {
      logger.error("Missing 'Manage Roles' permission for verification.");
      await interaction.editReply({
        content: "Error: I lack the 'Manage Roles' permission.",
      });
      return;
    }

    // Check role existence
    if (!role) {
      logger.error(`Verified role ${process.env.VERIFIED_ROLE_ID} not found.`);
      await interaction.editReply({
        content: "Error: Verified role not found. Please contact an admin.",
      });
      return;
    }

    // Check if user is already verified
    if (member.roles.cache.has(process.env.VERIFIED_ROLE_ID)) {
      await interaction.editReply({
        content: `${member.user.username}, you are already verified!`,
      });
      return;
    }

    try {
      await member.roles.add(role);

      // Log verification
      const logChannel = interaction.guild.channels.cache.get(
        process.env.LOG_CHANNEL_ID
      );
      if (logChannel) {
        if (
          !logChannel
            .permissionsFor(client.user)
            .has(["SendMessages", "EmbedLinks"])
        ) {
          logger.warn(
            `Missing permissions to send logs in channel ${process.env.LOG_CHANNEL_ID}`
          );
          await interaction.followUp({
            content:
              "Warning: I lack permissions to send logs. Admins have been notified.",
            ephemeral: true,
          });
        } else {
          const logEmbed = new EmbedBuilder()
            .setTitle("User Verified")
            .setDescription(`${member.user.tag} was verified.`)
            .setColor(0x00ff00)
            .addFields({ name: "User ID", value: member.user.id, inline: true })
            .setFooter({ text: "MDRP Verification Log" })
            .setTimestamp();
          await logChannel.send({ embeds: [logEmbed] });
        }
      } else {
        logger.warn(`Log channel ${process.env.LOG_CHANNEL_ID} not found.`);
        await interaction.followUp({
          content: "Warning: Log channel not found. Admins have been notified.",
          ephemeral: true,
        });
      }

      await interaction.editReply({
        content: "You have been verified and received the Verified role!",
      });
    } catch (error) {
      logger.error(
        `Error assigning Verified role to ${member.user.tag}: ${error.message}`
      );
      await interaction.editReply({
        content:
          "Error: Could not assign the Verified role. Please contact an admin.",
      });
    }
  }
});

// Log in to Discord
client.login(process.env.TOKEN).catch((error) => {
  logger.error(`Failed to login: ${error.message}`);
  process.exit(1);
});
