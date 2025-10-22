const mongoose = require('mongoose');

const assinaturaSchema = new mongoose.Schema({
  // Referência ao usuário
  usuarioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'ID do usuário é obrigatório'],
    unique: true
  },
  
  // Tipo de assinatura
  tipo: {
    type: String,
    enum: ['mensal', 'anual'],
    required: [true, 'Tipo de assinatura é obrigatório']
  },
  
  // Plano
  plano: {
    type: String,
    enum: ['free', 'premium', 'pro'],
    default: 'free'
  },
  
  // Valores
  valores: {
    mensal: {
      type: Number,
      default: 0
    },
    anual: {
      type: Number,
      default: 0
    }
  },
  
  // Status da assinatura
  status: {
    type: String,
    enum: ['ativa', 'cancelada', 'suspensa', 'expirada', 'trial'],
    default: 'ativa'
  },
  
  // Datas
  dataInicio: {
    type: Date,
    required: [true, 'Data de início é obrigatória'],
    default: Date.now
  },
  
  dataFim: {
    type: Date,
    required: [true, 'Data de fim é obrigatória']
  },
  
  dataCancelamento: {
    type: Date,
    default: null
  },
  
  dataProximaCobranca: {
    type: Date
  },
  
  // Renovação automática
  renovacaoAutomatica: {
    type: Boolean,
    default: true
  },
  
  // Informações de pagamento
  pagamento: {
    metodoPagamento: {
      type: String,
      enum: ['cartao_credito', 'cartao_debito', 'pix', 'boleto', 'paypal'],
      required: true
    },
    ultimosDigitosCartao: {
      type: String,
      maxlength: 4
    },
    bandeiraCartao: {
      type: String,
      enum: ['visa', 'mastercard', 'elo', 'amex', 'hipercard', 'outros']
    },
    emailPaypal: String,
    statusPagamento: {
      type: String,
      enum: ['pendente', 'aprovado', 'recusado', 'cancelado'],
      default: 'pendente'
    }
  },
  
  // Histórico de pagamentos
  historicoPagamentos: [{
    data: {
      type: Date,
      default: Date.now
    },
    valor: {
      type: Number,
      required: true
    },
    tipo: {
      type: String,
      enum: ['mensal', 'anual'],
      required: true
    },
    status: {
      type: String,
      enum: ['pago', 'pendente', 'falhou', 'reembolsado'],
      required: true
    },
    metodoPagamento: String,
    transacaoId: String,
    fatura: {
      url: String,
      numero: String
    },
    descricao: String
  }],
  
  // Benefícios da assinatura
  beneficios: {
    streamingIlimitado: {
      type: Boolean,
      default: false
    },
    qualidadeAlta: {
      type: Boolean,
      default: false
    },
    downloadOffline: {
      type: Boolean,
      default: false
    },
    semAnuncios: {
      type: Boolean,
      default: false
    },
    playlistsIlimitadas: {
      type: Boolean,
      default: false
    },
    uploadConteudo: {
      type: Boolean,
      default: false
    },
    suportePrioritario: {
      type: Boolean,
      default: false
    },
    aceitaColaboradores: {
      type: Boolean,
      default: false
    }
  },
  
  // Limites baseados no plano
  limites: {
    maxPlaylists: {
      type: Number,
      default: 10
    },
    maxMusicasPorPlaylist: {
      type: Number,
      default: 50
    },
    maxDownloadsMes: {
      type: Number,
      default: 0
    },
    maxUploadsMes: {
      type: Number,
      default: 0
    },
    espacoArmazenamento: {
      type: Number, // em GB
      default: 0
    }
  },
  
  // Trial (período de teste)
  trial: {
    isTrial: {
      type: Boolean,
      default: false
    },
    dataInicio: Date,
    dataFim: Date,
    duracaoDias: {
      type: Number,
      default: 7
    }
  },
  
  // Cupom de desconto
  cupom: {
    codigo: String,
    desconto: {
      type: Number, // percentual
      min: 0,
      max: 100
    },
    dataAplicacao: Date,
    dataExpiracao: Date
  },
  
  // Motivo do cancelamento
  cancelamento: {
    motivo: {
      type: String,
      enum: [
        'muito_caro',
        'nao_uso_frequente',
        'falta_conteudo',
        'problemas_tecnicos',
        'mudei_plataforma',
        'outros'
      ]
    },
    comentario: {
      type: String,
      maxlength: [500, 'Comentário não pode ter mais de 500 caracteres']
    },
    data: Date,
    canceladoPor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Índices para otimização
assinaturaSchema.index({ usuarioId: 1 });
assinaturaSchema.index({ tipo: 1 });
assinaturaSchema.index({ plano: 1 });
assinaturaSchema.index({ status: 1 });
assinaturaSchema.index({ dataFim: 1 });
assinaturaSchema.index({ dataProximaCobranca: 1 });
assinaturaSchema.index({ 'trial.isTrial': 1 });

// Virtual para verificar se está ativa
assinaturaSchema.virtual('isAtiva').get(function() {
  return this.status === 'ativa' && this.dataFim > new Date();
});

// Virtual para verificar se está em trial
assinaturaSchema.virtual('isEmTrial').get(function() {
  return this.trial.isTrial && this.trial.dataFim > new Date();
});

// Virtual para dias restantes
assinaturaSchema.virtual('diasRestantes').get(function() {
  const hoje = new Date();
  const diff = this.dataFim - hoje;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
});

// Virtual para verificar se vai expirar em breve
assinaturaSchema.virtual('expiraEmBreve').get(function() {
  return this.diasRestantes <= 7 && this.diasRestantes > 0;
});

// Middleware para configurar data de fim baseada no tipo
assinaturaSchema.pre('save', function(next) {
  if (this.isNew || this.isModified('tipo') || this.isModified('dataInicio')) {
    const dataInicio = this.dataInicio || new Date();
    
    if (this.tipo === 'mensal') {
      this.dataFim = new Date(dataInicio);
      this.dataFim.setMonth(this.dataFim.getMonth() + 1);
      this.dataProximaCobranca = new Date(this.dataFim);
    } else if (this.tipo === 'anual') {
      this.dataFim = new Date(dataInicio);
      this.dataFim.setFullYear(this.dataFim.getFullYear() + 1);
      this.dataProximaCobranca = new Date(this.dataFim);
    }
  }
  next();
});

// Middleware para configurar benefícios baseados no plano
assinaturaSchema.pre('save', function(next) {
  if (this.isModified('plano')) {
    switch (this.plano) {
      case 'free':
        this.beneficios = {
          streamingIlimitado: false,
          qualidadeAlta: false,
          downloadOffline: false,
          semAnuncios: false,
          playlistsIlimitadas: false,
          uploadConteudo: false,
          suportePrioritario: false,
          aceitaColaboradores: false
        };
        this.limites = {
          maxPlaylists: 5,
          maxMusicasPorPlaylist: 50,
          maxDownloadsMes: 0,
          maxUploadsMes: 0,
          espacoArmazenamento: 0
        };
        this.valores.mensal = 0;
        this.valores.anual = 0;
        break;
        
      case 'premium':
        this.beneficios = {
          streamingIlimitado: true,
          qualidadeAlta: true,
          downloadOffline: true,
          semAnuncios: true,
          playlistsIlimitadas: true,
          uploadConteudo: false,
          suportePrioritario: false,
          aceitaColaboradores: false
        };
        this.limites = {
          maxPlaylists: -1, // ilimitado
          maxMusicasPorPlaylist: -1,
          maxDownloadsMes: 500,
          maxUploadsMes: 0,
          espacoArmazenamento: 0
        };
        this.valores.mensal = 19.90;
        this.valores.anual = 199.90;
        break;
        
      case 'pro':
        this.beneficios = {
          streamingIlimitado: true,
          qualidadeAlta: true,
          downloadOffline: true,
          semAnuncios: true,
          playlistsIlimitadas: true,
          uploadConteudo: true,
          suportePrioritario: true,
          aceitaColaboradores: true
        };
        this.limites = {
          maxPlaylists: -1,
          maxMusicasPorPlaylist: -1,
          maxDownloadsMes: -1,
          maxUploadsMes: 100,
          espacoArmazenamento: 50 // GB
        };
        this.valores.mensal = 39.90;
        this.valores.anual = 399.90;
        break;
    }
  }
  next();
});

// Método para renovar assinatura
assinaturaSchema.methods.renovar = function() {
  const dataAtual = new Date();
  
  if (this.tipo === 'mensal') {
    this.dataInicio = dataAtual;
    this.dataFim = new Date(dataAtual);
    this.dataFim.setMonth(this.dataFim.getMonth() + 1);
  } else if (this.tipo === 'anual') {
    this.dataInicio = dataAtual;
    this.dataFim = new Date(dataAtual);
    this.dataFim.setFullYear(this.dataFim.getFullYear() + 1);
  }
  
  this.status = 'ativa';
  this.dataProximaCobranca = new Date(this.dataFim);
  
  return this.save();
};

// Método para cancelar assinatura
assinaturaSchema.methods.cancelar = function(motivo, comentario, canceladoPor) {
  this.status = 'cancelada';
  this.dataCancelamento = new Date();
  this.renovacaoAutomatica = false;
  
  this.cancelamento = {
    motivo,
    comentario,
    data: new Date(),
    canceladoPor
  };
  
  return this.save();
};

// Método para suspender assinatura
assinaturaSchema.methods.suspender = function() {
  this.status = 'suspensa';
  return this.save();
};

// Método para reativar assinatura
assinaturaSchema.methods.reativar = function() {
  this.status = 'ativa';
  this.dataCancelamento = null;
  this.cancelamento = undefined;
  return this.save();
};

// Método para adicionar pagamento ao histórico
assinaturaSchema.methods.adicionarPagamento = function(pagamento) {
  this.historicoPagamentos.push({
    data: new Date(),
    valor: pagamento.valor,
    tipo: pagamento.tipo,
    status: pagamento.status,
    metodoPagamento: pagamento.metodoPagamento,
    transacaoId: pagamento.transacaoId,
    fatura: pagamento.fatura,
    descricao: pagamento.descricao
  });
  
  return this.save();
};

// Método para aplicar cupom
assinaturaSchema.methods.aplicarCupom = function(codigo, desconto, dataExpiracao) {
  this.cupom = {
    codigo,
    desconto,
    dataAplicacao: new Date(),
    dataExpiracao
  };
  
  return this.save();
};

// Método para calcular valor com desconto
assinaturaSchema.methods.calcularValorComDesconto = function() {
  const valorBase = this.tipo === 'mensal' ? this.valores.mensal : this.valores.anual;
  
  if (this.cupom && this.cupom.dataExpiracao > new Date()) {
    const desconto = (valorBase * this.cupom.desconto) / 100;
    return valorBase - desconto;
  }
  
  return valorBase;
};

// Método para iniciar trial
assinaturaSchema.methods.iniciarTrial = function(duracaoDias = 7) {
  const dataInicio = new Date();
  const dataFim = new Date();
  dataFim.setDate(dataFim.getDate() + duracaoDias);
  
  this.trial = {
    isTrial: true,
    dataInicio,
    dataFim,
    duracaoDias
  };
  
  this.status = 'trial';
  this.dataInicio = dataInicio;
  this.dataFim = dataFim;
  
  return this.save();
};

// Método para finalizar trial
assinaturaSchema.methods.finalizarTrial = function() {
  this.trial.isTrial = false;
  return this.save();
};

// Método estático para buscar assinaturas ativas
assinaturaSchema.statics.buscarAtivas = function(limit = 100, skip = 0) {
  return this.find({ status: 'ativa' })
    .sort({ dataFim: 1 })
    .limit(limit)
    .skip(skip)
    .populate('usuarioId', 'username email');
};

// Método estático para buscar assinaturas que vão expirar em breve
assinaturaSchema.statics.buscarExpirandoEmBreve = function(dias = 7) {
  const hoje = new Date();
  const dataLimite = new Date();
  dataLimite.setDate(hoje.getDate() + dias);
  
  return this.find({ 
    status: 'ativa',
    dataFim: { $gte: hoje, $lte: dataLimite }
  })
  .sort({ dataFim: 1 })
  .populate('usuarioId', 'username email');
};

// Método estático para buscar assinaturas expiradas
assinaturaSchema.statics.buscarExpiradas = function(limit = 100, skip = 0) {
  const hoje = new Date();
  
  return this.find({ 
    status: 'ativa',
    dataFim: { $lt: hoje }
  })
  .sort({ dataFim: -1 })
  .limit(limit)
  .skip(skip)
  .populate('usuarioId', 'username email');
};

// Método estático para buscar assinaturas por plano
assinaturaSchema.statics.buscarPorPlano = function(plano, limit = 100, skip = 0) {
  return this.find({ plano, status: 'ativa' })
    .sort({ dataInicio: -1 })
    .limit(limit)
    .skip(skip)
    .populate('usuarioId', 'username email');
};

module.exports = mongoose.model('Assinatura', assinaturaSchema);
