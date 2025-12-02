const logger = require('../utils/logger');
const Musica = require('../models/Musica');
const Playlist = require('../models/Playlist');
const User = require('../models/User');
const Historico = require('../models/Historico');
const Favorito = require('../models/Favorito');

/**
 * RF09 - Logs e métricas em tempo real
 * Controller para métricas e estatísticas
 */

/**
 * Obter métricas gerais do sistema
 */
const getSystemMetrics = async (req, res) => {
  try {
    const metrics = logger.getMetrics();

    // Estatísticas do banco de dados
    const dbStats = {
      musicas: await Musica.countDocuments({ status: 'ativo' }),
      playlists: await Playlist.countDocuments({ status: 'ativo' }),
      usuarios: await User.countDocuments({ 'account.isActive': true }),
      reproducoes: await Historico.countDocuments(),
      favoritos: await Favorito.countDocuments()
    };

    res.json({
      success: true,
      data: {
        system: metrics,
        database: dbStats,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro ao obter métricas',
      error: error.message
    });
  }
};

/**
 * Obter métricas em tempo real (via WebSocket ou polling)
 */
const getRealtimeMetrics = async (req, res) => {
  try {
    const metrics = logger.getMetrics();

    // Últimas 100 requisições (simulado - em produção usar cache/Redis)
    res.json({
      success: true,
      data: {
        metrics,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro ao obter métricas em tempo real',
      error: error.message
    });
  }
};

/**
 * Obter estatísticas de uso
 */
const getUsageStats = async (req, res) => {
  try {
    const { periodo = '24h' } = req.query;
    
    let startDate = new Date();
    switch (periodo) {
      case '1h':
        startDate.setHours(startDate.getHours() - 1);
        break;
      case '24h':
        startDate.setHours(startDate.getHours() - 24);
        break;
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      default:
        startDate.setHours(startDate.getHours() - 24);
    }

    const stats = {
      reproducoes: await Historico.countDocuments({
        'reproducao.dataInicio': { $gte: startDate }
      }),
      uploads: await Musica.countDocuments({
        'upload.dataUpload': { $gte: startDate }
      }),
      novosUsuarios: await User.countDocuments({
        createdAt: { $gte: startDate }
      }),
      favoritos: await Favorito.countDocuments({
        favoritadoEm: { $gte: startDate }
      })
    };

    res.json({
      success: true,
      data: {
        periodo,
        stats,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro ao obter estatísticas',
      error: error.message
    });
  }
};

/**
 * Resetar métricas (apenas admin)
 */
const resetMetrics = async (req, res) => {
  try {
    logger.resetMetrics();
    
    res.json({
      success: true,
      message: 'Métricas resetadas com sucesso'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro ao resetar métricas',
      error: error.message
    });
  }
};

module.exports = {
  getSystemMetrics,
  getRealtimeMetrics,
  getUsageStats,
  resetMetrics
};

