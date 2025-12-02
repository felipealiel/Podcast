const express = require('express');
const router = express.Router();
const playlistController = require('../controllers/playlist.controller');
const { auth, optionalAuth } = require('../middlewares/auth');

/**
 * RF06 - Rotas de Playlists
 */

// Rotas públicas
router.get('/publicas', playlistController.buscarPublicas);

// Rotas autenticadas
router.post('/', auth, playlistController.criarPlaylist);
router.get('/minhas', auth, playlistController.minhasPlaylists);
router.get('/:id', optionalAuth, playlistController.buscarPlaylist);
router.put('/:id', auth, playlistController.atualizarPlaylist);
router.delete('/:id', auth, playlistController.deletarPlaylist);

// Rotas de música na playlist
router.post('/:id/musicas', auth, playlistController.adicionarMusica);
router.delete('/:id/musicas/:musicaId', auth, playlistController.removerMusica);

module.exports = router;

