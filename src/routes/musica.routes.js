const express = require('express');
const router = express.Router();
const multer = require('multer');
const musicaController = require('../controllers/musica.controller');
const { auth, isProducer, optionalAuth } = require('../middlewares/auth');
const { uploadMusicWithCover } = require('../utils/upload');

/**
 * RF02 - Rotas de Upload e Gerenciamento de Músicas
 */

// Rotas públicas
router.get('/:id', optionalAuth, musicaController.buscarMusica);

// Middleware para tratar erros do multer
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'Arquivo muito grande. Tamanho máximo: 100MB'
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Muitos arquivos enviados'
      });
    }
    return res.status(400).json({
      success: false,
      message: `Erro no upload: ${err.message}`
    });
  }
  if (err) {
    return res.status(400).json({
      success: false,
      message: err.message || 'Erro ao processar arquivo'
    });
  }
  next();
};

// Rotas para produtores (requer autenticação e role de produtor)
router.post('/upload', auth, isProducer, uploadMusicWithCover, handleMulterError, musicaController.uploadMusica);
router.get('/minhas/listar', auth, isProducer, musicaController.minhasMusicas);
router.put('/:id', auth, isProducer, musicaController.atualizarMusica);
router.delete('/:id', auth, isProducer, musicaController.deletarMusica);

module.exports = router;

