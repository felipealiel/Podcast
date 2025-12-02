const express = require('express');
const router = express.Router();
const streamingController = require('../controllers/streaming.controller');
const { auth, optionalAuth } = require('../middlewares/auth');

/**
 * RF02 - Rotas de Streaming e Download
 */

// Streaming de áudio (público, mas requer autenticação para histórico)
router.get('/stream/:id', optionalAuth, streamingController.streamAudio);

// Download de música (requer autenticação)
router.get('/download/:id', auth, streamingController.downloadAudio);

// Metadados do áudio
router.get('/metadata/:id', optionalAuth, streamingController.getAudioMetadata);

module.exports = router;

