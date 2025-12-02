const express = require('express');
const router = express.Router();
const historicoController = require('../controllers/historico.controller');
const { auth } = require('../middlewares/auth');

/**
 * RF04 - Rotas de Histórico e Preferências
 */

// Todas as rotas requerem autenticação
router.post('/reproducao', auth, historicoController.registrarReproducao);
router.get('/meu', auth, historicoController.meuHistorico);
router.get('/recentes', auth, historicoController.reproducoesRecentes);
router.get('/mais-reproduzidas', auth, historicoController.maisReproduzidas);
router.get('/preferencias', auth, historicoController.minhasPreferencias);
router.delete('/limpar', auth, historicoController.limparHistorico);

module.exports = router;

