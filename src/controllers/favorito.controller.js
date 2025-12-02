const Favorito = require('../models/Favorito');
const Musica = require('../models/Musica');
const databaseManager = require('../config/database');

/**
 * RF06 - Playlists e favoritos
 * Controller para gerenciar favoritos
 */

/**
 * Adicionar música aos favoritos
 */
const adicionarFavorito = async (req, res) => {
  try {
    const { musicaId } = req.body;
    const usuarioId = req.user._id;

    // Verificar se música existe
    const musica = await Musica.findById(musicaId);
    if (!musica || musica.status !== 'ativo') {
      return res.status(404).json({
        success: false,
        message: 'Música não encontrada'
      });
    }

    // Verificar se já está favoritada
    const jaFavoritada = await Favorito.isFavoritada(usuarioId, musicaId);
    if (jaFavoritada) {
      return res.status(400).json({
        success: false,
        message: 'Música já está nos seus favoritos'
      });
    }

    // Criar favorito
    const favorito = new Favorito({
      usuarioId,
      musicaId,
      nota: req.body.nota
    });

    // Salvar em todos os clusters
    const savedFavorito = await databaseManager.writeToAllClusters(
      'favoritos',
      'insertOne',
      favorito.toObject()
    );
    
    // Usar o ID do primeiro resultado bem-sucedido
    const firstResult = Object.values(savedFavorito.results || {})[0];
    if (firstResult && firstResult.insertedId) {
      favorito._id = firstResult.insertedId;
    }

    // Incrementar contador na música
    await musica.incrementarFavoritos();

    res.status(201).json({
      success: true,
      message: 'Música adicionada aos favoritos',
      data: savedFavorito
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro ao adicionar favorito',
      error: error.message
    });
  }
};

/**
 * Remover música dos favoritos
 */
const removerFavorito = async (req, res) => {
  try {
    const { musicaId } = req.params;
    const usuarioId = req.user._id;

    const favorito = await Favorito.findOne({ usuarioId, musicaId });

    if (!favorito) {
      return res.status(404).json({
        success: false,
        message: 'Favorito não encontrado'
      });
    }

    // Remover de todos os clusters
    await databaseManager.writeToAllClusters(
      'favoritos',
      'deleteOne',
      { _id: favorito._id }
    );

    // Decrementar contador na música
    const musica = await Musica.findById(musicaId);
    if (musica) {
      await musica.decrementarFavoritos();
    }

    res.json({
      success: true,
      message: 'Música removida dos favoritos'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro ao remover favorito',
      error: error.message
    });
  }
};

/**
 * Listar favoritos do usuário
 */
const meusFavoritos = async (req, res) => {
  try {
    const usuarioId = req.user._id;
    const { limit = 50, skip = 0 } = req.query;

    const favoritos = await Favorito.buscarPorUsuario(
      usuarioId,
      parseInt(limit),
      parseInt(skip)
    );

    const total = await Favorito.contarPorUsuario(usuarioId);

    res.json({
      success: true,
      data: favoritos,
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
      message: 'Erro ao buscar favoritos',
      error: error.message
    });
  }
};

/**
 * Verificar se música está favoritada
 */
const verificarFavorito = async (req, res) => {
  try {
    const { musicaId } = req.params;
    const usuarioId = req.user._id;

    const isFavoritada = await Favorito.isFavoritada(usuarioId, musicaId);

    res.json({
      success: true,
      data: {
        musicaId,
        isFavoritada
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro ao verificar favorito',
      error: error.message
    });
  }
};

/**
 * Atualizar nota do favorito
 */
const atualizarNota = async (req, res) => {
  try {
    const { musicaId } = req.params;
    const { nota } = req.body;
    const usuarioId = req.user._id;

    const favorito = await Favorito.findOne({ usuarioId, musicaId });

    if (!favorito) {
      return res.status(404).json({
        success: false,
        message: 'Favorito não encontrado'
      });
    }

    favorito.nota = nota || '';

    // Replicar atualização
    await databaseManager.writeToAllClusters(
      'favoritos',
      'updateOne',
      { _id: favorito._id },
      { $set: { nota: favorito.nota } }
    );

    res.json({
      success: true,
      message: 'Nota atualizada com sucesso',
      data: favorito
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar nota',
      error: error.message
    });
  }
};

module.exports = {
  adicionarFavorito,
  removerFavorito,
  meusFavoritos,
  verificarFavorito,
  atualizarNota
};

