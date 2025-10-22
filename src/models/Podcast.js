const mongoose = require('mongoose');

const podcastSchema = new mongoose.Schema({
  // Informações básicas
  titulo: {
    type: String,
    required: [true, 'Título do podcast é obrigatório'],
    trim: true,
    maxlength: [200, 'Título não pode ter mais de 200 caracteres']
  },
  
  autor: {
    type: String,
    required: [true, 'Autor do podcast é obrigatório'],
    trim: true,
    maxlength: [100, 'Nome do autor não pode ter mais de 100 caracteres']
  },
  
  ano: {
    type: Number,
    required: [true, 'Ano é obrigatório'],
    min: [1900, 'Ano deve ser maior que 1900'],
    max: [new Date().getFullYear() + 1, 'Ano não pode ser no futuro']
  },
  
  // Descrição e detalhes
  descricao: {
    type: String,
    trim: true,
    maxlength: [2000, 'Descrição não pode ter mais de 2000 caracteres']
  },
  
  // Arquivo de áudio
  arquivo: {
    filename: {
      type: String,
      required: true
    },
    path: {
      type: String,
      required: true
    },
    url: {
      type: String,
      required: true
    },
    tamanho: {
      type: Number, // em bytes
      required: true
    },
    duracao: {
      type: Number, // em segundos
      required: true
    },
    formato: {
      type: String,
      enum: ['mp3', 'wav', 'aac', 'ogg', 'm4a'],
      default: 'mp3'
    },
    bitrate: {
      type: Number // em kbps
    }
  },
  
  // Capa/Thumbnail
  capa: {
    filename: String,
    path: String,
    url: String
  },
  
  // Categorização
  categoria: {
    type: String,
    required: [true, 'Categoria é obrigatória'],
    enum: [
      'Educação', 'Entretenimento', 'Notícias', 'Tecnologia', 
      'Esportes', 'Música', 'Comédia', 'Negócios', 'Saúde',
      'Ciência', 'História', 'Política', 'Cultura', 'Outros'
    ]
  },
  
  tags: [{
    type: String,
    trim: true,
    maxlength: [30, 'Tag não pode ter mais de 30 caracteres']
  }],
  
  // Avaliações
  avaliacoes: {
    total: {
      type: Number,
      default: 0
    },
    soma: {
      type: Number,
      default: 0
    },
    media: {
      type: Number,
      default: 0
    },
    detalhes: [{
      usuarioId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      nota: {
        type: Number,
        required: true,
        min: 1,
        max: 5
      },
      comentario: {
        type: String,
        maxlength: [500, 'Comentário não pode ter mais de 500 caracteres']
      },
      dataAvaliacao: {
        type: Date,
        default: Date.now
      }
    }]
  },
  
  // Estatísticas
  stats: {
    reproducoes: {
      type: Number,
      default: 0
    },
    downloads: {
      type: Number,
      default: 0
    },
    favoritos: {
      type: Number,
      default: 0
    },
    compartilhamentos: {
      type: Number,
      default: 0
    }
  },
  
  // Status e visibilidade
  status: {
    type: String,
    enum: ['ativo', 'inativo', 'removido'],
    default: 'ativo'
  },
  
  visibilidade: {
    type: String,
    enum: ['publico', 'privado'],
    default: 'publico'
  },
  
  // Informações do upload
  upload: {
    usuarioId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    dataUpload: {
      type: Date,
      default: Date.now
    },
    ipAddress: String,
    userAgent: String
  },
  
  // Configurações
  configuracoes: {
    permiteDownload: {
      type: Boolean,
      default: true
    },
    permiteComentarios: {
      type: Boolean,
      default: true
    },
    permiteAvaliacoes: {
      type: Boolean,
      default: true
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Índices para otimização
podcastSchema.index({ titulo: 'text', descricao: 'text' });
podcastSchema.index({ autor: 1 });
podcastSchema.index({ ano: -1 });
podcastSchema.index({ categoria: 1 });
podcastSchema.index({ tags: 1 });
podcastSchema.index({ 'avaliacoes.media': -1 });
podcastSchema.index({ 'stats.reproducoes': -1 });
podcastSchema.index({ status: 1 });
podcastSchema.index({ 'upload.usuarioId': 1 });
podcastSchema.index({ 'upload.dataUpload': -1 });

// Índice composto para sharding
podcastSchema.index({ categoria: 1, _id: 1 });

// Virtual para URL do podcast
podcastSchema.virtual('podcastUrl').get(function() {
  return this.arquivo.url;
});

// Virtual para URL da capa
podcastSchema.virtual('capaUrl').get(function() {
  if (this.capa && this.capa.url) {
    return this.capa.url;
  }
  return `${process.env.STREAMING_BASE_URL}/default-podcast-cover.jpg`;
});

// Virtual para duração formatada
podcastSchema.virtual('duracaoFormatada').get(function() {
  const horas = Math.floor(this.arquivo.duracao / 3600);
  const minutos = Math.floor((this.arquivo.duracao % 3600) / 60);
  const segundos = this.arquivo.duracao % 60;
  
  if (horas > 0) {
    return `${horas}:${minutos.toString().padStart(2, '0')}:${segundos.toString().padStart(2, '0')}`;
  }
  return `${minutos}:${segundos.toString().padStart(2, '0')}`;
});

// Virtual para tamanho formatado
podcastSchema.virtual('tamanhoFormatado').get(function() {
  const bytes = this.arquivo.tamanho;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 Bytes';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
});

// Virtual para verificar se está ativo
podcastSchema.virtual('isAtivo').get(function() {
  return this.status === 'ativo';
});

// Middleware para calcular média das avaliações
podcastSchema.pre('save', function(next) {
  if (this.avaliacoes.total > 0) {
    this.avaliacoes.media = Math.round((this.avaliacoes.soma / this.avaliacoes.total) * 10) / 10;
  } else {
    this.avaliacoes.media = 0;
  }
  next();
});

// Método para adicionar avaliação
podcastSchema.methods.adicionarAvaliacao = function(usuarioId, nota, comentario = '') {
  // Verificar se usuário já avaliou
  const avaliacaoExistente = this.avaliacoes.detalhes.find(
    av => av.usuarioId.toString() === usuarioId.toString()
  );
  
  if (avaliacaoExistente) {
    // Atualizar avaliação existente
    const diferenca = nota - avaliacaoExistente.nota;
    this.avaliacoes.soma += diferenca;
    avaliacaoExistente.nota = nota;
    avaliacaoExistente.comentario = comentario;
    avaliacaoExistente.dataAvaliacao = new Date();
  } else {
    // Adicionar nova avaliação
    this.avaliacoes.detalhes.push({
      usuarioId,
      nota,
      comentario,
      dataAvaliacao: new Date()
    });
    this.avaliacoes.total += 1;
    this.avaliacoes.soma += nota;
  }
  
  return this.save();
};

// Método para remover avaliação
podcastSchema.methods.removerAvaliacao = function(usuarioId) {
  const avaliacaoIndex = this.avaliacoes.detalhes.findIndex(
    av => av.usuarioId.toString() === usuarioId.toString()
  );
  
  if (avaliacaoIndex !== -1) {
    const avaliacao = this.avaliacoes.detalhes[avaliacaoIndex];
    this.avaliacoes.soma -= avaliacao.nota;
    this.avaliacoes.total -= 1;
    this.avaliacoes.detalhes.splice(avaliacaoIndex, 1);
  }
  
  return this.save();
};

// Método para incrementar reproduções
podcastSchema.methods.incrementarReproducoes = function() {
  this.stats.reproducoes += 1;
  return this.save();
};

// Método para incrementar downloads
podcastSchema.methods.incrementarDownloads = function() {
  this.stats.downloads += 1;
  return this.save();
};

// Método para incrementar favoritos
podcastSchema.methods.incrementarFavoritos = function() {
  this.stats.favoritos += 1;
  return this.save();
};

// Método para decrementar favoritos
podcastSchema.methods.decrementarFavoritos = function() {
  if (this.stats.favoritos > 0) {
    this.stats.favoritos -= 1;
  }
  return this.save();
};

// Método para incrementar compartilhamentos
podcastSchema.methods.incrementarCompartilhamentos = function() {
  this.stats.compartilhamentos += 1;
  return this.save();
};

// Método estático para buscar podcasts por categoria
podcastSchema.statics.buscarPorCategoria = function(categoria, limit = 20, skip = 0) {
  return this.find({ 
    categoria, 
    status: 'ativo',
    visibilidade: 'publico' 
  })
  .sort({ 'upload.dataUpload': -1 })
  .limit(limit)
  .skip(skip)
  .populate('upload.usuarioId', 'username profile.avatar');
};

// Método estático para buscar podcasts por autor
podcastSchema.statics.buscarPorAutor = function(autor, limit = 20, skip = 0) {
  return this.find({ 
    autor: new RegExp(autor, 'i'),
    status: 'ativo',
    visibilidade: 'publico' 
  })
  .sort({ ano: -1, 'upload.dataUpload': -1 })
  .limit(limit)
  .skip(skip)
  .populate('upload.usuarioId', 'username profile.avatar');
};

// Método estático para buscar podcasts mais populares
podcastSchema.statics.buscarPopulares = function(limit = 20, skip = 0) {
  return this.find({ 
    status: 'ativo',
    visibilidade: 'publico' 
  })
  .sort({ 'stats.reproducoes': -1, 'avaliacoes.media': -1 })
  .limit(limit)
  .skip(skip)
  .populate('upload.usuarioId', 'username profile.avatar');
};

// Método estático para buscar podcasts mais bem avaliados
podcastSchema.statics.buscarMaisAvaliados = function(limit = 20, skip = 0) {
  return this.find({ 
    status: 'ativo',
    visibilidade: 'publico',
    'avaliacoes.total': { $gte: 5 } // Pelo menos 5 avaliações
  })
  .sort({ 'avaliacoes.media': -1, 'avaliacoes.total': -1 })
  .limit(limit)
  .skip(skip)
  .populate('upload.usuarioId', 'username profile.avatar');
};

// Método estático para buscar podcasts recentes
podcastSchema.statics.buscarRecentes = function(limit = 20, skip = 0) {
  return this.find({ 
    status: 'ativo',
    visibilidade: 'publico' 
  })
  .sort({ 'upload.dataUpload': -1 })
  .limit(limit)
  .skip(skip)
  .populate('upload.usuarioId', 'username profile.avatar');
};

module.exports = mongoose.model('Podcast', podcastSchema);
