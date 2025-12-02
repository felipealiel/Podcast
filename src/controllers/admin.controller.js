const User = require('../models/User');
const Musica = require('../models/Musica');
const Playlist = require('../models/Playlist');
const databaseManager = require('../config/database');
const logger = require('../utils/logger');

/**
 * RF07 - Permissões para produtores e admins
 * Controller para administração
 */

/**
 * Promover usuário a produtor
 */
const promoverProdutor = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    if (user.account.role === 'producer') {
      return res.status(400).json({
        success: false,
        message: 'Usuário já é produtor'
      });
    }

    user.account.role = 'producer';

    // Replicar atualização
    await databaseManager.writeToAllClusters(
      'users',
      'updateOne',
      { _id: user._id },
      { $set: { 'account.role': 'producer' } }
    );

    await user.save();

    logger.info('Usuário promovido a produtor', {
      userId: user._id.toString(),
      promotedBy: req.user._id.toString()
    });

    res.json({
      success: true,
      message: 'Usuário promovido a produtor com sucesso',
      data: {
        userId: user._id,
        nomeUsuario: user.nomeUsuario,
        role: user.account.role
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro ao promover usuário',
      error: error.message
    });
  }
};

/**
 * Promover usuário a admin
 */
const promoverAdmin = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    if (user.account.role === 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Usuário já é administrador'
      });
    }

    user.account.role = 'admin';

    // Replicar atualização
    await databaseManager.writeToAllClusters(
      'users',
      'updateOne',
      { _id: user._id },
      { $set: { 'account.role': 'admin' } }
    );

    await user.save();

    logger.info('Usuário promovido a admin', {
      userId: user._id.toString(),
      promotedBy: req.user._id.toString()
    });

    res.json({
      success: true,
      message: 'Usuário promovido a administrador com sucesso',
      data: {
        userId: user._id,
        nomeUsuario: user.nomeUsuario,
        role: user.account.role
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro ao promover usuário',
      error: error.message
    });
  }
};

/**
 * Remover permissão de produtor
 */
const removerProdutor = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    if (user.account.role === 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Não é possível remover permissão de administrador'
      });
    }

    user.account.role = 'user';

    // Replicar atualização
    await databaseManager.writeToAllClusters(
      'users',
      'updateOne',
      { _id: user._id },
      { $set: { 'account.role': 'user' } }
    );

    await user.save();

    logger.info('Permissão de produtor removida', {
      userId: user._id.toString(),
      removedBy: req.user._id.toString()
    });

    res.json({
      success: true,
      message: 'Permissão de produtor removida com sucesso',
      data: {
        userId: user._id,
        nomeUsuario: user.nomeUsuario,
        role: user.account.role
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro ao remover permissão',
      error: error.message
    });
  }
};

/**
 * Listar todos os produtores
 */
const listarProdutores = async (req, res) => {
  try {
    const { limit = 50, skip = 0 } = req.query;

    const produtores = await User.find({
      'account.role': { $in: ['producer', 'admin'] }
    })
    .select('nomeUsuario email account.role stats createdAt')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip(parseInt(skip));

    const total = await User.countDocuments({
      'account.role': { $in: ['producer', 'admin'] }
    });

    res.json({
      success: true,
      data: produtores,
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
      message: 'Erro ao listar produtores',
      error: error.message
    });
  }
};

/**
 * Gerenciar conteúdo (moderação)
 */
const moderarConteudo = async (req, res) => {
  try {
    const { tipo, id } = req.params;
    const { acao } = req.body; // 'aprovar', 'rejeitar', 'remover'

    if (!['musica', 'playlist'].includes(tipo)) {
      return res.status(400).json({
        success: false,
        message: 'Tipo de conteúdo inválido'
      });
    }

    const Model = tipo === 'musica' ? Musica : Playlist;
    const conteudo = await Model.findById(id);

    if (!conteudo) {
      return res.status(404).json({
        success: false,
        message: 'Conteúdo não encontrado'
      });
    }

    let updateData = {};

    switch (acao) {
      case 'aprovar':
        updateData = { status: 'ativo' };
        break;
      case 'rejeitar':
        updateData = { status: 'inativo' };
        break;
      case 'remover':
        updateData = { status: 'removido' };
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Ação inválida'
        });
    }

    // Replicar atualização
    await databaseManager.writeToAllClusters(
      tipo === 'musica' ? 'musicas' : 'playlists',
      'updateOne',
      { _id: conteudo._id },
      { $set: updateData }
    );

    Object.assign(conteudo, updateData);
    await conteudo.save();

    logger.info('Conteúdo moderado', {
      tipo,
      conteudoId: id,
      acao,
      moderadoPor: req.user._id.toString()
    });

    res.json({
      success: true,
      message: `Conteúdo ${acao} com sucesso`,
      data: conteudo
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro ao moderar conteúdo',
      error: error.message
    });
  }
};

/**
 * Listar conteúdo pendente de moderação
 */
const listarPendentes = async (req, res) => {
  try {
    const { tipo = 'musica', limit = 50, skip = 0 } = req.query;

    if (!['musica', 'playlist'].includes(tipo)) {
      return res.status(400).json({
        success: false,
        message: 'Tipo de conteúdo inválido'
      });
    }

    const Model = tipo === 'musica' ? Musica : Playlist;
    
    // Buscar conteúdo inativo ou removido (pendente de revisão)
    const pendentes = await Model.find({
      status: { $in: ['inativo', 'removido'] }
    })
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip(parseInt(skip))
    .populate(tipo === 'musica' ? 'upload.usuarioId' : 'usuarioId', 'nomeUsuario email');

    const total = await Model.countDocuments({
      status: { $in: ['inativo', 'removido'] }
    });

    res.json({
      success: true,
      data: pendentes,
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
      message: 'Erro ao listar conteúdo pendente',
      error: error.message
    });
  }
};

/**
 * Estatísticas de administração
 */
const estatisticasAdmin = async (req, res) => {
  try {
    const stats = {
      usuarios: {
        total: await User.countDocuments(),
        ativos: await User.countDocuments({ 'account.isActive': true }),
        produtores: await User.countDocuments({ 'account.role': 'producer' }),
        admins: await User.countDocuments({ 'account.role': 'admin' })
      },
      musicas: {
        total: await Musica.countDocuments(),
        ativas: await Musica.countDocuments({ status: 'ativo' }),
        inativas: await Musica.countDocuments({ status: 'inativo' }),
        removidas: await Musica.countDocuments({ status: 'removido' })
      },
      playlists: {
        total: await Playlist.countDocuments(),
        ativas: await Playlist.countDocuments({ status: 'ativo' }),
        inativas: await Playlist.countDocuments({ status: 'inativo' })
      }
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro ao obter estatísticas',
      error: error.message
    });
  }
};

module.exports = {
  promoverProdutor,
  promoverAdmin,
  removerProdutor,
  listarProdutores,
  moderarConteudo,
  listarPendentes,
  estatisticasAdmin
};

