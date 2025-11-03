const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Assinatura = require('../models/Assinatura');
const databaseManager = require('../config/database');
const mongoose = require('mongoose');

/**
 * Gerar token JWT
 */
const generateToken = (userId, email = null) => {
  const payload = { id: userId };
  // Incluir email no token para facilitar busca em múltiplos clusters
  if (email) {
    payload.email = email;
  }
  return jwt.sign(
    payload,
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

/**
 * Função helper para buscar usuário de forma otimizada em múltiplos clusters
 * Tenta buscar por ID primeiro, depois por email se disponível
 */
const findUserOptimized = async (userId, email = null) => {
  // Tentar buscar por ID primeiro no PRIMARY
  let user = await User.findById(userId);
  
  // Se não encontrar, tentar diretamente na collection do PRIMARY
  if (!user && mongoose.connection.db) {
    try {
      const userData = await mongoose.connection.db.collection('users').findOne({
        _id: userId
      });
      if (userData) {
        user = new User(userData);
      }
    } catch (error) {
      // Continuar para outras tentativas
    }
  }
  
  // Se ainda não encontrou e temos email, buscar por email
  if (!user && email) {
    try {
      // Tentar no PRIMARY usando o modelo
      user = await User.findOne({ email: email });
      
      // Se não encontrou, tentar diretamente na collection do PRIMARY
      if (!user && mongoose.connection.db) {
        const userData = await mongoose.connection.db.collection('users').findOne({
          email: email
        });
        if (userData) {
          user = new User(userData);
        }
      }
      
      // Se ainda não encontrou, tentar em outros clusters
      if (!user) {
        const clusterKeys = ['cluster1', 'cluster2', 'cluster3'];
        for (const key of clusterKeys) {
          const connection = databaseManager.getClusterConnection(key);
          if (!connection || !connection.db) continue;
          
          try {
            const userData = await connection.db.collection('users').findOne({
              email: email
            });
            
            if (userData) {
              user = new User(userData);
              break;
            }
          } catch (error) {
            // Continuar tentando outros clusters
          }
        }
      }
    } catch (error) {
      console.error('⚠️  Erro ao buscar usuário por email:', error.message);
    }
  }
  
  // Se ainda não encontrou por email, tentar buscar por ID em outros clusters
  if (!user) {
    const clusterKeys = ['cluster1', 'cluster2', 'cluster3'];
    for (const key of clusterKeys) {
      const connection = databaseManager.getClusterConnection(key);
      if (!connection || !connection.db) continue;
      
      try {
        const userData = await connection.db.collection('users').findOne({
          _id: userId
        });
        
        if (userData) {
          user = new User(userData);
          break;
        }
      } catch (error) {
        // Continuar tentando outros clusters
      }
    }
  }
  
  return user;
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

    // Criar usuário no PRIMARY
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

    // Replicar usuário em todos os clusters
    try {
      const userData = user.toObject();
      // Garantir que o _id seja preservado como ObjectId para manter o mesmo ID em todos os clusters
      const mongoose = require('mongoose');
      if (userData._id) {
        // Converter para ObjectId se não for já
        userData._id = userData._id instanceof mongoose.Types.ObjectId 
          ? userData._id 
          : new mongoose.Types.ObjectId(userData._id.toString());
      }
      await databaseManager.writeToAllClusters('users', 'insertOne', userData);
      console.log('✅ Usuário replicado em todos os clusters');
    } catch (error) {
      console.error('⚠️  Erro ao replicar usuário:', error.message);
      // Continuar mesmo se a replicação falhar (usuário já foi criado no PRIMARY)
    }

    // Criar assinatura free automática no PRIMARY
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

    // Replicar assinatura em todos os clusters
    try {
      const assinaturaData = assinatura.toObject();
      const mongoose = require('mongoose');
      // Garantir que _id e usuarioId sejam preservados como ObjectId
      if (assinaturaData._id) {
        assinaturaData._id = assinaturaData._id instanceof mongoose.Types.ObjectId 
          ? assinaturaData._id 
          : new mongoose.Types.ObjectId(assinaturaData._id.toString());
      }
      if (assinaturaData.usuarioId) {
        assinaturaData.usuarioId = assinaturaData.usuarioId instanceof mongoose.Types.ObjectId 
          ? assinaturaData.usuarioId 
          : new mongoose.Types.ObjectId(assinaturaData.usuarioId.toString());
      }
      await databaseManager.writeToAllClusters('assinaturas', 'insertOne', assinaturaData);
      console.log('✅ Assinatura replicada em todos os clusters');
    } catch (error) {
      console.error('⚠️  Erro ao replicar assinatura:', error.message);
    }

    // Gerar token (incluindo email para facilitar busca em múltiplos clusters)
    const token = generateToken(user._id, user.email);

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

    // Buscar usuário por email ou nome de usuário no PRIMARY atual
    let user = await User.findOne({
      $or: [
        { email: emailOrUsername },
        { nomeUsuario: emailOrUsername }
      ]
    }).select('+senha');

    // Se não encontrar no PRIMARY, tentar buscar em outros clusters
    if (!user) {
      console.log('⚠️  Usuário não encontrado no PRIMARY, tentando outros clusters...');
      try {
        // Tentar buscar diretamente na collection usando databaseManager
        const userData = await databaseManager.readFromCluster(
          'users',
          'findOne',
          {
            $or: [
              { email: emailOrUsername },
              { nomeUsuario: emailOrUsername }
            ]
          }
        );
        
        if (userData) {
          // Criar instância do modelo User a partir dos dados encontrados
          user = new User(userData);
          await user.isModified('senha'); // Garantir que métodos do modelo funcionem
        }
      } catch (error) {
        console.error('⚠️  Erro ao buscar em outros clusters:', error.message);
      }
    }

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
    const lastLoginAt = new Date();
    
    // Atualizar diretamente usando updateOne para evitar problemas com _id
    try {
      await User.updateOne(
        { _id: user._id },
        { $set: { 'stats.lastLoginAt': lastLoginAt } }
      );
    } catch (error) {
      console.error('⚠️  Erro ao atualizar último login:', error.message);
      // Continuar mesmo se falhar
    }

    // Replicar atualização em todos os clusters usando email (mais confiável que _id)
    try {
      await databaseManager.writeToAllClusters(
        'users',
        'updateOne',
        { email: user.email }, // Usar email ao invés de _id
        { $set: { 'stats.lastLoginAt': lastLoginAt } }
      );
    } catch (error) {
      console.error('⚠️  Erro ao replicar atualização de login:', error.message);
    }
    
    // Atualizar objeto user para resposta
    user.stats.lastLoginAt = lastLoginAt;

    // Gerar token (incluindo email para facilitar busca em múltiplos clusters)
    const token = generateToken(user._id, user.email);

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
    // Extrair email do token se disponível para busca otimizada
    let email = null;
    try {
      const token = req.header('Authorization')?.replace('Bearer ', '');
      if (token) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        email = decoded.email || null;
      }
    } catch (error) {
      // Token pode não ter email se for antigo, usar email do req.user
      email = req.user?.email || null;
    }
    
    // Buscar usuário de forma otimizada para garantir dados atualizados
    const user = await findUserOptimized(req.user._id, email || req.user?.email);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    // Converter para objeto e remover senha se presente
    const userResponse = user.toObject ? user.toObject() : user;
    delete userResponse.senha;

    res.json({
      success: true,
      data: {
        user: userResponse
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
    
    // Extrair email do token se disponível para busca otimizada
    let email = null;
    try {
      const token = req.header('Authorization')?.replace('Bearer ', '');
      if (token) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        email = decoded.email || null;
      }
    } catch (error) {
      // Token pode não ter email se for antigo, usar email do req.user
      email = req.user.email || null;
    }
    
    // Buscar usuário de forma otimizada
    const user = await findUserOptimized(req.user._id, email || req.user.email);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    // Atualizar campos do perfil
    if (updates.firstName) user.profile.firstName = updates.firstName;
    if (updates.lastName) user.profile.lastName = updates.lastName;
    if (updates.bio) user.profile.bio = updates.bio;
    if (updates.birthDate) user.profile.birthDate = updates.birthDate;
    if (updates.location) user.profile.location = updates.location;
    if (updates.website) user.profile.website = updates.website;
    if (updates.socialLinks) user.profile.socialLinks = updates.socialLinks;

    await user.save();
    
    // Replicar atualização em todos os clusters usando email (mais confiável)
    try {
      await databaseManager.writeToAllClusters(
        'users',
        'updateOne',
        { email: user.email },
        { 
          $set: {
            'profile.firstName': user.profile.firstName,
            'profile.lastName': user.profile.lastName,
            'profile.bio': user.profile.bio,
            'profile.birthDate': user.profile.birthDate,
            'profile.location': user.profile.location,
            'profile.website': user.profile.website,
            'profile.socialLinks': user.profile.socialLinks
          }
        }
      );
    } catch (error) {
      console.error('⚠️  Erro ao replicar atualização de perfil:', error.message);
    }

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
    
    // Extrair email do token se disponível para busca otimizada
    let email = null;
    try {
      const token = req.header('Authorization')?.replace('Bearer ', '');
      if (token) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        email = decoded.email || null;
      }
    } catch (error) {
      // Token pode não ter email se for antigo, usar email do req.user
      email = req.user.email || null;
    }
    
    // Buscar usuário de forma otimizada com senha
    let user = await findUserOptimized(req.user._id, email || req.user.email);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }
    
    // Se o usuário não tem senha carregada, buscar novamente com select
    if (!user.senha) {
      user = await User.findOne({ _id: user._id }).select('+senha');
      if (!user) {
        // Se ainda não encontrou, tentar por email
        user = await User.findOne({ email: email || req.user.email }).select('+senha');
      }
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

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
    
    // Replicar atualização de senha em todos os clusters usando email
    try {
      // Nota: Para senha, precisamos buscar a senha hasheada do usuário atual
      // Replicar usando updateOne com a senha já hasheada
      const hashedPassword = user.senha; // Mongoose já fez o hash no save()
      await databaseManager.writeToAllClusters(
        'users',
        'updateOne',
        { email: user.email },
        { $set: { senha: hashedPassword } }
      );
    } catch (error) {
      console.error('⚠️  Erro ao replicar atualização de senha:', error.message);
    }

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

