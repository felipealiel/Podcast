const express = require('express');
const router = express.Router();
const recomendacaoController = require('../controllers/recomendacao.controller');
const { auth, optionalAuth } = require('../middlewares/auth');

/**
 * RF05 - Rotas de Recomendações Personalizadas
 */

// Recomendações personalizadas (requer autenticação)
router.get('/', auth, recomendacaoController.getRecomendacoes);

// Recomendações baseadas em uma música
router.get('/musica/:id', optionalAuth, recomendacaoController.getRecomendacoesPorMusica);

// Recomendações de playlists
router.get('/playlists', optionalAuth, recomendacaoController.getRecomendacoesPlaylists);

module.exports = router;

