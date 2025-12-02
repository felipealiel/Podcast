const mongoose = require('mongoose');

// Importar modelos para populate manual
let Musica, Playlist;
try {
  Musica = mongoose.model('Musica');
} catch (e) {
  Musica = require('./Musica');
}
try {
  Playlist = mongoose.model('Playlist');
} catch (e) {
  Playlist = require('./Playlist');
}

const historicoSchema = new mongoose.Schema({
  // Usuário que reproduziu
  usuarioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'ID do usuário é obrigatório'],
    index: true
  },
  
  // Tipo de conteúdo (música, podcast, etc.)
  tipoConteudo: {
    type: String,
    enum: ['musica', 'podcast', 'playlist'],
    required: [true, 'Tipo de conteúdo é obrigatório'],
    index: true
  },
  
  // ID do conteúdo reproduzido
  conteudoId: {
    type: mongoose.Schema.Types.ObjectId,
    required: [true, 'ID do conteúdo é obrigatório'],
    refPath: 'tipoConteudoModel',
    index: true
  },
  
  // Modelo dinâmico baseado no tipo
  tipoConteudoModel: {
    type: String,
    enum: ['Musica', 'Podcast', 'Playlist'],
    required: true
  },
  
  // Informações da reprodução
  reproducao: {
    dataInicio: {
      type: Date,
      default: Date.now
    },
    dataFim: {
      type: Date
    },
    duracaoReproduzida: {
      type: Number, // em segundos
      default: 0
    },
    duracaoTotal: {
      type: Number, // em segundos
      default: 0
    },
    percentualCompleto: {
      type: Number, // 0-100
      default: 0
    },
    foiCompleta: {
      type: Boolean,
      default: false
    }
  },
  
  // Contexto da reprodução
  contexto: {
    dispositivo: {
      type: String,
      enum: ['web', 'mobile', 'desktop', 'smart-tv', 'outros']
    },
    userAgent: String,
    ipAddress: String,
    playlistId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Playlist'
    },
    modoAleatorio: {
      type: Boolean,
      default: false
    }
  },
  
  // Preferências inferidas
  preferencias: {
    generoFavorito: String,
    autorFavorito: String,
    horarioPreferido: String, // manha, tarde, noite, madrugada
    diaSemanaPreferido: String
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Índices para otimização
historicoSchema.index({ usuarioId: 1, createdAt: -1 });
historicoSchema.index({ tipoConteudo: 1, conteudoId: 1 });
historicoSchema.index({ 'reproducao.dataInicio': -1 });
historicoSchema.index({ usuarioId: 1, tipoConteudo: 1 });

// Virtual para verificar se foi reproduzida completamente
historicoSchema.virtual('completa').get(function() {
  return this.reproducao.foiCompleta || 
         this.reproducao.percentualCompleto >= 90;
});

// Método estático para buscar histórico de um usuário
historicoSchema.statics.buscarPorUsuario = async function(usuarioId, options = {}) {
  const { tipoConteudo, limit = 50, skip = 0 } = options;
  
  const query = { usuarioId };
  if (tipoConteudo) {
    query.tipoConteudo = tipoConteudo;
  }
  
  const historicos = await this.find(query)
    .sort({ 'reproducao.dataInicio': -1, createdAt: -1 })
    .limit(limit)
    .skip(skip)
    .lean(); // Usar lean() para melhor performance
  
  // Popular manualmente os conteúdos
  const Musica = mongoose.model('Musica');
  const Playlist = mongoose.model('Playlist');
  
  for (const item of historicos) {
    if (item.conteudoId && item.tipoConteudoModel) {
      try {
        if (item.tipoConteudoModel === 'Musica') {
          const musica = await Musica.findById(item.conteudoId)
            .select('titulo autor ano genero album duracao capa arquivo stats')
            .lean();
          item.conteudoId = musica;
        } else if (item.tipoConteudoModel === 'Playlist') {
          const playlist = await Playlist.findById(item.conteudoId)
            .select('nomePlaylist descricao stats')
            .lean();
          item.conteudoId = playlist;
        }
      } catch (error) {
        console.error('Erro ao popular conteúdo:', error);
        // Manter o ID se não conseguir popular
      }
    }
  }
  
  return historicos;
};

// Método estático para buscar reproduções recentes
historicoSchema.statics.buscarRecentes = function(usuarioId, limite = 10) {
  return this.find({ usuarioId })
    .sort({ 'reproducao.dataInicio': -1 })
    .limit(limite)
    .populate('conteudoId', 'titulo autor ano genero capa duracao');
};

// Método estático para buscar mais reproduzidas
historicoSchema.statics.buscarMaisReproduzidas = function(usuarioId, limite = 20) {
  // Converter para ObjectId se necessário
  const userId = mongoose.Types.ObjectId.isValid(usuarioId) 
    ? new mongoose.Types.ObjectId(usuarioId)
    : usuarioId;
  
  return this.aggregate([
    { $match: { usuarioId: userId } },
    {
      $group: {
        _id: '$conteudoId',
        totalReproducoes: { $sum: 1 },
        ultimaReproducao: { $max: '$reproducao.dataInicio' },
        duracaoTotal: { $sum: '$reproducao.duracaoReproduzida' }
      }
    },
    { $sort: { totalReproducoes: -1, ultimaReproducao: -1 } },
    { $limit: limite }
  ]);
};

// Método estático para analisar preferências do usuário
historicoSchema.statics.analisarPreferencias = async function(usuarioId) {
  const historico = await this.find({ usuarioId })
    .populate('conteudoId', 'genero autor ano');
  
  const generos = {};
  const autores = {};
  const horarios = {};
  
  historico.forEach(item => {
    // Gêneros
    if (item.conteudoId && item.conteudoId.genero) {
      generos[item.conteudoId.genero] = (generos[item.conteudoId.genero] || 0) + 1;
    }
    
    // Autores
    if (item.conteudoId && item.conteudoId.autor) {
      autores[item.conteudoId.autor] = (autores[item.conteudoId.autor] || 0) + 1;
    }
    
    // Horários
    if (item.reproducao && item.reproducao.dataInicio) {
      const hora = new Date(item.reproducao.dataInicio).getHours();
      let periodo = 'madrugada';
      if (hora >= 6 && hora < 12) periodo = 'manha';
      else if (hora >= 12 && hora < 18) periodo = 'tarde';
      else if (hora >= 18 && hora < 24) periodo = 'noite';
      
      horarios[periodo] = (horarios[periodo] || 0) + 1;
    }
  });
  
  // Encontrar preferências mais frequentes
  const generoFavorito = Object.keys(generos).reduce((a, b) => 
    generos[a] > generos[b] ? a : b, Object.keys(generos)[0] || null
  );
  
  const autorFavorito = Object.keys(autores).reduce((a, b) => 
    autores[a] > autores[b] ? a : b, Object.keys(autores)[0] || null
  );
  
  const horarioPreferido = Object.keys(horarios).reduce((a, b) => 
    horarios[a] > horarios[b] ? a : b, Object.keys(horarios)[0] || null
  );
  
  return {
    generoFavorito,
    autorFavorito,
    horarioPreferido,
    totalReproducoes: historico.length,
    estatisticas: {
      generos,
      autores,
      horarios
    }
  };
};

module.exports = mongoose.model('Historico', historicoSchema);

