const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { joinVoiceChannel, getVoiceConnection, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const ytdl = require('ytdl-core');
const ytSearch = require('yt-search');
const scdl = require('soundcloud-downloader').default;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Jouer une chanson (Spotify / YouTube / SoundCloud)')
    .addStringOption(option =>
      option.setName('query')
        .setDescription('Nom ou lien de la chanson')
        .setRequired(true)
    ),
  async execute(interaction, { queue, spotifyApi }) {
    await interaction.deferReply();

    const query = interaction.options.getString('query');
    const guildId = interaction.guildId;
    const voiceChannel = interaction.member.voice.channel;
    if (!voiceChannel) {
      return interaction.editReply('Tu dois être dans un salon vocal pour jouer de la musique.');
    }

    let songInfo = null;
    let song = null;

    // Si c’est un lien Spotify
    if (query.match(/open\.spotify\.com/)) {
      try {
        // extraire l’ID de track
        const trackIdMatch = query.match(/track\/([A-Za-z0-9]+)/);
        if (trackIdMatch) {
          const trackId = trackIdMatch[1];
          const trackData = await spotifyApi.getTrack(trackId);
          const trackName = trackData.body.name + ' ' + trackData.body.artists.map(a => a.name).join(', ');
          // chercher sur YouTube
          const ytResult = await ytSearch(trackName);
          if (ytResult.videos.length > 0) {
            song = { title: ytResult.videos[0].title, url: ytResult.videos[0].url };
          } else {
            return interaction.editReply('Aucune correspondance YouTube trouvée pour ce morceau Spotify.');
          }
        } else {
          return interaction.editReply('Lien Spotify non reconnu.');
        }
      } catch (err) {
        console.error(err);
        return interaction.editReply('Erreur lors de la récupération depuis Spotify.');
      }
    }
    // lien YouTube
    else if (ytdl.validateURL(query)) {
      song = { title: 'YouTube Audio', url: query };
    }
    // lien SoundCloud
    else if (scdl.isValidUrl(query) && query.includes('soundcloud.com')) {
      try {
        const info = await scdl.getInfo(query);
        song = { title: info.title, url: query };
      } catch (err) {
        console.error(err);
        return interaction.editReply('Impossible de récupérer le morceau SoundCloud.');
      }
    }
    // sinon, recherche YouTube
    else {
      const ytResult = await ytSearch(query);
      if (ytResult.videos.length > 0) {
        song = { title: ytResult.videos[0].title, url: ytResult.videos[0].url };
      } else {
        return interaction.editReply('Aucune chanson trouvée avec cette requête.');
      }
    }

    // Gestion de la queue
    if (!queue.has(guildId)) {
      const queueContruct = {
        voiceChannel: voiceChannel,
        connection: null,
        songs: []
      };
      queue.set(guildId, queueContruct);
      queueContruct.songs.push(song);

      try {
        const connection = joinVoiceChannel({
          channelId: voiceChannel.id,
          guildId: guildId,
          adapterCreator: interaction.guild.voiceAdapterCreator
        });
        queueContruct.connection = connection;

        await interaction.editReply(`🎶 Jouer: **${song.title}**`);
        playSong(guildId, queue, interaction);
      } catch (err) {
        console.error(err);
        queue.delete(guildId);
        return interaction.editReply('Erreur de connexion au salon vocal.');
      }
    } else {
      const guildQueue = queue.get(guildId);
      guildQueue.songs.push(song);
      return interaction.editReply(`Ajouté à la queue: **${song.title}**`);
    }
  }
};

async function playSong(guildId, queue, interaction) {
  const guildQueue = queue.get(guildId);
  if (!guildQueue) return;
  const song = guildQueue.songs[0];
  if (!song) {
    // fin de queue
    queue.delete(guildId);
    return;
  }

  const stream = ytdl(song.url, { filter: 'audioonly', highWaterMark: 1 << 25 });
  const resource = createAudioResource(stream);
  const player = createAudioPlayer();

  guildQueue.connection.subscribe(player);
  player.play(resource);

  player.once(AudioPlayerStatus.Idle, () => {
    guildQueue.songs.shift();
    playSong(guildId, queue, interaction);
  });
  player.on('error', error => {
    console.error(error);
    guildQueue.songs.shift();
    playSong(guildId, queue, interaction);
  });
}
