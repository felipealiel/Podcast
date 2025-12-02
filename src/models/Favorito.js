const mongoose = require('mongoose');

const favoritoSchema = new mongoose.Schema({
  // Usuário que favoritou
  usuarioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'ID do usuário é obrigatório']
  },
  
  // Música favoritada
  musicaId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Musica',
    required: [true, 'ID da música é obrigatório']
  },
  
  // Data em que foi favoritado
  favoritadoEm: {
    type: Date,
    default: Date.now
  },
  
  // Notas ou tags pessoais do usuário
  nota: {
    type: String,
    maxlength: [500, 'Nota não pode ter mais de 500 caracteres']
  },
  
  // Ordem de preferência (para ordenação customizada)
  ordem: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Índice único composto para evitar duplicatas
favoritoSchema.index({ usuarioId: 1, musicaId: 1 }, { unique: true });

// Índices para otimização
favoritoSchema.index({ usuarioId: 1, favoritadoEm: -1 });
// O índice em musicaId já está coberto pelo índice composto único acima
// Não precisamos de índice individual para musicaId

// Método estático para buscar favoritos de um usuário
favoritoSchema.statics.buscarPorUsuario = function(usuarioId, limit = 50, skip = 0) {
  return this.find({ usuarioId })
    .sort({ favoritadoEm: -1 })
    .limit(limit)
    .skip(skip)
    .populate('musicaId', 'titulo autor ano genero album duracao capa arquivo stats');
};

// Método estático para verificar se música está favoritada
favoritoSchema.statics.isFavoritada = async function(usuarioId, musicaId) {
  const favorito = await this.findOne({ usuarioId, musicaId });
  return !!favorito;
};

// Método estático para contar favoritos de uma música
favoritoSchema.statics.contarPorMusica = function(musicaId) {
  return this.countDocuments({ musicaId });
};

// Método estático para contar favoritos de um usuário
favoritoSchema.statics.contarPorUsuario = function(usuarioId) {
  return this.countDocuments({ usuarioId });
};

module.exports = mongoose.model('Favorito', favoritoSchema);

