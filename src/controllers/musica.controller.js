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
  const startTime = Date.now();
  console.log('🚀 [UPLOAD LOCAL] Iniciando upload de música (apenas local, sem banco)');
  
  try {
    const usuarioId = req.user._id;
    
    // Log para debug
    console.log('📋 [UPLOAD LOCAL] Dados recebidos:', {
      userId: usuarioId.toString(),
      hasFiles: !!req.files,
      hasFile: !!req.file,
      filesKeys: req.files ? Object.keys(req.files) : [],
      bodyKeys: Object.keys(req.body),
      titulo: req.body.titulo
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
      console.error('❌ [UPLOAD LOCAL] Arquivo não encontrado!', {
        hasFiles: !!req.files,
        hasFile: !!req.file,
        filesKeys: req.files ? Object.keys(req.files) : [],
        bodyKeys: Object.keys(req.body)
      });
      
      logger.warn('Tentativa de upload sem arquivo', {
        userId: usuarioId.toString(),
        hasFiles: !!req.files,
        hasFile: !!req.file
      });
      
      return res.status(400).json({
        success: false,
        message: 'Arquivo de áudio é obrigatório. Envie o arquivo com o campo "arquivo".',
        hint: 'Certifique-se de usar multipart/form-data e o campo deve se chamar "arquivo"',
        debug: {
          hasFiles: !!req.files,
          hasFile: !!req.file,
          filesKeys: req.files ? Object.keys(req.files) : []
        }
      });
    }
    
    console.log('✅ [UPLOAD LOCAL] Arquivo encontrado:', {
      originalname: arquivoEnviado.originalname,
      mimetype: arquivoEnviado.mimetype,
      size: arquivoEnviado.size,
      path: arquivoEnviado.path
    });

    // Validar campos obrigatórios
    if (!titulo || !autor || !ano || !genero) {
      console.error('❌ [UPLOAD LOCAL] Campos obrigatórios faltando:', {
        titulo: !!titulo,
        autor: !!autor,
        ano: !!ano,
        genero: !!genero,
        body: req.body
      });
      
      // Remover arquivo enviado se houver erro
      if (arquivoEnviado && arquivoEnviado.path && fs.existsSync(arquivoEnviado.path)) {
        try {
          fs.unlinkSync(arquivoEnviado.path);
          console.log('🗑️ [UPLOAD LOCAL] Arquivo removido após erro de validação');
        } catch (err) {
          console.error('❌ [UPLOAD LOCAL] Erro ao remover arquivo:', err);
        }
      }
      
      return res.status(400).json({
        success: false,
        message: 'Título, autor, ano e gênero são obrigatórios',
        missing: {
          titulo: !titulo,
          autor: !autor,
          ano: !ano,
          genero: !genero
        }
      });
    }

    // Processar arquivo
    const arquivoPath = arquivoEnviado.path;
    const arquivoStats = fs.statSync(arquivoPath);
    const arquivoUrl = `/uploads/musics/${path.basename(arquivoPath)}`;
    const arquivoExt = path.extname(arquivoEnviado.originalname).toLowerCase().replace('.', '');

    // Obter informações do áudio (opcional, não bloqueia)
    let audioInfo = {
      duration: 0,
      bitrate: 0,
      sampleRate: 44100
    };
    
    // Tentar obter informações do áudio em background (não bloqueia resposta)
    setImmediate(async () => {
      try {
        const info = await getAudioInfo(arquivoPath);
        console.log('🎵 [UPLOAD LOCAL] Informações de áudio obtidas:', info);
      } catch (err) {
        console.log('⚠️ [UPLOAD LOCAL] Não foi possível obter informações do áudio (não crítico)');
      }
    });

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

    // Criar música para salvar no banco
    const musica = new Musica({
      titulo,
      autor,
      ano: parseInt(ano),
      genero,
      album: album || null,
      letra: letra || null,
      tags: tags ? (Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim())) : [],
      duracao: audioInfo.duration > 0 ? audioInfo.duration : 1,
      arquivo: {
        filename: path.basename(arquivoPath),
        url: arquivoUrl,
        tamanho: arquivoStats.size,
        formato: arquivoExt,
        bitrate: audioInfo.bitrate,
        sampleRate: audioInfo.sampleRate
      },
      capa: capa ? {
        filename: capa.filename,
        url: capa.url
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
    
    console.log('💾 [UPLOAD] Arquivo salvo localmente:', arquivoPath);
    console.log('💾 [UPLOAD] Tamanho:', (arquivoStats.size / (1024 * 1024)).toFixed(2), 'MB');
    
    // Salvar no banco de forma ASSÍNCRONA (não bloqueia resposta)
    // A resposta será enviada imediatamente, e o salvamento acontece em background
    setImmediate(async () => {
      try {
        console.log('💾 [UPLOAD] Iniciando salvamento no banco (background)...');
        await Promise.race([
          musica.save(),
          new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Timeout ao salvar no banco (30s)')), 30000);
          })
        ]);
        
        console.log('✅ [UPLOAD] Música salva no banco com sucesso:', musica._id.toString());
        
        // Processar informações de áudio em background se necessário
        if (musica._processAudioInBackground && musica._audioPath) {
          setImmediate(async () => {
            try {
              const bgAudioInfo = await getAudioInfo(musica._audioPath);
              await Musica.findByIdAndUpdate(musica._id, {
                'arquivo.bitrate': bgAudioInfo.bitrate,
                'arquivo.sampleRate': bgAudioInfo.sampleRate,
                duracao: bgAudioInfo.duration > 0 ? bgAudioInfo.duration : musica.duracao
              });
              console.log('✅ [UPLOAD] Informações de áudio atualizadas em background');
            } catch (bgError) {
              console.warn('⚠️ [UPLOAD] Erro ao processar áudio em background:', bgError.message);
            }
          });
        }
      } catch (dbError) {
        console.error('❌ [UPLOAD] Erro ao salvar no banco (não crítico):', dbError.message);
        // Não remover arquivo - ele está salvo localmente e pode ser usado
        // O usuário pode tentar salvar no banco depois se necessário
      }
    });

    // Preparar resposta (banco sendo salvo em background)
    const resposta = {
      success: true,
      message: 'Música enviada com sucesso! Salvando no banco de dados...',
      data: {
        id: musica._id?.toString() || 'pending',
        titulo: musica.titulo,
        autor: musica.autor,
        url: musica.arquivo.url,
        capaUrl: musica.capa?.url || null,
        tamanho: arquivoStats.size,
        formato: arquivoExt,
        status: 'processando' // Indica que está sendo salvo no banco
      }
    };

    // Verificar se a resposta já foi enviada antes de enviar
    if (res.headersSent) {
      console.warn('⚠️ [UPLOAD LOCAL] Tentativa de enviar resposta duplicada');
      return;
    }

    // Enviar resposta IMEDIATAMENTE (sem esperar banco)
    const totalTime = Date.now() - startTime;
    console.log(`📤 [UPLOAD LOCAL] Enviando resposta ao cliente (${totalTime}ms)...`);
    
    try {
      res.status(201).json(resposta);
      console.log(`✅ [UPLOAD LOCAL] Resposta enviada com sucesso em ${totalTime}ms`);
      console.log(`✅ [UPLOAD LOCAL] Arquivo disponível em: ${arquivoUrl}`);
    } catch (sendError) {
      console.error('❌ [UPLOAD LOCAL] Erro ao enviar resposta:', sendError);
    }
    return;
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`❌ [UPLOAD] Erro após ${totalTime}ms:`, error.message);
    console.error('❌ [UPLOAD] Stack:', error.stack);
    
    // Limpar arquivos em caso de erro
    const arquivoEnviado = req.files && req.files.arquivo && req.files.arquivo[0] 
      ? req.files.arquivo[0] 
      : (req.file ? req.file : null);
    
    if (arquivoEnviado && arquivoEnviado.path && fs.existsSync(arquivoEnviado.path)) {
      try {
        fs.unlinkSync(arquivoEnviado.path);
        console.log('🗑️ [UPLOAD] Arquivo removido após erro');
      } catch (err) {
        console.error('❌ [UPLOAD] Erro ao remover arquivo:', err);
        logger.error('Erro ao remover arquivo', err);
      }
    }
    if (req.files && req.files.capa && req.files.capa[0] && req.files.capa[0].path && fs.existsSync(req.files.capa[0].path)) {
      try {
        fs.unlinkSync(req.files.capa[0].path);
        console.log('🗑️ [UPLOAD] Capa removida após erro');
      } catch (err) {
        console.error('❌ [UPLOAD] Erro ao remover capa:', err);
        logger.error('Erro ao remover capa', err);
      }
    }

    logger.error('Erro ao fazer upload da música', error, {
      userId: req.user?._id?.toString(),
      titulo: req.body?.titulo,
      tempoTotal: totalTime
    });

    // Verificar se a resposta já foi enviada
    if (!res.headersSent) {
      console.log('📤 [UPLOAD] Enviando resposta de erro...');
      try {
        res.status(500).json({
          success: false,
          message: 'Erro ao fazer upload da música',
          error: error.message,
          ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
        });
        console.log('✅ [UPLOAD] Resposta de erro enviada');
      } catch (sendError) {
        console.error('❌ [UPLOAD] Erro crítico ao enviar resposta de erro:', sendError);
      }
    } else {
      // Se a resposta já foi enviada, apenas logar o erro
      console.warn('⚠️ [UPLOAD] Erro após resposta já enviada');
      logger.error('Erro após resposta enviada', error);
    }
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

