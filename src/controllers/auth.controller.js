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
    console.log('📝 Iniciando registro de usuário...');
    const { nomeUsuario, email, senha, firstName, lastName, role } = req.body;
    
    // Validar dados básicos
    if (!email || !nomeUsuario || !senha) {
      return res.status(400).json({
        success: false,
        message: 'Email, nome de usuário e senha são obrigatórios'
      });
    }

    // Verificar se usuário já existe (verificar em todos os clusters disponíveis)
    console.log('🔍 Verificando se usuário já existe em todos os clusters...');
    let userExists = null;
    
    // Tentar primeiro no PRIMARY usando o modelo mongoose
    try {
      userExists = await User.findOne({
        $or: [{ email }, { nomeUsuario }]
      });
    } catch (error) {
      console.log('⚠️  Erro ao verificar no PRIMARY, tentando outros clusters...');
    }
    
    // Se não encontrou no PRIMARY, tentar em outros clusters
    if (!userExists) {
      try {
        userExists = await databaseManager.readFromCluster(
          'users',
          'findOne',
          {
            $or: [{ email }, { nomeUsuario }]
          }
        );
        if (userExists) {
          userExists = new User(userExists);
        }
      } catch (error) {
        console.log('⚠️  Erro ao verificar em outros clusters:', error.message);
      }
    }
    
    console.log(userExists ? '⚠️  Usuário já existe' : '✅ Email/username disponível');

    if (userExists) {
      return res.status(400).json({
        success: false,
        message: userExists.email === email
          ? 'Email já cadastrado'
          : 'Nome de usuário já está em uso'
      });
    }

    // Validar role (só aceita 'user' ou 'producer', default é 'user')
    const userRole = (role === 'producer') ? 'producer' : 'user';

    // Criar usuário no PRIMARY
    console.log('👤 Criando novo usuário...');
    const user = new User({
      nomeUsuario,
      email,
      senha,
      profile: {
        firstName,
        lastName
      },
      account: {
        role: userRole
      }
    });

    // Salvar usuário usando writeWithFallback (tenta PRIMARY, se falhar tenta outros clusters)
    console.log('💾 Salvando usuário no banco com failover automático...');
    let userData;
    let clusterUsed = null;
    
    try {
      // Tentar salvar no PRIMARY usando mongoose (método padrão)
      const primaryConnection = databaseManager.getPrimaryConnection();
      const primaryStatus = databaseManager.getConnectionStatus().clusters[databaseManager.primaryCluster];
      
      if (primaryConnection && primaryStatus?.status === 'connected' && primaryConnection.db) {
        try {
          await user.save();
          console.log('✅ Usuário salvo no PRIMARY');
          userData = user.toObject();
          clusterUsed = databaseManager.primaryCluster;
        } catch (primaryError) {
          console.log('⚠️  Erro ao salvar no PRIMARY, usando fallback...');
          throw primaryError; // Forçar fallback
        }
      } else {
        throw new Error('PRIMARY não disponível');
      }
    } catch (error) {
      console.log('🔄 PRIMARY não disponível, tentando salvar em outro cluster...');
      
      // Se falhou no PRIMARY, usar writeWithFallback
      try {
        userData = user.toObject();
        // Garantir que o _id seja preservado como ObjectId
        if (userData._id) {
          userData._id = userData._id instanceof mongoose.Types.ObjectId 
            ? userData._id 
            : new mongoose.Types.ObjectId(userData._id.toString());
        }
        
        const writeResult = await databaseManager.writeWithFallback('users', 'insertOne', userData);
        clusterUsed = writeResult.clusterUsed;
        console.log(`✅ Usuário salvo no cluster de fallback: ${clusterUsed}`);
        
        // Criar instância do User a partir dos dados salvos
        user = new User(userData);
      } catch (fallbackError) {
        console.error('❌ Erro ao salvar usuário em qualquer cluster:', fallbackError.message);
        return res.status(500).json({
          success: false,
          message: 'Erro ao criar usuário. Nenhum cluster disponível.',
          error: process.env.NODE_ENV === 'development' ? fallbackError.message : undefined
        });
      }
    }
    
    // Se salvou em um cluster diferente do PRIMARY, também replicar nos outros (exceto o usado)
    if (clusterUsed && clusterUsed !== databaseManager.primaryCluster) {
      console.log('🔄 Replicando usuário nos outros clusters...');
      try {
        await databaseManager.writeToAllClusters('users', 'insertOne', userData, `skip:${clusterUsed}`);
        console.log('✅ Usuário replicado nos outros clusters');
      } catch (error) {
        console.error('⚠️  Erro ao replicar usuário:', error.message);
        // Continuar mesmo se a replicação falhar
      }
    } else if (clusterUsed === databaseManager.primaryCluster) {
      // Se salvou no PRIMARY, replicar nos SECONDARYs
      console.log('🔄 Replicando usuário nos SECONDARYs...');
      try {
        // Garantir que userData tenha todos os campos necessários
        if (!userData) {
          userData = user.toObject();
        }
        await databaseManager.writeToAllClusters('users', 'insertOne', userData, `skip:${clusterUsed}`);
        console.log('✅ Usuário replicado nos SECONDARYs');
      } catch (error) {
        console.error('⚠️  Erro ao replicar usuário:', error.message);
        // Continuar mesmo se a replicação falhar
      }
    }

    // Criar assinatura free automática no PRIMARY
    console.log('📋 Criando assinatura free...');
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

    // Criar assinatura usando writeWithFallback
    console.log('💾 Salvando assinatura com failover automático...');
    let assinaturaData;
    let assinaturaClusterUsed = null;
    
    try {
      // Tentar salvar no PRIMARY usando mongoose
      const primaryConnection = databaseManager.getPrimaryConnection();
      const primaryStatus = databaseManager.getConnectionStatus().clusters[databaseManager.primaryCluster];
      
      if (primaryConnection && primaryStatus?.status === 'connected' && primaryConnection.db) {
        try {
          await assinatura.save();
          console.log('✅ Assinatura salva no PRIMARY');
          assinaturaData = assinatura.toObject();
          assinaturaClusterUsed = databaseManager.primaryCluster;
        } catch (primaryError) {
          console.log('⚠️  Erro ao salvar assinatura no PRIMARY, usando fallback...');
          throw primaryError;
        }
      } else {
        throw new Error('PRIMARY não disponível');
      }
    } catch (error) {
      console.log('🔄 PRIMARY não disponível, tentando salvar assinatura em outro cluster...');
      
      try {
        assinaturaData = assinatura.toObject();
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
        
        const writeResult = await databaseManager.writeWithFallback('assinaturas', 'insertOne', assinaturaData);
        assinaturaClusterUsed = writeResult.clusterUsed;
        console.log(`✅ Assinatura salva no cluster: ${assinaturaClusterUsed}`);
      } catch (fallbackError) {
        console.error('⚠️  Erro ao criar assinatura:', fallbackError.message);
        // Continuar mesmo se falhar a assinatura
      }
    }
    
    // Replicar assinatura se salvou no PRIMARY
    if (assinaturaData && assinaturaClusterUsed === databaseManager.primaryCluster) {
      try {
        await databaseManager.writeToAllClusters('assinaturas', 'insertOne', assinaturaData, `skip:${assinaturaClusterUsed}`);
        console.log('✅ Assinatura replicada em todos os clusters');
      } catch (error) {
        console.error('⚠️  Erro ao replicar assinatura:', error.message);
      }
    } else if (assinaturaData && assinaturaClusterUsed) {
      // Se salvou em outro cluster, replicar nos outros
      try {
        await databaseManager.writeToAllClusters('assinaturas', 'insertOne', assinaturaData, `skip:${assinaturaClusterUsed}`);
        console.log('✅ Assinatura replicada nos outros clusters');
      } catch (error) {
        console.error('⚠️  Erro ao replicar assinatura:', error.message);
      }
    }

    // Gerar token (incluindo email para facilitar busca em múltiplos clusters)
    console.log('🔑 Gerando token JWT...');
    const token = generateToken(user._id, user.email);

    // Remover senha do objeto de retorno
    const userResponse = user.toObject();
    delete userResponse.senha;

    console.log('✅ Registro concluído com sucesso!');
    res.status(201).json({
      success: true,
      message: 'Usuário criado com sucesso!',
      data: {
        user: userResponse,
        token
      }
    });
  } catch (error) {
    console.error('❌ Erro ao registrar usuário:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao criar usuário',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Erro interno do servidor'
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

    // Buscar usuário usando readFromCluster (que já faz fallback automático)
    // Isso garante que funciona mesmo quando o PRIMARY está offline
    // NÃO usar User.findOne() diretamente pois pode estar conectado ao cluster offline
    let user = null;
    
    try {
      // Buscar usuário diretamente na collection (não via modelo) para incluir senha
      // Usar findAvailableCluster para garantir que busca em cluster disponível
      const availableCluster = databaseManager.findAvailableCluster();
      
      if (!availableCluster || !availableCluster.connection || !availableCluster.connection.db) {
        throw new Error('Nenhum cluster disponível para buscar usuário');
      }
      
      // Buscar usuário com senha incluída
      const userData = await availableCluster.connection.db.collection('users').findOne({
        $or: [
          { email: emailOrUsername },
          { nomeUsuario: emailOrUsername }
        ]
      });
      
      if (userData) {
        // Criar instância do modelo User a partir dos dados encontrados
        user = new User(userData);
        // A senha já vem incluída quando buscamos diretamente na collection
        if (userData.senha) {
          user.senha = userData.senha;
        }
      }
    } catch (error) {
      console.error('❌ Erro ao buscar usuário:', error.message);
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

