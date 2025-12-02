const Musica = require('../models/Musica');
const Historico = require('../models/Historico');
const Favorito = require('../models/Favorito');
const Playlist = require('../models/Playlist');

/**
 * RF05 - Recomendações personalizadas
 * Controller para sistema de recomendações
 */

/**
 * Obter recomendações personalizadas para o usuário
 */
const getRecomendacoes = async (req, res) => {
  try {
    const usuarioId = req.user._id;
    const { limit = 20, tipo = 'musicas' } = req.query;

    // Analisar preferências do usuário
    const preferencias = await Historico.analisarPreferencias(usuarioId);
    
    // Obter favoritos do usuário
    const favoritos = await Favorito.find({ usuarioId })
      .select('musicaId')
      .limit(100);
    const favoritosIds = favoritos.map(f => f.musicaId);

    // Obter histórico recente
    const historico = await Historico.buscarRecentes(usuarioId, 50);
    const historicoIds = historico.map(h => h.conteudoId);

    // IDs já conhecidos pelo usuário (para evitar recomendar o que já conhece)
    const conhecidosIds = [...favoritosIds, ...historicoIds];

    let recomendacoes = [];

    // Estratégia 1: Baseado em gênero favorito
    if (preferencias.generoFavorito) {
      const musicasGenero = await Musica.find({
        genero: preferencias.generoFavorito,
        status: 'ativo',
        visibilidade: 'publico',
        _id: { $nin: conhecidosIds }
      })
      .sort({ 'stats.reproducoes': -1, 'stats.favoritos': -1 })
      .limit(Math.ceil(limit * 0.4))
      .populate('upload.usuarioId', 'nomeUsuario profile.avatar');

      recomendacoes = [...recomendacoes, ...musicasGenero];
    }

    // Estratégia 2: Baseado em autor favorito
    if (preferencias.autorFavorito && recomendacoes.length < limit) {
      const musicasAutor = await Musica.find({
        autor: new RegExp(preferencias.autorFavorito, 'i'),
        status: 'ativo',
        visibilidade: 'publico',
        _id: { $nin: [...conhecidosIds, ...recomendacoes.map(m => m._id)] }
      })
      .sort({ 'stats.reproducoes': -1 })
      .limit(Math.ceil(limit * 0.3))
      .populate('upload.usuarioId', 'nomeUsuario profile.avatar');

      recomendacoes = [...recomendacoes, ...musicasAutor];
    }

    // Estratégia 3: Baseado em músicas similares (mesmo gênero e autor)
    if (recomendacoes.length < limit && historico.length > 0) {
      // Pegar gêneros e autores mais ouvidos
      const generos = {};
      const autores = {};
      
      for (const item of historico) {
        if (item.conteudoId && item.conteudoId.genero) {
          generos[item.conteudoId.genero] = (generos[item.conteudoId.genero] || 0) + 1;
        }
        if (item.conteudoId && item.conteudoId.autor) {
          autores[item.conteudoId.autor] = (autores[item.conteudoId.autor] || 0) + 1;
        }
      }

      // Buscar músicas similares
      const generosTop = Object.keys(generos).sort((a, b) => generos[b] - generos[a]).slice(0, 3);
      const autoresTop = Object.keys(autores).sort((a, b) => autores[b] - autores[a]).slice(0, 3);

      if (generosTop.length > 0 || autoresTop.length > 0) {
        const query = {
          status: 'ativo',
          visibilidade: 'publico',
          _id: { $nin: [...conhecidosIds, ...recomendacoes.map(m => m._id)] }
        };

        if (generosTop.length > 0) {
          query.genero = { $in: generosTop };
        }
        if (autoresTop.length > 0) {
          query.autor = { $in: autoresTop };
        }

        const similares = await Musica.find(query)
          .sort({ 'stats.reproducoes': -1, 'stats.favoritos': -1 })
          .limit(limit - recomendacoes.length)
          .populate('upload.usuarioId', 'nomeUsuario profile.avatar');

        recomendacoes = [...recomendacoes, ...similares];
      }
    }

    // Estratégia 4: Popularidade geral (se ainda não tiver o suficiente)
    if (recomendacoes.length < limit) {
      const populares = await Musica.find({
        status: 'ativo',
        visibilidade: 'publico',
        _id: { $nin: [...conhecidosIds, ...recomendacoes.map(m => m._id)] }
      })
      .sort({ 'stats.reproducoes': -1, 'stats.favoritos': -1 })
      .limit(limit - recomendacoes.length)
      .populate('upload.usuarioId', 'nomeUsuario profile.avatar');

      recomendacoes = [...recomendacoes, ...populares];
    }

    // Limitar ao número solicitado
    recomendacoes = recomendacoes.slice(0, limit);

    res.json({
      success: true,
      data: {
        recomendacoes,
        preferencias: {
          generoFavorito: preferencias.generoFavorito,
          autorFavorito: preferencias.autorFavorito,
          horarioPreferido: preferencias.horarioPreferido
        },
        total: recomendacoes.length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro ao obter recomendações',
      error: error.message
    });
  }
};

/**
 * Obter recomendações baseadas em uma música específica
 */
const getRecomendacoesPorMusica = async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 10 } = req.query;

    const musica = await Musica.findById(id);

    if (!musica || musica.status !== 'ativo') {
      return res.status(404).json({
        success: false,
        message: 'Música não encontrada'
      });
    }

    // Buscar músicas similares (mesmo gênero e/ou autor)
    const similares = await Musica.find({
      $or: [
        { genero: musica.genero },
        { autor: musica.autor }
      ],
      status: 'ativo',
      visibilidade: 'publico',
      _id: { $ne: musica._id }
    })
    .sort({ 'stats.reproducoes': -1, 'stats.favoritos': -1 })
    .limit(parseInt(limit))
    .populate('upload.usuarioId', 'nomeUsuario profile.avatar');

    res.json({
      success: true,
      data: {
        musica: {
          id: musica._id,
          titulo: musica.titulo,
          autor: musica.autor,
          genero: musica.genero
        },
        similares,
        total: similares.length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro ao obter recomendações',
      error: error.message
    });
  }
};

/**
 * Obter recomendações de playlists
 */
const getRecomendacoesPlaylists = async (req, res) => {
  try {
    const usuarioId = req.user?._id;
    const { limit = 10 } = req.query;

    let playlists = [];

    if (usuarioId) {
      // Analisar preferências
      const preferencias = await Historico.analisarPreferencias(usuarioId);
      
      // Buscar playlists com músicas do gênero favorito
      if (preferencias.generoFavorito) {
        // Buscar músicas do gênero
        const musicasGenero = await Musica.find({
          genero: preferencias.generoFavorito,
          status: 'ativo'
        }).select('_id').limit(100);

        const musicasIds = musicasGenero.map(m => m._id);

        // Buscar playlists que contêm essas músicas
        playlists = await Playlist.find({
          'musicas.musicaId': { $in: musicasIds },
          visibilidade: 'publico',
          status: 'ativo'
        })
        .sort({ 'stats.seguidores': -1, 'stats.reproducoes': -1 })
        .limit(parseInt(limit))
        .populate('usuarioId', 'nomeUsuario profile.avatar');
      }
    }

    // Se não tiver recomendações personalizadas, buscar populares
    if (playlists.length < parseInt(limit)) {
      const populares = await Playlist.buscarPopulares(
        parseInt(limit) - playlists.length,
        playlists.length
      );
      playlists = [...playlists, ...populares];
    }

    res.json({
      success: true,
      data: {
        playlists: playlists.slice(0, parseInt(limit)),
        total: playlists.length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro ao obter recomendações de playlists',
      error: error.message
    });
  }
};

module.exports = {
  getRecomendacoes,
  getRecomendacoesPorMusica,
  getRecomendacoesPlaylists
};

