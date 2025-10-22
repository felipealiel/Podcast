/**
 * Exportação centralizada de todos os modelos
 */

const User = require('./User');
const Podcast = require('./Podcast');
const Musica = require('./Musica');
const Playlist = require('./Playlist');
const Assinatura = require('./Assinatura');

module.exports = {
  User,
  Podcast,
  Musica,
  Playlist,
  Assinatura
};

