const Joi = require('joi');

/**
 * Validação de registro
 */
const registerSchema = Joi.object({
  nomeUsuario: Joi.string()
    .alphanum()
    .min(3)
    .max(30)
    .required()
    .messages({
      'string.base': 'Nome de usuário deve ser texto',
      'string.alphanum': 'Nome de usuário pode conter apenas letras e números',
      'string.min': 'Nome de usuário deve ter pelo menos 3 caracteres',
      'string.max': 'Nome de usuário não pode ter mais de 30 caracteres',
      'any.required': 'Nome de usuário é obrigatório'
    }),

  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Email inválido',
      'any.required': 'Email é obrigatório'
    }),

  senha: Joi.string()
    .min(6)
    .required()
    .messages({
      'string.min': 'Senha deve ter pelo menos 6 caracteres',
      'any.required': 'Senha é obrigatória'
    }),

  firstName: Joi.string()
    .max(50)
    .optional(),

  lastName: Joi.string()
    .max(50)
    .optional()
});

/**
 * Validação de login
 */
const loginSchema = Joi.object({
  emailOrUsername: Joi.string()
    .required()
    .messages({
      'any.required': 'Email ou nome de usuário é obrigatório'
    }),

  senha: Joi.string()
    .required()
    .messages({
      'any.required': 'Senha é obrigatória'
    })
});

/**
 * Validação de atualização de perfil
 */
const updateProfileSchema = Joi.object({
  firstName: Joi.string().max(50).optional(),
  lastName: Joi.string().max(50).optional(),
  bio: Joi.string().max(500).optional(),
  birthDate: Joi.date().optional(),
  location: Joi.object({
    country: Joi.string().optional(),
    city: Joi.string().optional()
  }).optional(),
  website: Joi.string().uri().optional(),
  socialLinks: Joi.object({
    youtube: Joi.string().optional(),
    twitter: Joi.string().optional(),
    instagram: Joi.string().optional(),
    tiktok: Joi.string().optional()
  }).optional()
});

/**
 * Validação de mudança de senha
 */
const changePasswordSchema = Joi.object({
  senhaAtual: Joi.string()
    .required()
    .messages({
      'any.required': 'Senha atual é obrigatória'
    }),

  senhaNova: Joi.string()
    .min(6)
    .required()
    .messages({
      'string.min': 'Nova senha deve ter pelo menos 6 caracteres',
      'any.required': 'Nova senha é obrigatória'
    })
});

module.exports = {
  registerSchema,
  loginSchema,
  updateProfileSchema,
  changePasswordSchema
};

