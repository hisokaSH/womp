require('dotenv').config(); // Charger .env en premier
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { joinVoiceChannel, AudioPlayerStatus, createAudioPlayer, createAudioResource, getVoiceConnection } = require('@discordjs/voice');
const ytdl = require('ytdl-core');
const ytSearch = require('yt-search');
const SpotifyWebApi = require('spotify-web-api-node');

console.log("✅ Variables d'environnement chargées :");
console.log("DISCORD_TOKEN:", process.env.DISCORD_TOKEN ? "✅" : "❌");
console.log("SPOTIFY_CLIENT_ID:", process.env.SPOTIFY_CLIENT_ID ? "✅" : "❌");
console.log("SAVE_CLIENT_ID:", process.env.SAVE_CLIENT_ID); // Devrait être 'true' ou 'false'

// Charger SoundCloud-downloader après .env
let scdl;
try {
  scdl = require('soundcloud-downloader').default;
  console.log("✅ soundcloud-downloader chargé avec succès");
} catch (error) {
  console.error("❌ Erreur lors du chargement de soundcloud-downloader :", error);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates
  ]
});

// Pour stocker les commandes slash
client.commands = new Collection();

// Lecture des fichiers de commande
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js') && file !== 'deploy-commands.js');

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  if ('data' in command && 'execute' in command) {
    client.commands.set(command.data.name, command);
  } else {
    console.log(`[⚠️ WARNING] La commande ${file} est mal formatée.`);
  }
}

// Setup Spotify API (client credentials)
const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET
});

// on récupère le token d’accès
spotifyApi.clientCredentialsGrant().then(data => {
  spotifyApi.setAccessToken(data.body['access_token']);
  console.log('🎵 Spotify token prêt');
}).catch(err => {
  console.error('❌ Erreur lors de l’accès Spotify', err);
});

// Map pour garder la queue de chaque guild
const queue = new Map();

client.once('ready', () => {
  console.log(`🤖 Connecté comme ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction, { queue, spotifyApi, scdl });
  } catch (error) {
    console.error(error);
    await interaction.reply({ content: '❌ Il y a eu une erreur lors de l’exécution de cette commande!', ephemeral: true });
  }
});

client.login(process.env.DISCORD_TOKEN);
