const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Assinatura = require('../models/Assinatura');

/**
 * Gerar token JWT
 */
const generateToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

/**
 * @route   POST /api/v1/auth/register
 * @desc    Registrar novo usuário
 * @access  Public
 */
const register = async (req, res) => {
  try {
    const { nomeUsuario, email, senha, firstName, lastName } = req.body;

    // Verificar se usuário já existe
    const userExists = await User.findOne({
      $or: [{ email }, { nomeUsuario }]
    });

    if (userExists) {
      return res.status(400).json({
        success: false,
        message: userExists.email === email
          ? 'Email já cadastrado'
          : 'Nome de usuário já está em uso'
      });
    }

    // Criar usuário
    const user = new User({
      nomeUsuario,
      email,
      senha,
      profile: {
        firstName,
        lastName
      }
    });

    await user.save();

    // Criar assinatura free automática
    const dataInicio = new Date();
    const dataFim = new Date();
    dataFim.setFullYear(dataFim.getFullYear() + 10); // 10 anos para plano free

    const assinatura = new Assinatura({
      usuarioId: user._id,
      tipo: 'mensal',
      plano: 'free',
      dataInicio: dataInicio,
      dataFim: dataFim,
      pagamento: {
        metodoPagamento: 'cartao_credito',
        statusPagamento: 'aprovado'
      }
    });

    await assinatura.save();

    // Gerar token
    const token = generateToken(user._id);

    // Remover senha do objeto de retorno
    const userResponse = user.toObject();
    delete userResponse.senha;

    res.status(201).json({
      success: true,
      message: 'Usuário criado com sucesso!',
      data: {
        user: userResponse,
        token
      }
    });
  } catch (error) {
    console.error('Erro ao registrar usuário:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao criar usuário',
      error: error.message
    });
  }
};

/**
 * @route   POST /api/v1/auth/login
 * @desc    Login de usuário
 * @access  Public
 */
const login = async (req, res) => {
  try {
    const { emailOrUsername, senha } = req.body;

    // Buscar usuário por email ou nome de usuário
    const user = await User.findOne({
      $or: [
        { email: emailOrUsername },
        { nomeUsuario: emailOrUsername }
      ]
    }).select('+senha');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Credenciais inválidas'
      });
    }

    // Verificar se conta está ativa
    if (!user.account.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Conta desativada. Entre em contato com o suporte.'
      });
    }

    // Verificar senha
    const isPasswordValid = await user.comparePassword(senha);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Credenciais inválidas'
      });
    }

    // Atualizar último login
    user.stats.lastLoginAt = new Date();
    await user.save();

    // Gerar token
    const token = generateToken(user._id);

    // Remover senha do objeto de retorno
    const userResponse = user.toObject();
    delete userResponse.senha;

    res.json({
      success: true,
      message: 'Login realizado com sucesso!',
      data: {
        user: userResponse,
        token
      }
    });
  } catch (error) {
    console.error('Erro ao fazer login:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao fazer login',
      error: error.message
    });
  }
};

/**
 * @route   GET /api/v1/auth/me
 * @desc    Obter usuário logado
 * @access  Private
 */
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    res.json({
      success: true,
      data: {
        user
      }
    });
  } catch (error) {
    console.error('Erro ao buscar usuário:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar usuário',
      error: error.message
    });
  }
};

/**
 * @route   PUT /api/v1/auth/profile
 * @desc    Atualizar perfil
 * @access  Private
 */
const updateProfile = async (req, res) => {
  try {
    const updates = req.body;
    const user = await User.findById(req.user._id);

    // Atualizar campos do perfil
    if (updates.firstName) user.profile.firstName = updates.firstName;
    if (updates.lastName) user.profile.lastName = updates.lastName;
    if (updates.bio) user.profile.bio = updates.bio;
    if (updates.birthDate) user.profile.birthDate = updates.birthDate;
    if (updates.location) user.profile.location = updates.location;
    if (updates.website) user.profile.website = updates.website;
    if (updates.socialLinks) user.profile.socialLinks = updates.socialLinks;

    await user.save();

    res.json({
      success: true,
      message: 'Perfil atualizado com sucesso!',
      data: {
        user
      }
    });
  } catch (error) {
    console.error('Erro ao atualizar perfil:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar perfil',
      error: error.message
    });
  }
};

/**
 * @route   PUT /api/v1/auth/change-password
 * @desc    Mudar senha
 * @access  Private
 */
const changePassword = async (req, res) => {
  try {
    const { senhaAtual, senhaNova } = req.body;
    const user = await User.findById(req.user._id).select('+senha');

    // Verificar senha atual
    const isPasswordValid = await user.comparePassword(senhaAtual);

    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Senha atual incorreta'
      });
    }

    // Atualizar senha
    user.senha = senhaNova;
    await user.save();

    res.json({
      success: true,
      message: 'Senha alterada com sucesso!'
    });
  } catch (error) {
    console.error('Erro ao alterar senha:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao alterar senha',
      error: error.message
    });
  }
};

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Logout (placeholder - JWT é stateless)
 * @access  Private
 */
const logout = async (req, res) => {
  try {
    // Com JWT, o logout é feito no client removendo o token
    // Aqui podemos adicionar o token a uma blacklist se necessário
    
    res.json({
      success: true,
      message: 'Logout realizado com sucesso!'
    });
  } catch (error) {
    console.error('Erro ao fazer logout:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao fazer logout',
      error: error.message
    });
  }
};

module.exports = {
  register,
  login,
  getMe,
  updateProfile,
  changePassword,
  logout
};

