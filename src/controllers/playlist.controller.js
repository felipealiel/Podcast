const Playlist = require('../models/Playlist');
const Musica = require('../models/Musica');
const databaseManager = require('../config/database');

/**
 * RF06 - Playlists e favoritos
 * Controller para gerenciar playlists
 */

/**
 * Criar nova playlist
 */
const criarPlaylist = async (req, res) => {
  try {
    const { nomePlaylist, descricao, visibilidade, capa } = req.body;
    const usuarioId = req.user._id;

    const playlist = new Playlist({
      nomePlaylist,
      descricao,
      usuarioId,
      visibilidade: visibilidade || 'publico',
      capa
    });

    // Salvar em todos os clusters
    const savedPlaylist = await databaseManager.writeToAllClusters(
      'playlists',
      'insertOne',
      playlist.toObject()
    );
    
    // Usar o ID do primeiro resultado bem-sucedido
    const firstResult = Object.values(savedPlaylist.results || {})[0];
    if (firstResult && firstResult.insertedId) {
      playlist._id = firstResult.insertedId;
    }

    res.status(201).json({
      success: true,
      message: 'Playlist criada com sucesso',
      data: savedPlaylist
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro ao criar playlist',
      error: error.message
    });
  }
};

/**
 * Buscar playlists do usuário
 */
const minhasPlaylists = async (req, res) => {
  try {
    const usuarioId = req.user._id;
    const { limit = 20, skip = 0 } = req.query;

    const playlists = await Playlist.find({ usuarioId, status: 'ativo' })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .populate('musicas.musicaId', 'titulo autor ano genero capa duracao arquivo')
      .populate('usuarioId', 'nomeUsuario profile.avatar');

    const total = await Playlist.countDocuments({ usuarioId, status: 'ativo' });

    res.json({
      success: true,
      data: playlists,
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
      message: 'Erro ao buscar playlists',
      error: error.message
    });
  }
};

/**
 * Buscar playlist por ID
 */
const buscarPlaylist = async (req, res) => {
  try {
    const { id } = req.params;
    const usuarioId = req.user?._id;

    const playlist = await Playlist.findById(id)
      .populate('musicas.musicaId')
      .populate('usuarioId', 'nomeUsuario profile.avatar')
      .populate('colaboradores.usuarioId', 'nomeUsuario profile.avatar');

    if (!playlist || playlist.status !== 'ativo') {
      return res.status(404).json({
        success: false,
        message: 'Playlist não encontrada'
      });
    }

    // Verificar visibilidade
    if (playlist.visibilidade === 'privado' && 
        playlist.usuarioId._id.toString() !== usuarioId?.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Esta playlist é privada'
      });
    }

    res.json({
      success: true,
      data: playlist
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar playlist',
      error: error.message
    });
  }
};

/**
 * Atualizar playlist
 */
const atualizarPlaylist = async (req, res) => {
  try {
    const { id } = req.params;
    const usuarioId = req.user._id;
    const { nomePlaylist, descricao, visibilidade, capa } = req.body;

    const playlist = await Playlist.findById(id);

    if (!playlist) {
      return res.status(404).json({
        success: false,
        message: 'Playlist não encontrada'
      });
    }

    // Verificar permissão
    if (playlist.usuarioId.toString() !== usuarioId.toString()) {
      const colaborador = playlist.colaboradores.find(
        c => c.usuarioId.toString() === usuarioId.toString() && c.permissoes.podeEditar
      );
      if (!colaborador) {
        return res.status(403).json({
          success: false,
          message: 'Você não tem permissão para editar esta playlist'
        });
      }
    }

    // Atualizar campos
    if (nomePlaylist) playlist.nomePlaylist = nomePlaylist;
    if (descricao !== undefined) playlist.descricao = descricao;
    if (visibilidade) playlist.visibilidade = visibilidade;
    if (capa) playlist.capa = capa;

    // Replicar atualização em todos os clusters
    await databaseManager.writeToAllClusters(
      'playlists',
      'updateOne',
      { _id: playlist._id },
      { $set: playlist.toObject() }
    );

    res.json({
      success: true,
      message: 'Playlist atualizada com sucesso',
      data: playlist
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar playlist',
      error: error.message
    });
  }
};

/**
 * Deletar playlist
 */
const deletarPlaylist = async (req, res) => {
  try {
    const { id } = req.params;
    const usuarioId = req.user._id;

    const playlist = await Playlist.findById(id);

    if (!playlist) {
      return res.status(404).json({
        success: false,
        message: 'Playlist não encontrada'
      });
    }

    // Verificar permissão
    if (playlist.usuarioId.toString() !== usuarioId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Você não tem permissão para deletar esta playlist'
      });
    }

    // Marcar como removida
    playlist.status = 'removido';

    // Replicar em todos os clusters
    await databaseManager.writeToAllClusters(
      'playlists',
      'updateOne',
      { _id: playlist._id },
      { $set: { status: 'removido' } }
    );

    res.json({
      success: true,
      message: 'Playlist deletada com sucesso'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro ao deletar playlist',
      error: error.message
    });
  }
};

/**
 * Adicionar música à playlist
 */
const adicionarMusica = async (req, res) => {
  try {
    const { id } = req.params;
    const { musicaId } = req.body;
    const usuarioId = req.user._id;

    const playlist = await Playlist.findById(id);

    if (!playlist || playlist.status !== 'ativo') {
      return res.status(404).json({
        success: false,
        message: 'Playlist não encontrada'
      });
    }

    // Verificar permissão
    if (playlist.usuarioId.toString() !== usuarioId.toString()) {
      const colaborador = playlist.colaboradores.find(
        c => c.usuarioId.toString() === usuarioId.toString() && c.permissoes.podeAdicionar
      );
      if (!colaborador) {
        return res.status(403).json({
          success: false,
          message: 'Você não tem permissão para adicionar músicas nesta playlist'
        });
      }
    }

    // Verificar se música existe
    const musica = await Musica.findById(musicaId);
    if (!musica || musica.status !== 'ativo') {
      return res.status(404).json({
        success: false,
        message: 'Música não encontrada'
      });
    }

    // Adicionar música
    await playlist.adicionarMusica(musicaId);

    // Replicar atualização
    await databaseManager.writeToAllClusters(
      'playlists',
      'updateOne',
      { _id: playlist._id },
      { $set: playlist.toObject() }
    );

    res.json({
      success: true,
      message: 'Música adicionada à playlist com sucesso',
      data: playlist
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Erro ao adicionar música à playlist',
      error: error.message
    });
  }
};

/**
 * Remover música da playlist
 */
const removerMusica = async (req, res) => {
  try {
    const { id, musicaId } = req.params;
    const usuarioId = req.user._id;

    const playlist = await Playlist.findById(id);

    if (!playlist || playlist.status !== 'ativo') {
      return res.status(404).json({
        success: false,
        message: 'Playlist não encontrada'
      });
    }

    // Verificar permissão
    if (playlist.usuarioId.toString() !== usuarioId.toString()) {
      const colaborador = playlist.colaboradores.find(
        c => c.usuarioId.toString() === usuarioId.toString() && c.permissoes.podeRemover
      );
      if (!colaborador) {
        return res.status(403).json({
          success: false,
          message: 'Você não tem permissão para remover músicas desta playlist'
        });
      }
    }

    // Remover música
    await playlist.removerMusica(musicaId);

    // Replicar atualização
    await databaseManager.writeToAllClusters(
      'playlists',
      'updateOne',
      { _id: playlist._id },
      { $set: playlist.toObject() }
    );

    res.json({
      success: true,
      message: 'Música removida da playlist com sucesso',
      data: playlist
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Erro ao remover música da playlist',
      error: error.message
    });
  }
};

/**
 * Buscar playlists públicas
 */
const buscarPublicas = async (req, res) => {
  try {
    const { limit = 20, skip = 0, tipo, ordenar = 'seguidores' } = req.query;

    let query = { visibilidade: 'publico', status: 'ativo' };
    if (tipo) query.tipo = tipo;

    let sort = {};
    switch (ordenar) {
      case 'seguidores':
        sort = { 'stats.seguidores': -1, createdAt: -1 };
        break;
      case 'reproducoes':
        sort = { 'stats.reproducoes': -1, createdAt: -1 };
        break;
      case 'recente':
        sort = { createdAt: -1 };
        break;
      default:
        sort = { 'stats.seguidores': -1, createdAt: -1 };
    }

    const playlists = await Playlist.find(query)
      .sort(sort)
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .populate('usuarioId', 'nomeUsuario profile.avatar');

    const total = await Playlist.countDocuments(query);

    res.json({
      success: true,
      data: playlists,
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
      message: 'Erro ao buscar playlists',
      error: error.message
    });
  }
};

module.exports = {
  criarPlaylist,
  minhasPlaylists,
  buscarPlaylist,
  atualizarPlaylist,
  deletarPlaylist,
  adicionarMusica,
  removerMusica,
  buscarPublicas
};

