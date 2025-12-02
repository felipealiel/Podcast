const express = require('express');
const router = express.Router();
const buscaController = require('../controllers/busca.controller');
const { optionalAuth } = require('../middlewares/auth');

/**
 * RF03 - Rotas de Busca e Filtragem
 */

// Todas as rotas são públicas (mas podem usar autenticação opcional para recomendações)
router.get('/', optionalAuth, buscaController.buscar);
router.get('/musicas', optionalAuth, buscaController.buscarMusicas);
router.get('/genero/:genero', buscaController.buscarPorGenero);
router.get('/autor/:autor', buscaController.buscarPorAutor);
router.get('/populares', buscaController.maisPopulares);
router.get('/recentes', buscaController.recentes);
router.get('/recomendacoes', optionalAuth, buscaController.recomendacoes);

module.exports = router;

