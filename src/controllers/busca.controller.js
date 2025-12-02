const Musica = require('../models/Musica');
const Playlist = require('../models/Playlist');
const Favorito = require('../models/Favorito');

/**
 * RF03 - Busca e filtragem de conteúdo
 * Controller para busca e filtros
 */

/**
 * Busca geral de conteúdo
 */
const buscar = async (req, res) => {
  try {
    const { q, tipo = 'todos', limit = 20, skip = 0 } = req.query;

    if (!q || q.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Termo de busca é obrigatório'
      });
    }

    const resultados = {
      musicas: [],
      playlists: [],
      total: 0
    };

    // Buscar músicas
    if (tipo === 'todos' || tipo === 'musicas') {
      const musicas = await Musica.find({
        $text: { $search: q },
        status: 'ativo',
        visibilidade: 'publico'
      })
      .sort({ score: { $meta: 'textScore' } })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .populate('upload.usuarioId', 'nomeUsuario profile.avatar');

      resultados.musicas = musicas;
    }

    // Buscar playlists
    if (tipo === 'todos' || tipo === 'playlists') {
      const playlists = await Playlist.find({
        $text: { $search: q },
        status: 'ativo',
        visibilidade: 'publico'
      })
      .sort({ score: { $meta: 'textScore' } })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .populate('usuarioId', 'nomeUsuario profile.avatar');

      resultados.playlists = playlists;
    }

    resultados.total = resultados.musicas.length + resultados.playlists.length;

    res.json({
      success: true,
      data: resultados,
      query: q,
      pagination: {
        limit: parseInt(limit),
        skip: parseInt(skip)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro ao realizar busca',
      error: error.message
    });
  }
};

/**
 * Buscar músicas com filtros avançados
 */
const buscarMusicas = async (req, res) => {
  try {
    const {
      q,
      genero,
      autor,
      ano,
      anoMin,
      anoMax,
      album,
      ordenar = 'relevancia',
      limit = 20,
      skip = 0
    } = req.query;

    // Construir query
    const query = {
      status: 'ativo',
      visibilidade: 'publico'
    };

    // Busca por texto
    if (q && q.trim() !== '') {
      query.$text = { $search: q };
    }

    // Filtros
    if (genero) query.genero = genero;
    if (autor) query.autor = new RegExp(autor, 'i');
    if (album) query.album = new RegExp(album, 'i');
    
    if (ano) {
      query.ano = parseInt(ano);
    } else if (anoMin || anoMax) {
      query.ano = {};
      if (anoMin) query.ano.$gte = parseInt(anoMin);
      if (anoMax) query.ano.$lte = parseInt(anoMax);
    }

    // Ordenação
    let sort = {};
    switch (ordenar) {
      case 'relevancia':
        if (q) {
          sort = { score: { $meta: 'textScore' } };
        } else {
          sort = { 'stats.reproducoes': -1 };
        }
        break;
      case 'reproducoes':
        sort = { 'stats.reproducoes': -1 };
        break;
      case 'favoritos':
        sort = { 'stats.favoritos': -1 };
        break;
      case 'recente':
        sort = { 'upload.dataUpload': -1 };
        break;
      case 'antigo':
        sort = { 'upload.dataUpload': 1 };
        break;
      case 'ano':
        sort = { ano: -1 };
        break;
      case 'titulo':
        sort = { titulo: 1 };
        break;
      default:
        sort = { 'stats.reproducoes': -1 };
    }

    const musicas = await Musica.find(query)
      .sort(sort)
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .populate('upload.usuarioId', 'nomeUsuario profile.avatar');

    const total = await Musica.countDocuments(query);

    res.json({
      success: true,
      data: musicas,
      filters: { q, genero, autor, ano, anoMin, anoMax, album },
      ordenar,
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
 * Buscar por gênero
 */
const buscarPorGenero = async (req, res) => {
  try {
    const { genero } = req.params;
    const { limit = 20, skip = 0 } = req.query;

    const musicas = await Musica.buscarPorGenero(genero, parseInt(limit), parseInt(skip));

    const total = await Musica.countDocuments({
      genero,
      status: 'ativo',
      visibilidade: 'publico'
    });

    res.json({
      success: true,
      data: musicas,
      genero,
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
      message: 'Erro ao buscar por gênero',
      error: error.message
    });
  }
};

/**
 * Buscar por autor
 */
const buscarPorAutor = async (req, res) => {
  try {
    const { autor } = req.params;
    const { limit = 20, skip = 0 } = req.query;

    const musicas = await Musica.buscarPorAutor(autor, parseInt(limit), parseInt(skip));

    const total = await Musica.countDocuments({
      autor: new RegExp(autor, 'i'),
      status: 'ativo',
      visibilidade: 'publico'
    });

    res.json({
      success: true,
      data: musicas,
      autor,
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
      message: 'Erro ao buscar por autor',
      error: error.message
    });
  }
};

/**
 * Buscar mais populares
 */
const maisPopulares = async (req, res) => {
  try {
    const { limit = 20, skip = 0, periodo = 'todos' } = req.query;

    const query = {
      status: 'ativo',
      visibilidade: 'publico'
    };

    if (periodo === 'semana') {
      const semanaAtras = new Date();
      semanaAtras.setDate(semanaAtras.getDate() - 7);
      query['upload.dataUpload'] = { $gte: semanaAtras };
    } else if (periodo === 'mes') {
      const mesAtras = new Date();
      mesAtras.setMonth(mesAtras.getMonth() - 1);
      query['upload.dataUpload'] = { $gte: mesAtras };
    }

    const musicas = await Musica.find(query)
      .sort({ 'stats.reproducoes': -1, 'stats.favoritos': -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .populate('upload.usuarioId', 'nomeUsuario profile.avatar');

    const total = await Musica.countDocuments(query);

    res.json({
      success: true,
      data: musicas,
      periodo,
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
      message: 'Erro ao buscar músicas populares',
      error: error.message
    });
  }
};

/**
 * Buscar recentes
 */
const recentes = async (req, res) => {
  try {
    const { limit = 20, skip = 0 } = req.query;

    const musicas = await Musica.buscarRecentes(parseInt(limit), parseInt(skip));

    const total = await Musica.countDocuments({
      status: 'ativo',
      visibilidade: 'publico'
    });

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
      message: 'Erro ao buscar músicas recentes',
      error: error.message
    });
  }
};

/**
 * Buscar recomendações baseadas no histórico do usuário
 */
const recomendacoes = async (req, res) => {
  try {
    const usuarioId = req.user?._id;
    const { limit = 20 } = req.query;

    let musicas = [];

    if (usuarioId) {
      // Buscar preferências do usuário
      const Historico = require('../models/Historico');
      const preferencias = await Historico.analisarPreferencias(usuarioId);

      // Buscar músicas do gênero favorito
      if (preferencias.generoFavorito) {
        musicas = await Musica.find({
          genero: preferencias.generoFavorito,
          status: 'ativo',
          visibilidade: 'publico'
        })
        .sort({ 'stats.reproducoes': -1 })
        .limit(parseInt(limit))
        .populate('upload.usuarioId', 'nomeUsuario profile.avatar');
      }

      // Se não houver histórico suficiente, buscar mais populares
      if (musicas.length < parseInt(limit)) {
        const populares = await Musica.buscarPopulares(
          parseInt(limit) - musicas.length,
          musicas.length
        );
        musicas = [...musicas, ...populares];
      }
    } else {
      // Sem usuário, mostrar mais populares
      musicas = await Musica.buscarPopulares(parseInt(limit), 0);
    }

    res.json({
      success: true,
      data: musicas
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar recomendações',
      error: error.message
    });
  }
};

module.exports = {
  buscar,
  buscarMusicas,
  buscarPorGenero,
  buscarPorAutor,
  maisPopulares,
  recentes,
  recomendacoes
};

