const express = require('express');
const router = express.Router();
const favoritoController = require('../controllers/favorito.controller');
const { auth } = require('../middlewares/auth');

/**
 * RF06 - Rotas de Favoritos
 */

// Todas as rotas requerem autenticação
// Rotas específicas primeiro (antes das rotas com parâmetros)
router.post('/', auth, favoritoController.adicionarFavorito);
router.get('/meus', auth, favoritoController.meusFavoritos);
router.get('/verificar/:musicaId', auth, favoritoController.verificarFavorito);

// Rotas com parâmetros depois
// IMPORTANTE: Esta rota deve vir DEPOIS das rotas específicas
router.post('/:musicaId', auth, favoritoController.toggleFavorito); // Toggle favorito (adicionar/remover)
router.put('/:musicaId/nota', auth, favoritoController.atualizarNota);
router.delete('/:musicaId', auth, favoritoController.removerFavorito);

module.exports = router;

