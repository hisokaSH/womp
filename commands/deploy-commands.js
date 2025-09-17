require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

const commands = [];
const commandsPath = path.join(__dirname);
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js') && file !== 'deploy-commands.js');

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  if ('data' in command && command.data.toJSON) {
    commands.push(command.data.toJSON());
  }
}

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('Déploiement des slash commands...');
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );
    console.log('Slash commands déployées avec succès.');
  } catch (error) {
    console.error(error);
  }
})();
