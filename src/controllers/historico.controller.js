const Historico = require('../models/Historico');
const Musica = require('../models/Musica');
const Playlist = require('../models/Playlist');
const databaseManager = require('../config/database');

/**
 * RF04 - Histórico e preferências do usuário
 * Controller para gerenciar histórico de reproduções
 */

/**
 * Registrar reprodução
 */
const registrarReproducao = async (req, res) => {
  try {
    const { tipoConteudo, conteudoId, duracaoReproduzida, duracaoTotal } = req.body;
    const usuarioId = req.user._id;

    // Validar tipo de conteúdo
    const tiposValidos = ['musica', 'podcast', 'playlist'];
    if (!tiposValidos.includes(tipoConteudo)) {
      return res.status(400).json({
        success: false,
        message: 'Tipo de conteúdo inválido'
      });
    }

    // Mapear tipo para modelo
    const modeloMap = {
      musica: 'Musica',
      podcast: 'Podcast',
      playlist: 'Playlist'
    };

    // Verificar se conteúdo existe
    const ConteudoModel = require(`../models/${modeloMap[tipoConteudo]}`);
    const conteudo = await ConteudoModel.findById(conteudoId);

    if (!conteudo || conteudo.status !== 'ativo') {
      return res.status(404).json({
        success: false,
        message: 'Conteúdo não encontrado'
      });
    }

    // Calcular percentual completo
    const percentualCompleto = duracaoTotal > 0 
      ? Math.round((duracaoReproduzida / duracaoTotal) * 100)
      : 0;
    const foiCompleta = percentualCompleto >= 90;

    // Determinar horário preferido
    const agora = new Date();
    const hora = agora.getHours();
    let horarioPreferido = 'madrugada';
    if (hora >= 6 && hora < 12) horarioPreferido = 'manha';
    else if (hora >= 12 && hora < 18) horarioPreferido = 'tarde';
    else if (hora >= 18 && hora < 24) horarioPreferido = 'noite';

    // Criar registro de histórico
    const historico = new Historico({
      usuarioId,
      tipoConteudo,
      conteudoId,
      tipoConteudoModel: modeloMap[tipoConteudo],
      reproducao: {
        dataInicio: agora,
        duracaoReproduzida,
        duracaoTotal,
        percentualCompleto,
        foiCompleta
      },
      contexto: {
        dispositivo: req.body.dispositivo || 'web',
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip || req.connection.remoteAddress,
        playlistId: req.body.playlistId,
        modoAleatorio: req.body.modoAleatorio || false
      },
      preferencias: {
        horarioPreferido
      }
    });

    // Salvar em todos os clusters
    await databaseManager.writeToAllClusters(
      'historicos',
      'insertOne',
      historico.toObject()
    );

    // Incrementar reproduções no conteúdo
    if (tipoConteudo === 'musica' && conteudo.incrementarReproducoes) {
      await conteudo.incrementarReproducoes();
    }

    res.status(201).json({
      success: true,
      message: 'Reprodução registrada com sucesso',
      data: historico
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro ao registrar reprodução',
      error: error.message
    });
  }
};

/**
 * Buscar histórico do usuário
 */
const meuHistorico = async (req, res) => {
  try {
    const usuarioId = req.user._id;
    const { tipoConteudo, limit = 50, skip = 0 } = req.query;

    console.log('📋 [HISTORICO] Buscando histórico para usuário:', usuarioId);

    const historico = await Historico.buscarPorUsuario(usuarioId, {
      tipoConteudo,
      limit: parseInt(limit),
      skip: parseInt(skip)
    });

    console.log('📋 [HISTORICO] Histórico encontrado:', historico.length, 'itens');
    if (historico.length > 0) {
      console.log('📋 [HISTORICO] Primeiro item:', {
        _id: historico[0]._id,
        conteudoId: historico[0].conteudoId?._id || historico[0].conteudoId,
        conteudoPopulado: !!historico[0].conteudoId?.titulo,
        titulo: historico[0].conteudoId?.titulo
      });
    }

    const query = { usuarioId };
    if (tipoConteudo) query.tipoConteudo = tipoConteudo;
    const total = await Historico.countDocuments(query);

    res.json({
      success: true,
      data: historico,
      pagination: {
        total,
        limit: parseInt(limit),
        skip: parseInt(skip),
        hasMore: total > parseInt(skip) + parseInt(limit)
      }
    });
  } catch (error) {
    console.error('❌ [HISTORICO] Erro ao buscar histórico:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar histórico',
      error: error.message
    });
  }
};

/**
 * Buscar reproduções recentes
 */
const reproducoesRecentes = async (req, res) => {
  try {
    const usuarioId = req.user._id;
    const { limit = 10 } = req.query;

    const recentes = await Historico.buscarRecentes(usuarioId, parseInt(limit));

    res.json({
      success: true,
      data: recentes
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar reproduções recentes',
      error: error.message
    });
  }
};

/**
 * Buscar músicas mais reproduzidas pelo usuário
 */
const maisReproduzidas = async (req, res) => {
  try {
    const usuarioId = req.user._id;
    const { limit = 20 } = req.query;

    const maisReproduzidas = await Historico.buscarMaisReproduzidas(
      usuarioId,
      parseInt(limit)
    );

    // Popular com dados das músicas
    const musicasIds = maisReproduzidas.map(item => item._id);
    const musicas = await Musica.find({ _id: { $in: musicasIds } });

    // Combinar dados
    const resultado = maisReproduzidas.map(item => {
      const musica = musicas.find(m => m._id.toString() === item._id.toString());
      return {
        musica,
        totalReproducoes: item.totalReproducoes,
        ultimaReproducao: item.ultimaReproducao,
        duracaoTotal: item.duracaoTotal
      };
    });

    res.json({
      success: true,
      data: resultado
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar músicas mais reproduzidas',
      error: error.message
    });
  }
};

/**
 * Analisar preferências do usuário
 */
const minhasPreferencias = async (req, res) => {
  try {
    const usuarioId = req.user._id;

    const preferencias = await Historico.analisarPreferencias(usuarioId);

    res.json({
      success: true,
      data: preferencias
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro ao analisar preferências',
      error: error.message
    });
  }
};

/**
 * Limpar histórico
 */
const limparHistorico = async (req, res) => {
  try {
    const usuarioId = req.user._id;
    const { tipoConteudo } = req.query;

    const query = { usuarioId };
    if (tipoConteudo) query.tipoConteudo = tipoConteudo;

    // Deletar de todos os clusters
    await databaseManager.writeToAllClusters(
      'historicos',
      'deleteMany',
      query
    );

    res.json({
      success: true,
      message: 'Histórico limpo com sucesso'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro ao limpar histórico',
      error: error.message
    });
  }
};

module.exports = {
  registrarReproducao,
  meuHistorico,
  reproducoesRecentes,
  maisReproduzidas,
  minhasPreferencias,
  limparHistorico
};

