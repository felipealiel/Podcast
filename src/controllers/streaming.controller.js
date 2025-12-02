const Musica = require('../models/Musica');
const fs = require('fs');
const path = require('path');
const { getAudioInfo } = require('../utils/audioProcessor');

/**
 * RF02 - Upload, armazenamento e reprodução de conteúdos
 * Controller para streaming de áudio
 */

/**
 * Stream de áudio com suporte a range requests (HTTP 206)
 */
const streamAudio = async (req, res) => {
  try {
    const { id } = req.params;
    const { quality = 'medium' } = req.query;

    // Buscar música
    const musica = await Musica.findById(id);

    if (!musica || musica.status !== 'ativo') {
      return res.status(404).json({
        success: false,
        message: 'Música não encontrada'
      });
    }

    // Verificar visibilidade
    if (musica.visibilidade === 'privado' && 
        (!req.user || musica.upload.usuarioId.toString() !== req.user._id.toString())) {
      return res.status(403).json({
        success: false,
        message: 'Esta música é privada'
      });
    }

    // Verificar se permite streaming
    if (!musica.configuracoes.permiteStreaming) {
      return res.status(403).json({
        success: false,
        message: 'Streaming não permitido para esta música'
      });
    }

    // Determinar arquivo a ser servido
    // Se não tiver path no banco, construir a partir da URL
    let filePath = musica.arquivo.path;
    
    // Se não tiver path, construir a partir da URL
    if (!filePath && musica.arquivo.url) {
      // URL é algo como /uploads/musics/music-123.mp3
      // Converter para path local
      filePath = path.join(process.cwd(), musica.arquivo.url);
    }
    
    // Se ainda não tiver, tentar construir do filename
    if (!filePath && musica.arquivo.filename) {
      const uploadDir = process.env.UPLOAD_PATH || './uploads';
      filePath = path.join(uploadDir, 'musics', musica.arquivo.filename);
    }

    // Verificar se arquivo existe
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'Arquivo de áudio não encontrado'
      });
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    // Configurar headers
    const ext = path.extname(filePath).toLowerCase();
    const contentType = {
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.aac': 'audio/aac',
      '.ogg': 'audio/ogg',
      '.m4a': 'audio/mp4',
      '.flac': 'audio/flac'
    }[ext] || 'audio/mpeg';

    // Suporte a Range Requests (HTTP 206) para streaming
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(filePath, { start, end });

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Expose-Headers': 'Content-Range, Accept-Ranges, Content-Length'
      });

      file.pipe(res);
    } else {
      // Sem range, enviar arquivo completo
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Expose-Headers': 'Content-Range, Accept-Ranges, Content-Length'
      });

      fs.createReadStream(filePath).pipe(res);
    }

    // Registrar reprodução (assíncrono, não bloqueia o stream)
    if (req.user) {
      setImmediate(async () => {
        try {
          console.log('📝 [STREAMING] Registrando reprodução no histórico', {
            userId: req.user._id,
            musicaId: musica._id
          });
          
          await musica.incrementarReproducoes();
          
          // Registrar no histórico se usuário autenticado
          const Historico = require('../models/Historico');
          const databaseManager = require('../config/database');
          
          const agora = new Date();
          const historico = new Historico({
            usuarioId: req.user._id,
            tipoConteudo: 'musica',
            conteudoId: musica._id,
            tipoConteudoModel: 'Musica',
            reproducao: {
              dataInicio: agora,
              duracaoReproduzida: 0,
              duracaoTotal: musica.duracao || 0,
              percentualCompleto: 0,
              foiCompleta: false
            },
            contexto: {
              dispositivo: req.body.dispositivo || 'web',
              userAgent: req.headers['user-agent'],
              ipAddress: req.ip || req.connection.remoteAddress
            },
            preferencias: {
              horarioPreferido: (() => {
                const hora = agora.getHours();
                if (hora >= 6 && hora < 12) return 'manha';
                if (hora >= 12 && hora < 18) return 'tarde';
                if (hora >= 18 && hora < 24) return 'noite';
                return 'madrugada';
              })()
            }
          });
          
          // Salvar em todos os clusters
          const savedHistorico = await databaseManager.writeToAllClusters(
            'historicos',
            'insertOne',
            historico.toObject()
          );
          
          console.log('✅ [STREAMING] Histórico registrado com sucesso', {
            userId: req.user._id,
            musicaId: musica._id,
            results: Object.keys(savedHistorico.results || {})
          });
        } catch (error) {
          console.error('❌ [STREAMING] Erro ao registrar reprodução no histórico:', error);
        }
      });
    } else {
      console.log('⚠️ [STREAMING] Usuário não autenticado, histórico não será registrado');
    }
  } catch (error) {
    console.error('Erro no streaming:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao fazer streaming da música',
      error: error.message
    });
  }
};

/**
 * Download de música
 */
const downloadAudio = async (req, res) => {
  try {
    const { id } = req.params;

    const musica = await Musica.findById(id);

    if (!musica || musica.status !== 'ativo') {
      return res.status(404).json({
        success: false,
        message: 'Música não encontrada'
      });
    }

    // Verificar se permite download
    if (!musica.configuracoes.permiteDownload) {
      return res.status(403).json({
        success: false,
        message: 'Download não permitido para esta música'
      });
    }

    const filePath = musica.arquivo.path;

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'Arquivo não encontrado'
      });
    }

    // Incrementar contador de downloads
    await musica.incrementarDownloads();

    // Enviar arquivo
    res.download(filePath, `${musica.titulo}.${musica.arquivo.formato}`, (err) => {
      if (err) {
        console.error('Erro ao fazer download:', err);
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro ao fazer download',
      error: error.message
    });
  }
};

/**
 * Obter informações do arquivo de áudio
 */
const getAudioMetadata = async (req, res) => {
  try {
    const { id } = req.params;

    const musica = await Musica.findById(id);

    if (!musica || musica.status !== 'ativo') {
      return res.status(404).json({
        success: false,
        message: 'Música não encontrada'
      });
    }

    // Se já tiver informações no banco, retornar
    if (musica.arquivo.bitrate && musica.arquivo.sampleRate) {
      return res.json({
        success: true,
        data: {
          duration: musica.duracao,
          bitrate: musica.arquivo.bitrate,
          sampleRate: musica.arquivo.sampleRate,
          format: musica.arquivo.formato,
          size: musica.arquivo.tamanho,
          url: musica.arquivo.url,
          versoes: musica.arquivo.versoes || {}
        }
      });
    }

    // Se não tiver, tentar obter do arquivo
    if (fs.existsSync(musica.arquivo.path)) {
      try {
        const audioInfo = await getAudioInfo(musica.arquivo.path);
        
        // Atualizar no banco
        musica.duracao = audioInfo.duration;
        musica.arquivo.bitrate = audioInfo.bitrate;
        musica.arquivo.sampleRate = audioInfo.sampleRate;
        await musica.save();

        return res.json({
          success: true,
          data: {
            duration: audioInfo.duration,
            bitrate: audioInfo.bitrate,
            sampleRate: audioInfo.sampleRate,
            format: musica.arquivo.formato,
            size: musica.arquivo.tamanho,
            url: musica.arquivo.url
          }
        });
      } catch (error) {
        console.error('Erro ao obter informações do áudio:', error);
      }
    }

    // Retornar informações básicas
    res.json({
      success: true,
      data: {
        duration: musica.duracao || 0,
        format: musica.arquivo.formato,
        size: musica.arquivo.tamanho,
        url: musica.arquivo.url
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro ao obter metadados',
      error: error.message
    });
  }
};

module.exports = {
  streamAudio,
  downloadAudio,
  getAudioMetadata
};

