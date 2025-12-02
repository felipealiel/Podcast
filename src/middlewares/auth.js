const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Middleware de autenticação JWT
 */
const auth = async (req, res, next) => {
  try {
    // Pegar token do header
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Acesso negado. Token não fornecido.'
      });
    }

    // Verificar token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Converter ID para ObjectId se necessário
    const mongoose = require('mongoose');
    let userId = decoded.id;
    if (!(userId instanceof mongoose.Types.ObjectId)) {
      try {
        userId = mongoose.Types.ObjectId.isValid(userId) 
          ? new mongoose.Types.ObjectId(userId) 
          : userId;
      } catch (error) {
        // Se não conseguir converter, usar como está
      }
    }

    // Buscar usuário por ID primeiro no PRIMARY atual
    let user = await User.findById(userId);
    
    // Se não encontrar, tentar buscar diretamente na collection do PRIMARY
    if (!user && mongoose.connection.db) {
      try {
        const userData = await mongoose.connection.db.collection('users').findOne({
          _id: userId
        });
        if (userData) {
          user = new User(userData);
          console.log(`✅ Usuário encontrado no PRIMARY por ID (collection direta)`);
        }
      } catch (error) {
        // Continuar para outras tentativas
      }
    }

    // Se não encontrar pelo ID (pode estar em outro cluster), tentar buscar de outras formas
    if (!user) {
      console.log(`⚠️  Usuário não encontrado por ID ${userId}, tentando buscar em outros clusters...`);
      
      // Tentar buscar usando a collection diretamente em todos os clusters
      const databaseManager = require('../config/database');
      
      try {
        // Tentar buscar por ID primeiro em todos os clusters
        const clusterKeys = ['cluster1', 'cluster2', 'cluster3'];
        for (const key of clusterKeys) {
          const connection = databaseManager.getClusterConnection(key);
          if (!connection || !connection.db) continue;
          
          try {
            const userData = await connection.db.collection('users').findOne({
              _id: userId
            });
            
            if (userData) {
              // Criar instância do modelo a partir dos dados
              user = new User(userData);
              console.log(`✅ Usuário encontrado no ${key} por ID`);
              break;
            }
          } catch (error) {
            // Continuar tentando outros clusters
            console.error(`⚠️  Erro ao buscar no ${key} por ID:`, error.message);
          }
        }
        
        // Se ainda não encontrou e o token tem email, buscar por email
        if (!user && decoded.email) {
          console.log(`⚠️  Buscando por email ${decoded.email} em todos os clusters...`);
          
          // Primeiro tentar no PRIMARY usando o modelo
          try {
            const userByEmail = await User.findOne({ email: decoded.email });
            if (userByEmail) {
              user = userByEmail;
              console.log(`✅ Usuário encontrado no PRIMARY por email (modelo)`);
            }
          } catch (error) {
            // Continuar
          }
          
          // Se não encontrou, tentar diretamente na collection do PRIMARY
          if (!user && mongoose.connection.db) {
            try {
              const userData = await mongoose.connection.db.collection('users').findOne({
                email: decoded.email
              });
              if (userData) {
                user = new User(userData);
                console.log(`✅ Usuário encontrado no PRIMARY por email (collection direta)`);
              }
            } catch (error) {
              // Continuar
            }
          }
          
          // Tentar em outros clusters
          if (!user) {
            for (const key of clusterKeys) {
              const connection = databaseManager.getClusterConnection(key);
              if (!connection || !connection.db) continue;
              
              try {
                const userData = await connection.db.collection('users').findOne({
                  email: decoded.email
                });
                
                if (userData) {
                  // Criar instância do modelo a partir dos dados
                  user = new User(userData);
                  console.log(`✅ Usuário encontrado no ${key} por email`);
                  break;
                }
              } catch (error) {
                console.error(`⚠️  Erro ao buscar no ${key} por email:`, error.message);
              }
            }
          }
        }
      } catch (error) {
        console.error('⚠️  Erro ao buscar usuário em outros clusters:', error.message);
      }
    }

    if (!user || !user.account.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Token inválido ou usuário inativo.'
      });
    }

    // Adicionar usuário ao request
    req.user = user;
    req.token = token;

    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Token inválido ou expirado.',
      error: error.message
    });
  }
};

/**
 * Middleware opcional - não falha se não tiver token
 */
const optionalAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);
      
      if (user && user.account.isActive) {
        req.user = user;
        req.token = token;
      }
    }

    next();
  } catch (error) {
    next();
  }
};

/**
 * Verificar se é admin
 */
const isAdmin = (req, res, next) => {
  if (!req.user || req.user.account.subscription !== 'pro') {
    return res.status(403).json({
      success: false,
      message: 'Acesso negado. Requer assinatura Pro.'
    });
  }
  next();
};

/**
 * Verificar se é premium
 */
const isPremium = (req, res, next) => {
  if (!req.user || req.user.account.subscription === 'free') {
    return res.status(403).json({
      success: false,
      message: 'Acesso negado. Requer assinatura Premium ou Pro.'
    });
  }
  next();
};

/**
 * Verificar se é produtor ou admin (RF07)
 */
const isProducer = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Acesso negado. Autenticação necessária.'
    });
  }
  
  const role = req.user.account?.role || 'user';
  
  if (role !== 'producer' && role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Acesso negado. Apenas produtores e administradores podem realizar esta ação.'
    });
  }
  
  next();
};

/**
 * Verificar se é admin
 */
const isAdminOnly = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Acesso negado. Autenticação necessária.'
    });
  }
  
  const role = req.user.account?.role || 'user';
  
  if (role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Acesso negado. Apenas administradores podem realizar esta ação.'
    });
  }
  
  next();
};

/**
 * Verificar se é produtor, admin ou tem plano pro
 */
const isProducerOrPro = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Acesso negado. Autenticação necessária.'
    });
  }
  
  const role = req.user.account?.role || 'user';
  const subscription = req.user.account?.subscription || 'free';
  
  if (role !== 'producer' && role !== 'admin' && subscription !== 'pro') {
    return res.status(403).json({
      success: false,
      message: 'Acesso negado. Esta funcionalidade requer permissão de produtor, admin ou plano Pro.'
    });
  }
  
  next();
};

module.exports = {
  auth,
  optionalAuth,
  isAdmin,
  isPremium,
  isProducer,
  isAdminOnly,
  isProducerOrPro
};

