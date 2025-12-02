const express = require('express');
const router = express.Router();
const metricsController = require('../controllers/metrics.controller');
const { auth, isAdminOnly } = require('../middlewares/auth');

/**
 * RF09 - Rotas de Métricas e Logs
 */

// Métricas gerais (público para monitoramento)
router.get('/system', metricsController.getSystemMetrics);

// Métricas em tempo real
router.get('/realtime', metricsController.getRealtimeMetrics);

// Estatísticas de uso
router.get('/usage', metricsController.getUsageStats);

// Resetar métricas (apenas admin)
router.post('/reset', auth, isAdminOnly, metricsController.resetMetrics);

module.exports = router;

