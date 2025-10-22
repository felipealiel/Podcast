const mongoose = require('mongoose');

const playlistSchema = new mongoose.Schema({
  // Informações básicas
  nomePlaylist: {
    type: String,
    required: [true, 'Nome da playlist é obrigatório'],
    trim: true,
    maxlength: [100, 'Nome não pode ter mais de 100 caracteres']
  },
  
  descricao: {
    type: String,
    trim: true,
    maxlength: [500, 'Descrição não pode ter mais de 500 caracteres']
  },
  
  // Proprietário da playlist
  usuarioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'ID do usuário é obrigatório']
  },
  
  // Músicas da playlist
  musicas: [{
    musicaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Musica',
      required: true
    },
    adicionadaEm: {
      type: Date,
      default: Date.now
    },
    ordem: {
      type: Number,
      required: true
    }
  }],
  
  // Capa da playlist
  capa: {
    filename: String,
    path: String,
    url: String
  },
  
  // Configurações de visibilidade
  visibilidade: {
    type: String,
    enum: ['publico', 'privado', 'nao-listado'],
    default: 'publico'
  },
  
  // Status
  status: {
    type: String,
    enum: ['ativo', 'inativo', 'removido'],
    default: 'ativo'
  },
  
  // Estatísticas
  stats: {
    totalMusicas: {
      type: Number,
      default: 0
    },
    duracaoTotal: {
      type: Number, // em segundos
      default: 0
    },
    reproducoes: {
      type: Number,
      default: 0
    },
    seguidores: {
      type: Number,
      default: 0
    },
    compartilhamentos: {
      type: Number,
      default: 0
    }
  },
  
  // Configurações
  configuracoes: {
    permiteColaboracao: {
      type: Boolean,
      default: false
    },
    permiteCompartilhamento: {
      type: Boolean,
      default: true
    },
    ordemAleatoria: {
      type: Boolean,
      default: false
    },
    repeticao: {
      type: String,
      enum: ['nenhuma', 'toda', 'musica'],
      default: 'nenhuma'
    }
  },
  
  // Colaboradores (se permitir colaboração)
  colaboradores: [{
    usuarioId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    adicionadoEm: {
      type: Date,
      default: Date.now
    },
    permissoes: {
      podeAdicionar: {
        type: Boolean,
        default: true
      },
      podeRemover: {
        type: Boolean,
        default: false
      },
      podeEditar: {
        type: Boolean,
        default: false
      }
    }
  }],
  
  // Tags para categorização
  tags: [{
    type: String,
    trim: true,
    maxlength: [30, 'Tag não pode ter mais de 30 caracteres']
  }],
  
  // Tipo de playlist
  tipo: {
    type: String,
    enum: ['personalizada', 'descoberta-semanal', 'top-50', 'recomendada', 'favoritos'],
    default: 'personalizada'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Índices para otimização
playlistSchema.index({ nomePlaylist: 'text', descricao: 'text' });
playlistSchema.index({ usuarioId: 1 });
playlistSchema.index({ visibilidade: 1 });
playlistSchema.index({ status: 1 });
playlistSchema.index({ 'stats.seguidores': -1 });
playlistSchema.index({ 'stats.reproducoes': -1 });
playlistSchema.index({ tags: 1 });
playlistSchema.index({ tipo: 1 });
playlistSchema.index({ createdAt: -1 });

// Índice composto para sharding
playlistSchema.index({ usuarioId: 1, _id: 1 });

// Virtual para URL da capa
playlistSchema.virtual('capaUrl').get(function() {
  if (this.capa && this.capa.url) {
    return this.capa.url;
  }
  return `${process.env.STREAMING_BASE_URL}/default-playlist-cover.jpg`;
});

// Virtual para duração total formatada
playlistSchema.virtual('duracaoTotalFormatada').get(function() {
  const horas = Math.floor(this.stats.duracaoTotal / 3600);
  const minutos = Math.floor((this.stats.duracaoTotal % 3600) / 60);
  
  if (horas > 0) {
    return `${horas}h ${minutos}min`;
  }
  return `${minutos}min`;
});

// Virtual para verificar se é pública
playlistSchema.virtual('isPublica').get(function() {
  return this.visibilidade === 'publico';
});

// Virtual para verificar se está ativa
playlistSchema.virtual('isAtiva').get(function() {
  return this.status === 'ativo';
});

// Middleware para atualizar estatísticas quando músicas são modificadas
playlistSchema.pre('save', async function(next) {
  if (this.isModified('musicas')) {
    // Atualizar total de músicas
    this.stats.totalMusicas = this.musicas.length;
    
    // Calcular duração total (se necessário)
    if (this.musicas.length > 0) {
      const Musica = mongoose.model('Musica');
      const musicaIds = this.musicas.map(m => m.musicaId);
      const musicas = await Musica.find({ _id: { $in: musicaIds } });
      this.stats.duracaoTotal = musicas.reduce((total, musica) => total + musica.duracao, 0);
    } else {
      this.stats.duracaoTotal = 0;
    }
  }
  next();
});

// Método para adicionar música
playlistSchema.methods.adicionarMusica = async function(musicaId) {
  // Verificar se música já está na playlist
  const musicaExiste = this.musicas.some(
    m => m.musicaId.toString() === musicaId.toString()
  );
  
  if (musicaExiste) {
    throw new Error('Música já está na playlist');
  }
  
  // Adicionar música com ordem baseada no tamanho atual
  const ordem = this.musicas.length + 1;
  this.musicas.push({
    musicaId,
    adicionadaEm: new Date(),
    ordem
  });
  
  // Incrementar contador na música
  const Musica = mongoose.model('Musica');
  await Musica.findByIdAndUpdate(musicaId, {
    $inc: { 'stats.adicionadasPlaylists': 1 }
  });
  
  return this.save();
};

// Método para remover música
playlistSchema.methods.removerMusica = async function(musicaId) {
  const musicaIndex = this.musicas.findIndex(
    m => m.musicaId.toString() === musicaId.toString()
  );
  
  if (musicaIndex === -1) {
    throw new Error('Música não encontrada na playlist');
  }
  
  this.musicas.splice(musicaIndex, 1);
  
  // Reordenar músicas restantes
  this.musicas.forEach((musica, index) => {
    musica.ordem = index + 1;
  });
  
  // Decrementar contador na música
  const Musica = mongoose.model('Musica');
  await Musica.findByIdAndUpdate(musicaId, {
    $inc: { 'stats.adicionadasPlaylists': -1 }
  });
  
  return this.save();
};

// Método para reordenar músicas
playlistSchema.methods.reordenarMusicas = function(novaOrdem) {
  // novaOrdem é um array de IDs na nova ordem
  const musicasReordenadas = [];
  
  novaOrdem.forEach((musicaId, index) => {
    const musica = this.musicas.find(
      m => m.musicaId.toString() === musicaId.toString()
    );
    if (musica) {
      musica.ordem = index + 1;
      musicasReordenadas.push(musica);
    }
  });
  
  this.musicas = musicasReordenadas;
  return this.save();
};

// Método para adicionar colaborador
playlistSchema.methods.adicionarColaborador = function(usuarioId, permissoes = {}) {
  // Verificar se já é colaborador
  const colaboradorExiste = this.colaboradores.some(
    c => c.usuarioId.toString() === usuarioId.toString()
  );
  
  if (colaboradorExiste) {
    throw new Error('Usuário já é colaborador desta playlist');
  }
  
  this.colaboradores.push({
    usuarioId,
    adicionadoEm: new Date(),
    permissoes: {
      podeAdicionar: permissoes.podeAdicionar !== false,
      podeRemover: permissoes.podeRemover === true,
      podeEditar: permissoes.podeEditar === true
    }
  });
  
  return this.save();
};

// Método para remover colaborador
playlistSchema.methods.removerColaborador = function(usuarioId) {
  this.colaboradores = this.colaboradores.filter(
    c => c.usuarioId.toString() !== usuarioId.toString()
  );
  return this.save();
};

// Método para incrementar reproduções
playlistSchema.methods.incrementarReproducoes = function() {
  this.stats.reproducoes += 1;
  return this.save();
};

// Método para incrementar seguidores
playlistSchema.methods.incrementarSeguidores = function() {
  this.stats.seguidores += 1;
  return this.save();
};

// Método para decrementar seguidores
playlistSchema.methods.decrementarSeguidores = function() {
  if (this.stats.seguidores > 0) {
    this.stats.seguidores -= 1;
  }
  return this.save();
};

// Método para incrementar compartilhamentos
playlistSchema.methods.incrementarCompartilhamentos = function() {
  this.stats.compartilhamentos += 1;
  return this.save();
};

// Método estático para buscar playlists públicas
playlistSchema.statics.buscarPublicas = function(limit = 20, skip = 0) {
  return this.find({ 
    visibilidade: 'publico',
    status: 'ativo' 
  })
  .sort({ 'stats.seguidores': -1, createdAt: -1 })
  .limit(limit)
  .skip(skip)
  .populate('usuarioId', 'username profile.avatar');
};

// Método estático para buscar playlists de um usuário
playlistSchema.statics.buscarPorUsuario = function(usuarioId, limit = 20, skip = 0) {
  return this.find({ 
    usuarioId,
    status: 'ativo' 
  })
  .sort({ createdAt: -1 })
  .limit(limit)
  .skip(skip)
  .populate('musicas.musicaId', 'titulo autor capa');
};

// Método estático para buscar playlists mais populares
playlistSchema.statics.buscarPopulares = function(limit = 20, skip = 0) {
  return this.find({ 
    visibilidade: 'publico',
    status: 'ativo' 
  })
  .sort({ 'stats.seguidores': -1, 'stats.reproducoes': -1 })
  .limit(limit)
  .skip(skip)
  .populate('usuarioId', 'username profile.avatar');
};

// Método estático para buscar playlists por tipo
playlistSchema.statics.buscarPorTipo = function(tipo, limit = 20, skip = 0) {
  return this.find({ 
    tipo,
    visibilidade: 'publico',
    status: 'ativo' 
  })
  .sort({ 'stats.seguidores': -1 })
  .limit(limit)
  .skip(skip)
  .populate('usuarioId', 'username profile.avatar');
};

module.exports = mongoose.model('Playlist', playlistSchema);
