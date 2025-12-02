const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const fs = require('fs');
const path = require('path');

// Configurar caminho do ffmpeg
let ffmpegAvailable = false;
try {
  if (ffmpegStatic) {
    ffmpeg.setFfmpegPath(ffmpegStatic);
    ffmpegAvailable = fs.existsSync(ffmpegStatic);
    if (!ffmpegAvailable) {
      console.warn('⚠️  ffmpeg-static não encontrado. Funcionalidades de processamento de áudio podem estar limitadas.');
    }
  } else {
    console.warn('⚠️  ffmpeg-static não instalado. Instale com: npm install ffmpeg-static');
  }
} catch (error) {
  console.warn('⚠️  Erro ao configurar ffmpeg:', error.message);
}

/**
 * RF08 - Suporte a múltiplas resoluções
 * Utilitário para processar e transcodificar áudio
 */

/**
 * Obter informações do arquivo de áudio
 */
const getAudioInfo = async (audioPath) => {
  return new Promise((resolve, reject) => {
    // Verificar se ffmpeg está disponível
    if (!ffmpegAvailable) {
      // Se ffmpeg não estiver disponível, retornar informações básicas do arquivo
      try {
        const stats = fs.statSync(audioPath);
        return resolve({
          duration: 0,
          bitrate: 0,
          sampleRate: 44100,
          channels: 2,
          codec: 'unknown',
          format: 'unknown',
          size: stats.size
        });
      } catch (error) {
        return reject(new Error(`Arquivo não encontrado: ${audioPath}`));
      }
    }

    // Verificar se arquivo existe antes de processar
    if (!fs.existsSync(audioPath)) {
      return reject(new Error(`Arquivo não encontrado: ${audioPath}`));
    }

    // Timeout de segurança (15 segundos)
    const timeout = setTimeout(() => {
      reject(new Error('Timeout ao processar informações do áudio'));
    }, 15000);

    try {
      ffmpeg.ffprobe(audioPath, (err, metadata) => {
        clearTimeout(timeout);
        
        if (err) {
          // Se houver erro, retornar informações básicas em vez de falhar
          console.warn('Erro ao obter metadados com ffprobe, usando valores padrão:', err.message);
          try {
            const stats = fs.statSync(audioPath);
            return resolve({
              duration: 0,
              bitrate: 0,
              sampleRate: 44100,
              channels: 2,
              codec: 'unknown',
              format: 'unknown',
              size: stats.size
            });
          } catch (statError) {
            return reject(err);
          }
        }

        if (!metadata || !metadata.streams) {
          // Se não houver streams, usar informações básicas
          try {
            const stats = fs.statSync(audioPath);
            return resolve({
              duration: Math.floor(metadata.format?.duration || 0),
              bitrate: Math.floor((metadata.format?.bit_rate || 0) / 1000),
              sampleRate: 44100,
              channels: 2,
              codec: 'unknown',
              format: metadata.format?.format_name || 'unknown',
              size: stats.size
            });
          } catch (statError) {
            return reject(new Error('Metadados inválidos do arquivo'));
          }
        }

        const audioStream = metadata.streams.find(s => s.codec_type === 'audio');
        
        if (!audioStream) {
          // Se não encontrar stream de áudio, tentar usar informações básicas do formato
          const stats = fs.statSync(audioPath);
          return resolve({
            duration: Math.floor(metadata.format?.duration || 0),
            bitrate: Math.floor((metadata.format?.bit_rate || 0) / 1000), // kbps
            sampleRate: 44100, // Valor padrão
            channels: 2, // Valor padrão
            codec: 'unknown',
            format: metadata.format?.format_name || 'unknown',
            size: stats.size
          });
        }

        resolve({
          duration: Math.floor(metadata.format?.duration || 0),
          bitrate: Math.floor((metadata.format?.bit_rate || 0) / 1000), // kbps
          sampleRate: audioStream.sample_rate || 44100,
          channels: audioStream.channels || 2,
          codec: audioStream.codec_name || 'unknown',
          format: metadata.format?.format_name || 'unknown',
          size: metadata.format?.size || 0
        });
      });
    } catch (error) {
      clearTimeout(timeout);
      reject(error);
    }
  });
};

/**
 * Transcodificar áudio para diferentes qualidades
 */
const transcodeAudio = async (inputPath, outputDir, options = {}) => {
  const {
    qualities = ['high', 'medium', 'low'],
    formats = ['mp3']
  } = options;

  const results = {};

  // Qualidades de áudio
  const qualityPresets = {
    high: {
      bitrate: '320k',
      sampleRate: 44100,
      suffix: 'high'
    },
    medium: {
      bitrate: '192k',
      sampleRate: 44100,
      suffix: 'medium'
    },
    low: {
      bitrate: '128k',
      sampleRate: 44100,
      suffix: 'low'
    }
  };

  // Garantir que o diretório existe
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const baseName = path.basename(inputPath, path.extname(inputPath));

  for (const quality of qualities) {
    if (!qualityPresets[quality]) continue;

    const preset = qualityPresets[quality];
    
    for (const format of formats) {
      const outputPath = path.join(outputDir, `${baseName}_${preset.suffix}.${format}`);
      
      try {
        await new Promise((resolve, reject) => {
          ffmpeg(inputPath)
            .audioBitrate(preset.bitrate)
            .audioFrequency(preset.sampleRate)
            .audioChannels(2)
            .format(format)
            .on('start', (commandLine) => {
              console.log(`🎵 Transcodificando: ${quality} (${format})`);
            })
            .on('progress', (progress) => {
              // Log de progresso opcional
            })
            .on('end', () => {
              console.log(`✅ Transcodificação concluída: ${quality} (${format})`);
              resolve();
            })
            .on('error', (err) => {
              console.error(`❌ Erro na transcodificação ${quality} (${format}):`, err.message);
              reject(err);
            })
            .save(outputPath);
        });

        // Obter informações do arquivo gerado
        const stats = fs.statSync(outputPath);
        results[`${quality}_${format}`] = {
          path: outputPath,
          url: `/uploads/musics/${path.basename(outputPath)}`,
          bitrate: preset.bitrate,
          sampleRate: preset.sampleRate,
          format: format,
          size: stats.size
        };
      } catch (error) {
        console.error(`Erro ao transcodificar ${quality} (${format}):`, error);
        // Continuar com outras qualidades mesmo se uma falhar
      }
    }
  }

  return results;
};

/**
 * Criar versão otimizada para streaming
 */
const createStreamingVersion = async (inputPath, outputDir) => {
  const baseName = path.basename(inputPath, path.extname(inputPath));
  const outputPath = path.join(outputDir, `${baseName}_stream.mp3`);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .audioBitrate('128k')
      .audioFrequency(44100)
      .audioChannels(2)
      .format('mp3')
      .audioCodec('libmp3lame')
      .on('end', () => {
        const stats = fs.statSync(outputPath);
        resolve({
          path: outputPath,
          url: `/uploads/musics/${path.basename(outputPath)}`,
          size: stats.size,
          bitrate: '128k',
          optimized: true
        });
      })
      .on('error', reject)
      .save(outputPath);
  });
};

/**
 * Extrair thumbnail de áudio (waveform ou spectrogram)
 */
const extractThumbnail = async (audioPath, outputDir, options = {}) => {
  const {
    type = 'waveform', // 'waveform' ou 'spectrogram'
    width = 800,
    height = 200
  } = options;

  const baseName = path.basename(audioPath, path.extname(audioPath));
  const outputPath = path.join(outputDir, `${baseName}_${type}.png`);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  return new Promise((resolve, reject) => {
    let command = ffmpeg(audioPath);

    if (type === 'waveform') {
      command = command
        .complexFilter([
          `[0:a]showwavespic=s=${width}x${height}:colors=0x00ff00:scale=lin[wave]`
        ])
        .frames(1)
        .outputOptions(['-map', '[wave]']);
    } else if (type === 'spectrogram') {
      command = command
        .complexFilter([
          `[0:a]showspectrumpic=s=${width}x${height}:mode=combined:color=intensity[spec]`
        ])
        .frames(1)
        .outputOptions(['-map', '[spec]']);
    }

    command
      .format('image2')
      .on('end', () => {
        const stats = fs.statSync(outputPath);
        resolve({
          path: outputPath,
          url: `/uploads/covers/${path.basename(outputPath)}`,
          size: stats.size,
          type: type
        });
      })
      .on('error', reject)
      .save(outputPath);
  });
};

module.exports = {
  getAudioInfo,
  transcodeAudio,
  createStreamingVersion,
  extractThumbnail
};

