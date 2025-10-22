const express = require('express');
const router = express.Router();
const {
  register,
  login,
  getMe,
  updateProfile,
  changePassword,
  logout
} = require('../controllers/auth.controller');
const { auth } = require('../middlewares/auth');
const {
  registerSchema,
  loginSchema,
  updateProfileSchema,
  changePasswordSchema
} = require('../validators/auth.validator');

/**
 * Middleware de validação
 */
const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Erro de validação',
        errors: error.details.map(detail => ({
          field: detail.path[0],
          message: detail.message
        }))
      });
    }
    
    next();
  };
};

// Rotas públicas
router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);

// Rotas privadas (requerem autenticação)
router.get('/me', auth, getMe);
router.put('/profile', auth, validate(updateProfileSchema), updateProfile);
router.put('/change-password', auth, validate(changePasswordSchema), changePassword);
router.post('/logout', auth, logout);

module.exports = router;

