/**
 * Exportação centralizada de todos os modelos
 */

const User = require('./User');
const Podcast = require('./Podcast');
const Musica = require('./Musica');
const Playlist = require('./Playlist');
const Assinatura = require('./Assinatura');
const Favorito = require('./Favorito');
const Historico = require('./Historico');

module.exports = {
  User,
  Podcast,
  Musica,
  Playlist,
  Assinatura,
  Favorito,
  Historico
};

