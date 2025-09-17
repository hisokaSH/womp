const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Bannir un membre')
    .addUserOption(option =>
      option.setName('target')
        .setDescription('Le membre à bannir')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Raison du bannissement')
        .setRequired(false)
    ),
  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
      return interaction.reply({ content: 'Tu n’as pas la permission de bannir des membres.', ephemeral: true });
    }
    const target = interaction.options.getUser('target');
    const reason = interaction.options.getString('reason') || 'Pas de raison fournie';

    const member = await interaction.guild.members.fetch(target.id);
    if (!member) {
      return interaction.reply({ content: 'Membre non trouvé.', ephemeral: true });
    }

    try {
      await member.ban({ reason });
      return interaction.reply(`✅ ${target.tag} a été banni. Raison: ${reason}`);
    } catch (err) {
      console.error(err);
      return interaction.reply({ content: 'Impossible de bannir ce membre.', ephemeral: true });
    }
  }
};
