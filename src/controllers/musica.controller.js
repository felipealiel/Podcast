const Musica = require('../models/Musica');
const fs = require('fs');
const path = require('path');
const databaseManager = require('../config/database');
const { getAudioInfo } = require('../utils/audioProcessor'); // Removido transcodeAudio
const logger = require('../utils/logger');

/**
 * RF02 - Upload, armazenamento e reprodução de conteúdos
 * Controller para gerenciar músicas (produtores)
 */

/**
 * Upload de música (apenas produtores)
 */
const uploadMusica = async (req, res) => {
  try {
    const usuarioId = req.user._id;
    
    // Log para debug
    logger.debug('Iniciando upload de música', {
      userId: usuarioId.toString(),
      hasFiles: !!req.files,
      hasFile: !!req.file,
      filesKeys: req.files ? Object.keys(req.files) : [],
      bodyKeys: Object.keys(req.body)
    });

    const {
      titulo,
      autor,
      ano,
      genero,
      album,
      letra,
      tags,
      permiteDownload,
      permiteStreaming,
      permiteCompartilhamento,
      visibilidade
    } = req.body;

    // Verificar se arquivo foi enviado
    // uploadMusicWithCover usa .fields(), então os arquivos vêm em req.files
    const arquivoEnviado = req.files && req.files.arquivo && req.files.arquivo[0] 
      ? req.files.arquivo[0] 
      : (req.file ? req.file : null);
    
    if (!arquivoEnviado) {
      logger.warn('Tentativa de upload sem arquivo', {
        userId: usuarioId.toString(),
        hasFiles: !!req.files,
        hasFile: !!req.file
      });
      return res.status(400).json({
        success: false,
        message: 'Arquivo de áudio é obrigatório. Envie o arquivo com o campo "arquivo".',
        hint: 'Certifique-se de usar multipart/form-data e o campo deve se chamar "arquivo"'
      });
    }

    // Validar campos obrigatórios
    if (!titulo || !autor || !ano || !genero) {
      // Remover arquivo enviado se houver erro
      if (arquivoEnviado && fs.existsSync(arquivoEnviado.path)) {
        fs.unlinkSync(arquivoEnviado.path);
      }
      return res.status(400).json({
        success: false,
        message: 'Título, autor, ano e gênero são obrigatórios'
      });
    }

    // Processar arquivo
    const arquivoPath = arquivoEnviado.path;
    const arquivoStats = fs.statSync(arquivoPath);
    const arquivoUrl = `/uploads/musics/${path.basename(arquivoPath)}`;
    const arquivoExt = path.extname(arquivoEnviado.originalname).toLowerCase().replace('.', '');

    // Obter informações do áudio (com timeout para evitar travamento)
    let audioInfo = null;
    try {
      // Adicionar timeout de 10 segundos para evitar travamento
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout ao obter informações do áudio')), 10000);
      });
      
      audioInfo = await Promise.race([
        getAudioInfo(arquivoPath),
        timeoutPromise
      ]);
      
      logger.info('Informações do áudio obtidas', { 
        duracao: audioInfo.duration, 
        bitrate: audioInfo.bitrate 
      });
    } catch (error) {
      logger.warn('Erro ao obter informações do áudio, usando valores padrão', { 
        error: error.message,
        stack: error.stack 
      });
      // Usar valores padrão - não bloquear o upload
      audioInfo = {
        duration: 0,
        bitrate: 0,
        sampleRate: 44100
      };
    }

    // Processar capa se fornecida
    let capa = null;
    if (req.files && req.files.capa && req.files.capa[0]) {
      const capaPath = req.files.capa[0].path;
      const capaUrl = `/uploads/covers/${path.basename(capaPath)}`;
      capa = {
        filename: path.basename(capaPath),
        path: capaPath,
        url: capaUrl
      };
    }

    // Criar música - APENAS informações (sem paths locais no banco)
    const musica = new Musica({
      titulo,
      autor,
      ano: parseInt(ano),
      genero,
      album: album || null,
      letra: letra || null,
      tags: tags ? (Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim())) : [],
      duracao: audioInfo.duration,
      arquivo: {
        filename: path.basename(arquivoPath),
        // path: arquivoPath, // NÃO salvar path no banco - apenas local
        url: arquivoUrl, // URL para acesso via HTTP
        tamanho: arquivoStats.size,
        formato: arquivoExt,
        bitrate: audioInfo.bitrate,
        sampleRate: audioInfo.sampleRate
      },
      capa: capa ? {
        filename: capa.filename,
        // path: capa.path, // NÃO salvar path no banco
        url: capa.url // URL para acesso via HTTP
      } : null,
      status: 'ativo',
      visibilidade: visibilidade || 'publico',
      upload: {
        usuarioId,
        dataUpload: new Date(),
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.headers['user-agent']
      },
      configuracoes: {
        permiteDownload: permiteDownload !== 'false',
        permiteStreaming: permiteStreaming !== 'false',
        permiteCompartilhamento: permiteCompartilhamento !== 'false',
        permiteAdicionarPlaylist: true
      }
    });
    
    // Armazenar path localmente (não no banco) para uso no servidor
    musica._localPaths = {
      arquivo: arquivoPath,
      capa: capa?.path || null
    };

    // ENVIAR RESPOSTA PRIMEIRO (antes de salvar no banco)
    // Isso garante que o cliente receba a resposta mesmo se houver erro no banco
    const respostaEnviada = false;
    
    // Preparar resposta
    const resposta = {
      success: true,
      message: 'Música enviada com sucesso',
      data: {
        id: musica._id?.toString() || 'pending',
        titulo: musica.titulo,
        autor: musica.autor,
        url: musica.arquivo.url,
        capaUrl: musica.capa?.url || null
      }
    };
    
    // Salvar no banco de forma assíncrona (não bloqueia resposta)
    let musicaId = musica._id;
    
    // Função para salvar no banco (executada em background)
    const salvarNoBanco = async () => {
      try {
        // Salvar usando o modelo diretamente (apenas no PRIMARY)
        await musica.save();
        musicaId = musica._id;
        
        logger.info('Música salva no banco com sucesso', {
          musicaId: musicaId.toString(),
          titulo: musica.titulo,
          arquivoUrl: musica.arquivo.url
        });
      } catch (dbError) {
        logger.error('Erro ao salvar música no banco de dados', dbError, {
          userId: usuarioId.toString(),
          titulo: musica.titulo,
          error: dbError.message
        });
        
        // Limpar arquivos em caso de erro no banco
        if (musica._localPaths?.arquivo && fs.existsSync(musica._localPaths.arquivo)) {
          try {
            fs.unlinkSync(musica._localPaths.arquivo);
          } catch (err) {
            logger.error('Erro ao remover arquivo após falha no banco', err);
          }
        }
        
        if (musica._localPaths?.capa && fs.existsSync(musica._localPaths.capa)) {
          try {
            fs.unlinkSync(musica._localPaths.capa);
          } catch (err) {
            logger.error('Erro ao remover capa após falha no banco', err);
          }
        }
      }
    };
    
    // Executar salvamento em background (não bloqueia)
    setImmediate(salvarNoBanco);

    // Registrar upload
    logger.logUpload(usuarioId.toString(), 'musica', arquivoStats.size, true);

    // Enviar resposta IMEDIATAMENTE
    res.status(201).json(resposta);
    
    // Garantir que a resposta foi enviada e não há mais código executando
    return;
  } catch (error) {
    // Limpar arquivos em caso de erro
    const arquivoEnviado = req.files && req.files.arquivo && req.files.arquivo[0] 
      ? req.files.arquivo[0] 
      : (req.file ? req.file : null);
    
    if (arquivoEnviado && fs.existsSync(arquivoEnviado.path)) {
      try {
        fs.unlinkSync(arquivoEnviado.path);
      } catch (err) {
        console.error('Erro ao remover arquivo:', err);
        logger.error('Erro ao remover arquivo', err);
      }
    }
    if (req.files && req.files.capa && req.files.capa[0] && fs.existsSync(req.files.capa[0].path)) {
      try {
        fs.unlinkSync(req.files.capa[0].path);
      } catch (err) {
        console.error('Erro ao remover capa:', err);
        logger.error('Erro ao remover capa', err);
      }
    }

    logger.error('Erro ao fazer upload da música', error, {
      userId: req.user?._id?.toString(),
      titulo: req.body.titulo
    });

    res.status(500).json({
      success: false,
      message: 'Erro ao fazer upload da música',
      error: error.message,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
  }
};

/**
 * Listar minhas músicas (produtor)
 */
const minhasMusicas = async (req, res) => {
  try {
    const usuarioId = req.user._id;
    const { limit = 20, skip = 0, status } = req.query;

    const query = { 'upload.usuarioId': usuarioId };
    if (status) query.status = status;

    const musicas = await Musica.find(query)
      .sort({ 'upload.dataUpload': -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip));

    const total = await Musica.countDocuments(query);

    res.json({
      success: true,
      data: musicas,
      pagination: {
        total,
        limit: parseInt(limit),
        skip: parseInt(skip),
        hasMore: total > parseInt(skip) + parseInt(limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar músicas',
      error: error.message
    });
  }
};

/**
 * Atualizar música
 */
const atualizarMusica = async (req, res) => {
  try {
    const { id } = req.params;
    const usuarioId = req.user._id;
    const {
      titulo,
      autor,
      ano,
      genero,
      album,
      letra,
      tags,
      visibilidade,
      status
    } = req.body;

    const musica = await Musica.findById(id);

    if (!musica) {
      return res.status(404).json({
        success: false,
        message: 'Música não encontrada'
      });
    }

    // Verificar permissão
    if (musica.upload.usuarioId.toString() !== usuarioId.toString() && 
        req.user.account.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Você não tem permissão para editar esta música'
      });
    }

    // Atualizar campos
    if (titulo) musica.titulo = titulo;
    if (autor) musica.autor = autor;
    if (ano) musica.ano = parseInt(ano);
    if (genero) musica.genero = genero;
    if (album !== undefined) musica.album = album;
    if (letra !== undefined) musica.letra = letra;
    if (tags) musica.tags = Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim());
    if (visibilidade) musica.visibilidade = visibilidade;
    if (status && req.user.account.role === 'admin') musica.status = status;

    // Replicar atualização
    await databaseManager.writeToAllClusters(
      'musicas',
      'updateOne',
      { _id: musica._id },
      { $set: musica.toObject() }
    );

    res.json({
      success: true,
      message: 'Música atualizada com sucesso',
      data: musica
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar música',
      error: error.message
    });
  }
};

/**
 * Deletar música
 */
const deletarMusica = async (req, res) => {
  try {
    const { id } = req.params;
    const usuarioId = req.user._id;

    const musica = await Musica.findById(id);

    if (!musica) {
      return res.status(404).json({
        success: false,
        message: 'Música não encontrada'
      });
    }

    // Verificar permissão
    if (musica.upload.usuarioId.toString() !== usuarioId.toString() && 
        req.user.account.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Você não tem permissão para deletar esta música'
      });
    }

    // Remover arquivos físicos
    if (musica.arquivo && musica.arquivo.path && fs.existsSync(musica.arquivo.path)) {
      try {
        fs.unlinkSync(musica.arquivo.path);
      } catch (err) {
        console.error('Erro ao remover arquivo de áudio:', err);
      }
    }

    if (musica.capa && musica.capa.path && fs.existsSync(musica.capa.path)) {
      try {
        fs.unlinkSync(musica.capa.path);
      } catch (err) {
        console.error('Erro ao remover capa:', err);
      }
    }

    // Marcar como removida ou deletar
    if (req.user.account.role === 'admin') {
      // Admin pode deletar permanentemente
      await databaseManager.writeToAllClusters(
        'musicas',
        'deleteOne',
        { _id: musica._id }
      );
    } else {
      // Produtor marca como removida
      musica.status = 'removido';
      await databaseManager.writeToAllClusters(
        'musicas',
        'updateOne',
        { _id: musica._id },
        { $set: { status: 'removido' } }
      );
    }

    res.json({
      success: true,
      message: 'Música deletada com sucesso'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro ao deletar música',
      error: error.message
    });
  }
};

/**
 * Buscar música por ID
 */
const buscarMusica = async (req, res) => {
  try {
    const { id } = req.params;

    const musica = await Musica.findById(id)
      .populate('upload.usuarioId', 'nomeUsuario profile.avatar');

    if (!musica || musica.status !== 'ativo') {
      return res.status(404).json({
        success: false,
        message: 'Música não encontrada'
      });
    }

    // Verificar visibilidade
    if (musica.visibilidade === 'privado' && 
        (!req.user || musica.upload.usuarioId._id.toString() !== req.user._id.toString())) {
      return res.status(403).json({
        success: false,
        message: 'Esta música é privada'
      });
    }

    res.json({
      success: true,
      data: musica
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar música',
      error: error.message
    });
  }
};

module.exports = {
  uploadMusica,
  minhasMusicas,
  atualizarMusica,
  deletarMusica,
  buscarMusica
};

