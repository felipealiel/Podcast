const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  // Informações básicas
  nomeUsuario: {
    type: String,
    required: [true, 'Nome de usuário é obrigatório'],
    unique: true,
    trim: true,
    minlength: [3, 'Nome de usuário deve ter pelo menos 3 caracteres'],
    maxlength: [30, 'Nome de usuário não pode ter mais de 30 caracteres'],
    match: [/^[a-zA-Z0-9_]+$/, 'Nome de usuário pode conter apenas letras, números e underscore']
  },
  
  email: {
    type: String,
    required: [true, 'Email é obrigatório'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Email inválido']
  },
  
  senha: {
    type: String,
    required: [true, 'Senha é obrigatória'],
    minlength: [6, 'Senha deve ter pelo menos 6 caracteres'],
    select: false // Não incluir senha nas consultas por padrão
  },
  
  // Perfil do usuário
  profile: {
    firstName: {
      type: String,
      trim: true,
      maxlength: [50, 'Nome não pode ter mais de 50 caracteres']
    },
    lastName: {
      type: String,
      trim: true,
      maxlength: [50, 'Sobrenome não pode ter mais de 50 caracteres']
    },
    avatar: {
      type: String,
      default: null
    },
    bio: {
      type: String,
      maxlength: [500, 'Bio não pode ter mais de 500 caracteres']
    },
    birthDate: {
      type: Date
    },
    location: {
      country: String,
      city: String
    },
    website: {
      type: String,
      match: [/^https?:\/\/.+/, 'Website deve ser uma URL válida']
    },
    socialLinks: {
      youtube: String,
      twitter: String,
      instagram: String,
      tiktok: String
    }
  },
  
  // Configurações de conta
  account: {
    isVerified: {
      type: Boolean,
      default: false
    },
    isActive: {
      type: Boolean,
      default: true
    },
    subscription: {
      type: String,
      enum: ['free', 'premium', 'pro'],
      default: 'free'
    },
    subscriptionExpiresAt: {
      type: Date,
      default: null
    },
    preferences: {
      language: {
        type: String,
        default: 'pt-BR',
        enum: ['pt-BR', 'en-US', 'es-ES']
      },
      notifications: {
        email: {
          type: Boolean,
          default: true
        },
        push: {
          type: Boolean,
          default: true
        },
        newVideos: {
          type: Boolean,
          default: true
        },
        comments: {
          type: Boolean,
          default: true
        },
        likes: {
          type: Boolean,
          default: true
        }
      },
      privacy: {
        showEmail: {
          type: Boolean,
          default: false
        },
        showBirthDate: {
          type: Boolean,
          default: false
        },
        allowComments: {
          type: Boolean,
          default: true
        }
      }
    }
  },
  
  // Estatísticas
  stats: {
    totalViews: {
      type: Number,
      default: 0
    },
    totalLikes: {
      type: Number,
      default: 0
    },
    totalSubscribers: {
      type: Number,
      default: 0
    },
    totalVideos: {
      type: Number,
      default: 0
    },
    joinDate: {
      type: Date,
      default: Date.now
    },
    lastLoginAt: {
      type: Date,
      default: Date.now
    }
  },
  
  // Tokens e autenticação
  tokens: {
    emailVerification: {
      token: String,
      expiresAt: Date
    },
    passwordReset: {
      token: String,
      expiresAt: Date
    },
    refreshTokens: [{
      token: String,
      createdAt: {
        type: Date,
        default: Date.now
      },
      expiresAt: Date,
      userAgent: String,
      ipAddress: String
    }]
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Índices (email e nomeUsuario já têm índice único automático)
userSchema.index({ 'account.subscription': 1 });
userSchema.index({ 'stats.totalSubscribers': -1 });
userSchema.index({ createdAt: -1 });

// Virtual para nome completo
userSchema.virtual('fullName').get(function() {
  if (this.profile.firstName && this.profile.lastName) {
    return `${this.profile.firstName} ${this.profile.lastName}`;
  }
  return this.nomeUsuario;
});

// Virtual para URL do avatar
userSchema.virtual('avatarUrl').get(function() {
  if (this.profile.avatar) {
    return `${process.env.STREAMING_BASE_URL}/avatars/${this.profile.avatar}`;
  }
  return `${process.env.STREAMING_BASE_URL}/default-avatar.png`;
});

// Middleware para hash da senha antes de salvar
userSchema.pre('save', async function(next) {
  if (!this.isModified('senha')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.senha = await bcrypt.hash(this.senha, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Middleware para atualizar lastLoginAt
userSchema.pre('save', function(next) {
  if (this.isModified('stats.lastLoginAt')) {
    this.stats.lastLoginAt = new Date();
  }
  next();
});

// Método para verificar senha
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.senha);
};

// Método para gerar token de verificação de email
userSchema.methods.generateEmailVerificationToken = function() {
  const token = require('crypto').randomBytes(32).toString('hex');
  this.tokens.emailVerification = {
    token,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 horas
  };
  return token;
};

// Método para gerar token de reset de senha
userSchema.methods.generatePasswordResetToken = function() {
  const token = require('crypto').randomBytes(32).toString('hex');
  this.tokens.passwordReset = {
    token,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000) // 1 hora
  };
  return token;
};

// Método para adicionar refresh token
userSchema.methods.addRefreshToken = function(userAgent, ipAddress) {
  const token = require('crypto').randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 dias
  
  this.tokens.refreshTokens.push({
    token,
    expiresAt,
    userAgent,
    ipAddress
  });
  
  // Manter apenas os 5 tokens mais recentes
  if (this.tokens.refreshTokens.length > 5) {
    this.tokens.refreshTokens = this.tokens.refreshTokens.slice(-5);
  }
  
  return token;
};

// Método para remover refresh token
userSchema.methods.removeRefreshToken = function(token) {
  this.tokens.refreshTokens = this.tokens.refreshTokens.filter(t => t.token !== token);
};

// Método para limpar tokens expirados
userSchema.methods.cleanExpiredTokens = function() {
  const now = new Date();
  
  // Limpar refresh tokens expirados
  this.tokens.refreshTokens = this.tokens.refreshTokens.filter(t => t.expiresAt > now);
  
  // Limpar token de verificação de email expirado
  if (this.tokens.emailVerification && this.tokens.emailVerification.expiresAt < now) {
    this.tokens.emailVerification = undefined;
  }
  
  // Limpar token de reset de senha expirado
  if (this.tokens.passwordReset && this.tokens.passwordReset.expiresAt < now) {
    this.tokens.passwordReset = undefined;
  }
};

// Método para verificar se é premium
userSchema.methods.isPremium = function() {
  return this.account.subscription === 'premium' || this.account.subscription === 'pro';
};

// Método para verificar se a assinatura está ativa
userSchema.methods.isSubscriptionActive = function() {
  if (this.account.subscription === 'free') return true;
  return this.account.subscriptionExpiresAt && this.account.subscriptionExpiresAt > new Date();
};

module.exports = mongoose.model('User', userSchema);
