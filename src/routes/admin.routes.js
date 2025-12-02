const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { auth, isAdminOnly } = require('../middlewares/auth');

/**
 * RF07 - Rotas de Administração e Permissões
 * Todas as rotas requerem autenticação e permissão de admin
 */

// Gerenciamento de permissões
router.post('/promover-produtor/:userId', auth, isAdminOnly, adminController.promoverProdutor);
router.post('/promover-admin/:userId', auth, isAdminOnly, adminController.promoverAdmin);
router.post('/remover-produtor/:userId', auth, isAdminOnly, adminController.removerProdutor);
router.get('/produtores', auth, isAdminOnly, adminController.listarProdutores);

// Moderação de conteúdo
router.post('/moderar/:tipo/:id', auth, isAdminOnly, adminController.moderarConteudo);
router.get('/pendentes', auth, isAdminOnly, adminController.listarPendentes);

// Estatísticas
router.get('/estatisticas', auth, isAdminOnly, adminController.estatisticasAdmin);

module.exports = router;

