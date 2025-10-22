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

    // Buscar usuário
    const user = await User.findById(decoded.id);

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

module.exports = {
  auth,
  optionalAuth,
  isAdmin,
  isPremium
};

