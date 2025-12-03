const mongoose = require('mongoose');

const musicaSchema = new mongoose.Schema({
  // Informações básicas
  titulo: {
    type: String,
    required: [true, 'Título da música é obrigatório'],
    trim: true,
    maxlength: [200, 'Título não pode ter mais de 200 caracteres']
  },
  
  autor: {
    type: String,
    required: [true, 'Autor da música é obrigatório'],
    trim: true,
    maxlength: [100, 'Nome do autor não pode ter mais de 100 caracteres']
  },
  
  ano: {
    type: Number,
    required: [true, 'Ano é obrigatório'],
    min: [1900, 'Ano deve ser maior que 1900'],
    max: [new Date().getFullYear() + 1, 'Ano não pode ser no futuro']
  },
  
  genero: {
    type: String,
    required: [true, 'Gênero é obrigatório'],
    enum: [
      'Pop', 'Rock', 'Hip Hop', 'R&B', 'Country', 'Jazz', 'Blues', 
      'Classical', 'Electronic', 'Folk', 'Reggae', 'Funk', 'Soul',
      'Gospel', 'Alternative', 'Indie', 'Metal', 'Punk', 'Ska',
      'Bossa Nova', 'Sertanejo', 'Forró', 'Axé', 'MPB', 'Funk Carioca',
      'Trap', 'Drill', 'Lo-Fi', 'Ambient', 'Outros'
    ]
  },
  
  // Informações adicionais
  album: {
    type: String,
    trim: true,
    maxlength: [100, 'Nome do álbum não pode ter mais de 100 caracteres']
  },
  
  duracao: {
    type: Number, // em segundos
    required: [true, 'Duração é obrigatória']
  },
  
  letra: {
    type: String,
    trim: true
  },
  
  // Arquivo de áudio
  arquivo: {
    filename: {
      type: String,
      required: true
    },
    path: {
      type: String,
      required: false // Path local não é salvo no banco (apenas usado no servidor)
    },
    url: {
      type: String,
      required: true
    },
    tamanho: {
      type: Number, // em bytes
      required: true
    },
    formato: {
      type: String,
      enum: ['mp3', 'wav', 'aac', 'ogg', 'm4a', 'flac'],
      default: 'mp3'
    },
    bitrate: {
      type: Number // em kbps
    },
    sampleRate: {
      type: Number // em Hz
    },
    // RF08 - Múltiplas resoluções/qualidades
    versoes: {
      high: {
        path: String,
        url: String,
        bitrate: String,
        sampleRate: Number,
        size: Number,
        format: String
      },
      medium: {
        path: String,
        url: String,
        bitrate: String,
        sampleRate: Number,
        size: Number,
        format: String
      },
      low: {
        path: String,
        url: String,
        bitrate: String,
        sampleRate: Number,
        size: Number,
        format: String
      }
    }
  },
  
  // Capa do álbum
  capa: {
    filename: String,
    path: String,
    url: String
  },
  
  // Tags e categorização
  tags: [{
    type: String,
    trim: true,
    maxlength: [30, 'Tag não pode ter mais de 30 caracteres']
  }],
  
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
    },
    adicionadasPlaylists: {
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
    permiteStreaming: {
      type: Boolean,
      default: true
    },
    permiteAdicionarPlaylist: {
      type: Boolean,
      default: true
    },
    permiteCompartilhamento: {
      type: Boolean,
      default: true
    }
  },
  
  // Informações de direitos autorais
  direitosAutorais: {
    possuiDireitos: {
      type: Boolean,
      default: false
    },
    proprietario: String,
    distribuidora: String,
    gravadora: String,
    numeroRegistro: String
  },
  
  // Comentários
  comentarios: [{
    usuarioId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    texto: {
      type: String,
      required: [true, 'Texto do comentário é obrigatório'],
      trim: true,
      maxlength: [500, 'Comentário não pode ter mais de 500 caracteres']
    },
    dataComentario: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Índices para otimização
musicaSchema.index({ titulo: 'text', autor: 'text', album: 'text' });
musicaSchema.index({ autor: 1 });
musicaSchema.index({ ano: -1 });
musicaSchema.index({ genero: 1 });
musicaSchema.index({ album: 1 });
musicaSchema.index({ tags: 1 });
musicaSchema.index({ 'stats.reproducoes': -1 });
musicaSchema.index({ 'stats.favoritos': -1 });
musicaSchema.index({ status: 1 });
musicaSchema.index({ 'upload.usuarioId': 1 });
musicaSchema.index({ 'upload.dataUpload': -1 });

// Índice composto para sharding
musicaSchema.index({ genero: 1, _id: 1 });

// Virtual para URL da música
musicaSchema.virtual('musicaUrl').get(function() {
  return this.arquivo.url;
});

// Virtual para URL da capa
musicaSchema.virtual('capaUrl').get(function() {
  if (this.capa && this.capa.url) {
    return this.capa.url;
  }
  return `${process.env.STREAMING_BASE_URL}/default-music-cover.jpg`;
});

// Virtual para duração formatada
musicaSchema.virtual('duracaoFormatada').get(function() {
  const minutos = Math.floor(this.duracao / 60);
  const segundos = this.duracao % 60;
  return `${minutos}:${segundos.toString().padStart(2, '0')}`;
});

// Virtual para tamanho formatado
musicaSchema.virtual('tamanhoFormatado').get(function() {
  const bytes = this.arquivo.tamanho;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 Bytes';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
});

// Virtual para verificar se está ativa
musicaSchema.virtual('isAtiva').get(function() {
  return this.status === 'ativo';
});

// Método para incrementar reproduções
musicaSchema.methods.incrementarReproducoes = function() {
  this.stats.reproducoes += 1;
  return this.save();
};

// Método para incrementar downloads
musicaSchema.methods.incrementarDownloads = function() {
  this.stats.downloads += 1;
  return this.save();
};

// Método para incrementar favoritos
musicaSchema.methods.incrementarFavoritos = function() {
  this.stats.favoritos += 1;
  return this.save();
};

// Método para decrementar favoritos
musicaSchema.methods.decrementarFavoritos = function() {
  if (this.stats.favoritos > 0) {
    this.stats.favoritos -= 1;
  }
  return this.save();
};

// Método para incrementar compartilhamentos
musicaSchema.methods.incrementarCompartilhamentos = function() {
  this.stats.compartilhamentos += 1;
  return this.save();
};

// Método para incrementar adições em playlists
musicaSchema.methods.incrementarAdicoesPlaylist = function() {
  this.stats.adicionadasPlaylists += 1;
  return this.save();
};

// Método para decrementar adições em playlists
musicaSchema.methods.decrementarAdicoesPlaylist = function() {
  if (this.stats.adicionadasPlaylists > 0) {
    this.stats.adicionadasPlaylists -= 1;
  }
  return this.save();
};

// Método estático para buscar músicas por gênero
musicaSchema.statics.buscarPorGenero = function(genero, limit = 20, skip = 0) {
  return this.find({ 
    genero, 
    status: 'ativo',
    visibilidade: 'publico' 
  })
  .sort({ 'stats.reproducoes': -1 })
  .limit(limit)
  .skip(skip)
  .populate('upload.usuarioId', 'username profile.avatar');
};

// Método estático para buscar músicas por autor
musicaSchema.statics.buscarPorAutor = function(autor, limit = 20, skip = 0) {
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

// Método estático para buscar músicas por álbum
musicaSchema.statics.buscarPorAlbum = function(album, limit = 20, skip = 0) {
  return this.find({ 
    album: new RegExp(album, 'i'),
    status: 'ativo',
    visibilidade: 'publico' 
  })
  .sort({ 'upload.dataUpload': -1 })
  .limit(limit)
  .skip(skip)
  .populate('upload.usuarioId', 'username profile.avatar');
};

// Método estático para buscar músicas mais populares
musicaSchema.statics.buscarPopulares = function(limit = 20, skip = 0) {
  return this.find({ 
    status: 'ativo',
    visibilidade: 'publico' 
  })
  .sort({ 'stats.reproducoes': -1, 'stats.favoritos': -1 })
  .limit(limit)
  .skip(skip)
  .populate('upload.usuarioId', 'username profile.avatar');
};

// Método estático para buscar músicas mais favoritadas
musicaSchema.statics.buscarMaisFavoritadas = function(limit = 20, skip = 0) {
  return this.find({ 
    status: 'ativo',
    visibilidade: 'publico' 
  })
  .sort({ 'stats.favoritos': -1, 'stats.reproducoes': -1 })
  .limit(limit)
  .skip(skip)
  .populate('upload.usuarioId', 'username profile.avatar');
};

// Método estático para buscar músicas recentes
musicaSchema.statics.buscarRecentes = function(limit = 20, skip = 0) {
  return this.find({ 
    status: 'ativo',
    visibilidade: 'publico' 
  })
  .sort({ 'upload.dataUpload': -1 })
  .limit(limit)
  .skip(skip)
  .populate('upload.usuarioId', 'username profile.avatar');
};

// Método estático para buscar músicas por ano
musicaSchema.statics.buscarPorAno = function(ano, limit = 20, skip = 0) {
  return this.find({ 
    ano,
    status: 'ativo',
    visibilidade: 'publico' 
  })
  .sort({ 'stats.reproducoes': -1 })
  .limit(limit)
  .skip(skip)
  .populate('upload.usuarioId', 'username profile.avatar');
};

// Método estático para buscar músicas por década
musicaSchema.statics.buscarPorDecada = function(decada, limit = 20, skip = 0) {
  const anoInicio = decada;
  const anoFim = decada + 9;
  
  return this.find({ 
    ano: { $gte: anoInicio, $lte: anoFim },
    status: 'ativo',
    visibilidade: 'publico' 
  })
  .sort({ 'stats.reproducoes': -1 })
  .limit(limit)
  .skip(skip)
  .populate('upload.usuarioId', 'username profile.avatar');
};

module.exports = mongoose.model('Musica', musicaSchema);

