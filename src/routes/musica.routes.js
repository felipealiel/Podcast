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
  // Verificar se a resposta já foi enviada
  if (res.headersSent) {
    console.warn('Erro do multer após resposta enviada:', err.message);
    return next(err);
  }
  
  try {
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
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({
          success: false,
          message: 'Campo de arquivo inesperado. Use "arquivo" para música e "capa" para imagem.'
        });
      }
      return res.status(400).json({
        success: false,
        message: `Erro no upload: ${err.message}`
      });
    }
    if (err) {
      // Erro de validação de tipo de arquivo
      if (err.message && (err.message.includes('Formato') || err.message.includes('não suportado'))) {
        return res.status(400).json({
          success: false,
          message: err.message
        });
      }
      return res.status(400).json({
        success: false,
        message: err.message || 'Erro ao processar arquivo'
      });
    }
    next();
  } catch (sendError) {
    // Se não conseguir enviar resposta, apenas logar e passar para próximo middleware
    console.error('Erro crítico ao enviar resposta de erro do multer:', sendError);
    next(err);
  }
};

// Wrapper para capturar erros do multer antes de chegar ao controller
const uploadMiddleware = (req, res, next) => {
  console.log('📥 [MULTER] Iniciando processamento de upload...');
  console.log('📥 [MULTER] Headers:', {
    'content-type': req.headers['content-type'],
    'content-length': req.headers['content-length']
  });
  
  // Adicionar timeout na requisição para evitar travamento
  const timeout = setTimeout(() => {
    if (!res.headersSent) {
      console.warn('⏱️ [MULTER] Timeout do upload');
      res.status(408).json({
        success: false,
        message: 'Tempo limite do upload excedido'
      });
    }
  }, 300000); // 5 minutos
  
  let uploadCompleted = false;
  let uploadError = null;
  
  // Limpar timeout quando a requisição terminar
  res.on('finish', () => {
    clearTimeout(timeout);
    if (uploadCompleted && !uploadError) {
      console.log('✅ [MULTER] Upload processado com sucesso');
    } else if (uploadError) {
      console.log('❌ [MULTER] Upload finalizado com erro');
    }
  });
  res.on('close', () => {
    clearTimeout(timeout);
    if (!uploadCompleted) {
      console.log('🔌 [MULTER] Conexão fechada antes de completar');
    }
  });
  
  uploadMusicWithCover(req, res, (err) => {
    clearTimeout(timeout);
    
    if (err) {
      uploadError = err;
      console.error('❌ [MULTER] Erro no processamento:', err.message);
      console.error('❌ [MULTER] Tipo do erro:', err.constructor.name);
      
      // Garantir que a resposta de erro seja enviada
      if (!res.headersSent) {
        return handleMulterError(err, req, res, next);
      } else {
        console.error('⚠️ [MULTER] Resposta já enviada, não é possível enviar erro');
        return next(err);
      }
    }
    
    uploadCompleted = true;
    
    // Log dos arquivos recebidos
    console.log('📦 [MULTER] Arquivos recebidos:', {
      hasFiles: !!req.files,
      hasFile: !!req.file,
      filesKeys: req.files ? Object.keys(req.files) : [],
      arquivo: req.files?.arquivo ? {
        name: req.files.arquivo[0]?.originalname,
        mimetype: req.files.arquivo[0]?.mimetype,
        size: req.files.arquivo[0]?.size
      } : 'não encontrado',
      capa: req.files?.capa ? req.files.capa[0]?.originalname : 'não encontrado',
      body: Object.keys(req.body)
    });
    
    next();
  });
};

// Rotas para produtores (requer autenticação e role de produtor)
router.post('/upload', auth, isProducer, uploadMiddleware, musicaController.uploadMusica);
router.get('/minhas/listar', auth, isProducer, musicaController.minhasMusicas);
router.put('/:id', auth, isProducer, musicaController.atualizarMusica);
router.delete('/:id', auth, isProducer, musicaController.deletarMusica);

module.exports = router;

