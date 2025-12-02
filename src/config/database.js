const mongoose = require('mongoose');
require('dotenv').config();

/**
 * Gerenciador de Banco de Dados Multi-Cluster
 * Gerencia 3 clusters MongoDB como PRIMARY/SECONDARY com replicação distribuída
 */
class DatabaseManager {
  constructor() {
    this.clusters = {
      cluster1: null, // PRIMARY
      cluster2: null, // SECONDARY
      cluster3: null  // SECONDARY
    };
    this.primaryCluster = 'cluster1'; // Cluster primário por padrão
    this.clusterStatus = {};
    this.electionInProgress = false;
    this.lastHealthCheck = {};
    this.clusterUris = {}; // Armazenar URIs dos clusters
    
    // Configurar verificações de saúde periódicas
    this.setupHealthChecks();
  }

  /**
   * Conecta aos 3 clusters simultaneamente
   */
  async connectAllClusters() {
    console.log('🔗 Conectando aos 3 clusters...\n');
    
    const clusterConfigs = [
      { 
        key: 'cluster1', 
        uri: process.env.MONGODB_CLUSTER_1_URI,
        name: 'Cluster 1 (PRIMARY)'
      },
      { 
        key: 'cluster2', 
        uri: process.env.MONGODB_CLUSTER_2_URI,
        name: 'Cluster 2 (SECONDARY)'
      },
      { 
        key: 'cluster3', 
        uri: process.env.MONGODB_CLUSTER_3_URI,
        name: 'Cluster 3 (SECONDARY)'
      }
    ];
    
    // Verificar e logar URIs (sem senha)
    console.log('📋 Verificando configurações de cluster...');
    clusterConfigs.forEach(config => {
      if (!config.uri || config.uri.trim() === '') {
        console.log(`⚠️  ${config.name}: URI não configurada (variável MONGODB_${config.key.toUpperCase()}_URI)`);
      } else {
        // Mostrar URI sem senha para debug
        const uriWithoutPassword = config.uri.replace(/mongodb\+srv:\/\/([^:]+):([^@]+)@/, 'mongodb+srv://$1:***@');
        console.log(`✓ ${config.name}: URI configurada - ${uriWithoutPassword.substring(0, 80)}...`);
        
        // Verificar se a senha precisa ser URL-encoded
        const passwordMatch = config.uri.match(/mongodb\+srv:\/\/[^:]+:([^@]+)@/);
        if (passwordMatch) {
          const password = passwordMatch[1];
          const encodedPassword = encodeURIComponent(password);
          // Se a senha tem caracteres especiais e não está codificada, avisar
          if (password !== encodedPassword && !password.includes('%')) {
            console.log(`   ⚠️  Senha pode ter caracteres especiais - considere usar encodeURIComponent`);
          }
        }
      }
    });
    console.log('');
    
    // Armazenar URIs para uso posterior (garantir URL encoding correto)
    this.clusterUris = {};
    clusterConfigs.forEach(config => {
      // Só armazenar URIs válidas (não vazias)
      if (config.uri && config.uri.trim() !== '') {
        let uri = config.uri.trim();
        
        // Verificar e corrigir encoding da senha se necessário
        const uriMatch = uri.match(/^mongodb\+srv:\/\/([^:]+):([^@]+)@(.+)$/);
        if (uriMatch) {
          const username = uriMatch[1];
          const password = uriMatch[2];
          const rest = uriMatch[3];
          
          // Se a senha não está codificada e tem caracteres especiais, codificar
          if (!password.includes('%')) {
            const specialChars = /[!@#$%^&*()+=\[\]{};':"\\|,.<>?/~` ]/;
            if (specialChars.test(password)) {
              const encodedPassword = encodeURIComponent(password);
              uri = `mongodb+srv://${username}:${encodedPassword}@${rest}`;
              console.log(`   🔧 Senha do ${config.name} foi URL-encoded`);
            }
          }
        }
        
        this.clusterUris[config.key] = uri;
      }
    });

    const connectionOptions = {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 15000, // Aumentado para 15 segundos (mais tempo para Atlas)
        socketTimeoutMS: 45000,
        connectTimeoutMS: 15000, // Timeout para conexão inicial (mais tempo)
        retryWrites: true,
        w: 'majority'
        // Nota: bufferMaxEntries, useNewUrlParser e useUnifiedTopology foram removidos
        // pois não são mais suportados nas versões mais recentes do MongoDB driver
    };

      for (const config of clusterConfigs) {
      // Usar URI do clusterUris (que já foi processada e pode ter encoding corrigido)
      const uriToUse = this.clusterUris[config.key] || config.uri;
      
      // Verificar se URI não está configurada (undefined, null, ou string vazia)
      if (!uriToUse || uriToUse.trim() === '') {
        console.log(`⚠️  ${config.name}: URI não configurada`);
        this.clusterStatus[config.key] = {
          status: 'disconnected',
          role: config.key === 'cluster1' ? 'PRIMARY' : 'SECONDARY',
          lastCheck: new Date(),
          reason: 'URI não configurada'
        };
        continue;
      }

     /*   // ⚠️ TESTE: Desabilitar PRIMARY propositalmente para testar failover
      // REMOVA ESTE BLOCO para voltar ao funcionamento normal
      if (config.key === 'cluster1') {
        console.log(`🚫 ${config.name}: CONEXÃO DESABILITADA PARA TESTE DE FAILOVER`);
        this.clusterStatus[config.key] = {
          status: 'disconnected',
          role: 'PRIMARY',
          lastCheck: new Date(),
          reason: 'Desabilitado para teste'
        };
        continue; // Pula a conexão do PRIMARY
      }
*/
      try {
        let connection;
        
        // Para o PRIMARY, usar a conexão padrão do mongoose (para os modelos funcionarem)
        if (config.key === 'cluster1') {
          // Limpar qualquer conexão pendente antes de tentar conectar
          if (mongoose.connection.readyState !== 0) {
            try {
              await mongoose.disconnect().catch(() => {});
              mongoose.connection.removeAllListeners();
              // Aguardar um pouco para garantir que a desconexão foi processada
              await new Promise(resolve => setTimeout(resolve, 500));
            } catch (cleanupError) {
              console.log('⚠️  Erro ao limpar mongoose antes de conectar:', cleanupError.message);
            }
          }
          
          await mongoose.connect(uriToUse, connectionOptions);
          connection = mongoose.connection;
          console.log(`✅ ${config.name}: Conectado (conexão padrão)`);
        } else {
          // Para SECONDARYs, criar conexões separadas
          connection = mongoose.createConnection(uriToUse, connectionOptions);
          
          // Aguardar conexão estar pronta
          await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error('Timeout ao conectar'));
            }, 15000);
            
            if (connection.readyState === 1) {
              clearTimeout(timeout);
              resolve();
            } else {
              connection.once('connected', () => {
                clearTimeout(timeout);
                resolve();
              });
              connection.once('error', (err) => {
                clearTimeout(timeout);
                reject(err);
              });
            }
          });
          
          // Aguardar db estar disponível
          let attempts = 0;
          while (!connection.db && attempts < 20) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
          }
          
          if (!connection.db) {
            throw new Error('Banco de dados não disponível após conexão');
          }
          
          console.log(`✅ ${config.name}: Conectado`);
        }
        
        this.clusters[config.key] = connection;
        this.clusterStatus[config.key] = {
          status: 'connected',
          role: config.key === 'cluster1' ? 'PRIMARY' : 'SECONDARY',
          lastCheck: new Date()
        };
      
      // Configurar eventos de conexão
        connection.on('error', (err) => {
          console.error(`❌ Erro no ${config.name}:`, err.message);
          this.clusterStatus[config.key].status = 'error';
        });

        connection.on('disconnected', () => {
          console.log(`⚠️  ${config.name}: Desconectado`);
          this.clusterStatus[config.key].status = 'disconnected';
          this.checkAndElectNewPrimary();
        });

        connection.on('reconnected', async () => {
          console.log(`✅ ${config.name}: Reconectado`);
          this.clusterStatus[config.key].status = 'connected';
          
          // Se o cluster1 (PRIMARY original) voltou, sincronizar dados dos SECONDARYs
          if (config.key === 'cluster1' && this.primaryCluster !== 'cluster1') {
            console.log('🔄 PRIMARY original (cluster1) voltou! Sincronizando dados...');
            
            // Aguardar um pouco para garantir que a conexão está estável
            setTimeout(async () => {
              try {
                // Sincronizar coleções principais
                const collections = ['users', 'assinaturas', 'musicas', 'playlists', 'favoritos', 'historicos'];
                for (const collection of collections) {
                  await this.syncBackToPrimary(collection);
                }
                console.log('✅ Sincronização concluída!');
                
                // Se o PRIMARY voltou, podemos voltar a usá-lo como PRIMARY
                if (this.clusterStatus['cluster1']?.status === 'connected') {
                  console.log('👑 Voltando a usar cluster1 como PRIMARY');
                  this.primaryCluster = 'cluster1';
                  this.clusterStatus['cluster1'].role = 'PRIMARY';
                  
                  // Reconectar mongoose ao cluster1
                  if (mongoose.connection.readyState !== 1 || mongoose.connection !== this.clusters['cluster1']) {
                    try {
                      if (mongoose.connection.readyState === 1) {
                        await mongoose.disconnect();
                      }
                      // Definir connectionOptions novamente (já que estão fora do escopo)
                      const reconConnectionOptions = {
                        maxPoolSize: 10,
                        serverSelectionTimeoutMS: 5000,
                        socketTimeoutMS: 45000,
                        retryWrites: true,
                        w: 'majority'
                      };
                      await mongoose.connect(this.clusterUris['cluster1'], reconConnectionOptions);
                      this.clusters['cluster1'] = mongoose.connection;
                      console.log('✅ Mongoose reconectado ao PRIMARY original');
                    } catch (error) {
                      console.error('❌ Erro ao reconectar mongoose:', error.message);
                    }
                  }
                }
              } catch (error) {
                console.error('❌ Erro durante sincronização:', error.message);
              }
            }, 2000);
          }
        });
      } catch (error) {
        let errorMessage = error.message;
        let errorDetails = '';
        
        // Analisar tipo de erro e dar dicas
        if (errorMessage.includes('IP') || errorMessage.includes('whitelist')) {
          errorDetails = '\n   💡 Dica: Verifique se o IP está na whitelist do MongoDB Atlas';
          errorDetails += '\n      - Network Access > Add IP Address';
          errorDetails += '\n      - Para teste: 0.0.0.0/0 (Allow Access from Anywhere)';
          errorDetails += '\n      - Pode levar alguns minutos para aplicar mudanças';
        } else if (errorMessage.includes('authentication') || errorMessage.includes('credential')) {
          errorDetails = '\n   💡 Dica: Verifique usuário e senha na URI de conexão';
        } else if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
          errorDetails = '\n   💡 Dica: Verifique sua conexão de internet e se o cluster está online';
          errorDetails += '\n      - MongoDB Atlas Dashboard > Database > Cluster Status';
        } else if (errorMessage.includes('ENOTFOUND') || errorMessage.includes('DNS')) {
          errorDetails = '\n   💡 Dica: Verifique se o hostname da URI está correto';
        }
        
        console.error(`❌ Erro ao conectar ao ${config.name}:`);
        console.error(`   Mensagem: ${errorMessage}`);
        if (errorDetails) {
          console.error(errorDetails);
        }
        if (error.stack && process.env.NODE_ENV === 'development') {
          console.error(`   Stack: ${error.stack.split('\n').slice(0, 3).join('\n')}`);
        }
        
        this.clusterStatus[config.key] = {
          status: 'error',
          role: config.key === 'cluster1' ? 'PRIMARY' : 'SECONDARY',
          error: error.message,
          lastCheck: new Date()
        };
        
        // Se foi o cluster1 que falhou e mongoose estava tentando conectar, limpar estado
        if (config.key === 'cluster1' && mongoose.connection.readyState !== 0) {
          try {
            // Se está conectando ou conectado, tentar limpar
            if (mongoose.connection.readyState === 1 || mongoose.connection.readyState === 2) {
              await mongoose.disconnect().catch(() => {});
            }
            // Limpar event listeners pendentes
            mongoose.connection.removeAllListeners();
          } catch (cleanupError) {
            console.log('⚠️  Erro ao limpar mongoose após falha do cluster1:', cleanupError.message);
          }
        }
      }
    }

    // Verificar se temos pelo menos um cluster conectado
    const connectedClusters = Object.values(this.clusterStatus).filter(
      s => s.status === 'connected'
    ).length;

    if (connectedClusters === 0) {
      console.log('\n❌ Nenhum cluster conectado!\n');
      console.log('💡 Para diagnosticar o problema, execute:');
      console.log('   node scripts/test-connection.js\n');
      console.log('📋 Verificações comuns:');
      console.log('   1. Network Access no MongoDB Atlas:');
      console.log('      - Vá em Network Access > Add IP Address');
      console.log('      - Adicione 0.0.0.0/0 (Allow Access from Anywhere)');
      console.log('      - Aguarde alguns minutos para aplicar');
      console.log('   2. Verifique se as URIs estão corretas no arquivo .env');
      console.log('   3. Verifique se as credenciais (usuário/senha) estão corretas');
      console.log('   4. Verifique se os clusters estão online no Atlas Dashboard\n');
      throw new Error('❌ Nenhum cluster conectado! Execute "node scripts/test-connection.js" para diagnosticar.');
    }
    
    // Se temos pelo menos um cluster conectado, avisar sobre modo degradado
    const totalClusters = Object.keys(this.clusterStatus).length;
    if (connectedClusters < totalClusters) {
      console.log(`\n⚠️  Modo degradado: ${connectedClusters}/${totalClusters} clusters conectados`);
      console.log(`   O sistema funcionará, mas com capacidade reduzida\n`);
    }

    // Se PRIMARY não está conectado, eleger um novo PRIMARY e conectar mongoose padrão
    if (this.clusterStatus['cluster1']?.status !== 'connected') {
      console.log('\n🔄 PRIMARY offline, aguardando SECONDARYs estarem prontos...\n');
      
      // Aguardar um pouco para garantir que os SECONDARYs estão totalmente prontos
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log('🔄 Iniciando eleição automática...\n');
      await this.checkAndElectNewPrimary();
      
      // Conectar mongoose padrão ao novo PRIMARY
      const newPrimary = this.primaryCluster;
      if (newPrimary && newPrimary !== 'cluster1' && this.clusterUris[newPrimary]) {
        try {
          // Verificar se já existe uma conexão do newPrimary
          const existingConnection = this.clusters[newPrimary];
          
          // Verificar se mongoose já está conectado antes de conectar novamente
          if (mongoose.connection.readyState === 1) {
            try {
              await mongoose.disconnect();
            } catch (disconnectError) {
              console.log('⚠️  Erro ao desconectar mongoose:', disconnectError.message);
            }
          }
          
          // Conectar mongoose ao novo PRIMARY
          // NÃO fechar existingConnection ainda - usaremos ela como fallback se mongoose falhar
          try {
            await mongoose.connect(this.clusterUris[newPrimary], connectionOptions);
            
            // Verificar se conexão está pronta
            if (mongoose.connection.readyState !== 1) {
              // Aguardar conexão estar pronta
              await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                  reject(new Error('Timeout ao conectar mongoose'));
                }, 10000);
                
                if (mongoose.connection.readyState === 1) {
                  clearTimeout(timeout);
                  resolve();
                } else {
                  mongoose.connection.once('connected', () => {
                    clearTimeout(timeout);
                    resolve();
                  });
                  mongoose.connection.once('error', (err) => {
                    clearTimeout(timeout);
                    reject(err);
                  });
                }
              });
            }
            
            // Aguardar db estar disponível
            let attempts = 0;
            while (!mongoose.connection.db && attempts < 20) {
              await new Promise(resolve => setTimeout(resolve, 100));
              attempts++;
            }
            
            if (!mongoose.connection.db) {
              throw new Error('Banco de dados não disponível após conectar mongoose');
            }
            
            // Agora que mongoose está conectado com sucesso, podemos fechar a conexão existente se houver
            if (existingConnection && existingConnection.readyState === 1 && existingConnection !== mongoose.connection) {
              try {
                await existingConnection.close();
                console.log(`✅ Conexão existente do ${newPrimary} fechada (usando mongoose agora)`);
              } catch (closeError) {
                console.log('⚠️  Erro ao fechar conexão existente:', closeError.message);
              }
            }
            
            // Atualizar referências - ambos apontam para a mesma conexão padrão do mongoose
            this.clusters['cluster1'] = mongoose.connection;
            this.clusters[newPrimary] = mongoose.connection;
            
            console.log(`✅ Mongoose padrão conectado ao novo PRIMARY (${newPrimary})\n`);
          } catch (mongooseError) {
            console.error(`❌ Erro ao conectar mongoose ao novo PRIMARY:`, mongooseError.message);
            
            // Se mongoose falhou mas temos conexão existente, usar ela
            if (existingConnection && existingConnection.readyState === 1 && existingConnection.db) {
              console.log(`⚠️  Usando conexão existente do ${newPrimary} como fallback`);
              this.clusters['cluster1'] = existingConnection; // Mantém compatibilidade
              // Não precisamos atualizar clusters[newPrimary] pois já aponta para existingConnection
            } else {
              throw mongooseError; // Se não temos fallback, propagar erro
            }
          }
    } catch (error) {
          console.error(`❌ Erro ao conectar mongoose ao novo PRIMARY:`, error.message);
          // Se chegou aqui, pode ser que não tenhamos nenhum cluster disponível
          // Mas não vamos lançar erro aqui, apenas log
          throw new Error(`Falha ao conectar mongoose ao novo PRIMARY: ${error.message}`);
        }
      } else {
        // Se não tem PRIMARY disponível após eleição, verificar se temos pelo menos um cluster conectado
        const hasAnyConnected = Object.values(this.clusterStatus).some(status => status?.status === 'connected');
        if (!hasAnyConnected) {
          throw new Error('Nenhum cluster disponível após eleição');
        } else {
          console.log(`⚠️  PRIMARY não é cluster1 mas temos clusters conectados, continuando...`);
        }
      }
    }

    console.log(`\n✅ ${connectedClusters}/3 clusters conectados\n`);
    console.log(`👑 PRIMARY atual: ${this.primaryCluster.toUpperCase()}\n`);
  }

  /**
   * Configura verificações de saúde periódicas
   */
  setupHealthChecks() {
    setInterval(() => {
      this.performHealthCheck();
    }, 30000); // Verificar a cada 30 segundos
  }

  /**
   * Realiza verificação de saúde de todos os clusters
   */
  async performHealthCheck() {
    for (const [key, connection] of Object.entries(this.clusters)) {
      if (!connection) continue;

      try {
        await connection.db.admin().ping();
        this.clusterStatus[key].status = 'connected';
        this.clusterStatus[key].lastCheck = new Date();
        this.lastHealthCheck[key] = new Date();
      } catch (error) {
        this.clusterStatus[key].status = 'error';
        this.clusterStatus[key].error = error.message;
        this.lastHealthCheck[key] = new Date();
        
        // Se o PRIMARY caiu, iniciar eleição
        if (key === this.primaryCluster) {
          this.checkAndElectNewPrimary();
        }
      }
    }
  }

  /**
   * Verifica e elege um novo PRIMARY se necessário
   */
  async checkAndElectNewPrimary() {
    if (this.electionInProgress) return;
    
    const currentPrimary = this.primaryCluster;
    const currentPrimaryStatus = this.clusterStatus[currentPrimary];

    // Se o PRIMARY atual está funcionando, não fazer nada
    if (currentPrimaryStatus && currentPrimaryStatus.status === 'connected') {
      return;
    }

    this.electionInProgress = true;
    console.log(`\n🔄 Iniciando eleição de novo PRIMARY (${currentPrimary} está offline)...\n`);

    // Tentar eleger o próximo cluster disponível
    const clusterOrder = ['cluster1', 'cluster2', 'cluster3'];
    let newPrimary = null;

    for (const clusterKey of clusterOrder) {
      if (clusterKey === currentPrimary) continue;

      const connection = this.clusters[clusterKey];
      const status = this.clusterStatus[clusterKey];

      if (connection && status && status.status === 'connected') {
        try {
          // Verificar se connection.db está disponível
          if (!connection.db) {
            console.log(`⚠️  ${clusterKey}: connection.db não disponível ainda`);
            // Aguardar um pouco e tentar novamente
            await new Promise(resolve => setTimeout(resolve, 500));
            if (!connection.db) {
              console.log(`❌ ${clusterKey} não tem db disponível`);
              continue;
            }
          }
          
          // Testar conexão
          await connection.db.admin().ping();
          
          newPrimary = clusterKey;
          console.log(`✅ ${clusterKey.toUpperCase()} eleito como novo PRIMARY`);
          break;
        } catch (error) {
          console.log(`❌ ${clusterKey} não está disponível: ${error.message}`);
        }
      }
    }

    if (newPrimary) {
      // Atualizar o PRIMARY anterior para SECONDARY
      if (this.clusterStatus[currentPrimary]) {
        this.clusterStatus[currentPrimary].role = 'SECONDARY';
      }
      
      // Promover novo PRIMARY
      this.primaryCluster = newPrimary;
      this.clusterStatus[newPrimary].role = 'PRIMARY';
      
      console.log(`\n👑 Novo PRIMARY: ${newPrimary.toUpperCase()}\n`);
      
      // Reconectar mongoose padrão ao novo PRIMARY (se não for cluster1)
      if (newPrimary !== 'cluster1' && this.clusterUris[newPrimary]) {
        try {
          console.log(`🔄 Reconectando mongoose padrão ao novo PRIMARY (${newPrimary})...`);
          
          // SEMPRE desconectar mongoose se estiver conectado (para limpar conexão antiga)
          if (mongoose.connection.readyState === 1) {
            try {
              await mongoose.disconnect();
              console.log('✅ Mongoose desconectado do cluster anterior');
            } catch (disconnectError) {
              console.log('⚠️  Erro ao desconectar mongoose:', disconnectError.message);
              // Forçar desconexão mesmo com erro
              try {
                mongoose.connection.close();
              } catch (e) {
                // Ignorar erros de fechamento
              }
            }
          }
          
          // Aguardar um pouco para garantir que a desconexão foi processada
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Conectar mongoose ao novo PRIMARY
          const connectionOptions = {
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            retryWrites: true,
            w: 'majority'
          };
          
          await mongoose.connect(this.clusterUris[newPrimary], connectionOptions);
          console.log(`✅ Mongoose reconectado ao novo PRIMARY (${newPrimary})`);
          
          // Atualizar referências
          this.clusters['cluster1'] = mongoose.connection; // Mantém compatibilidade
          this.clusters[newPrimary] = mongoose.connection;
          
        } catch (error) {
          console.error(`❌ Erro ao reconectar mongoose ao novo PRIMARY:`, error.message);
          // Tentar usar conexão existente se houver
          const existingConnection = this.clusters[newPrimary];
          if (existingConnection && existingConnection.readyState === 1 && existingConnection.db) {
            console.log(`⚠️  Usando conexão existente do ${newPrimary} enquanto mongoose não reconecta`);
            this.clusters['cluster1'] = existingConnection; // Mantém compatibilidade
          }
        }
      } else if (newPrimary === 'cluster1') {
        // Se cluster1 voltou a ser PRIMARY, reconectar mongoose a ele
        if (this.clusterUris['cluster1']) {
          try {
            if (mongoose.connection.readyState !== 1 || 
                mongoose.connection.host !== this.clusterUris['cluster1']) {
              const connectionOptions = {
                maxPoolSize: 10,
                serverSelectionTimeoutMS: 5000,
                socketTimeoutMS: 45000,
                retryWrites: true,
                w: 'majority'
              };
              
              if (mongoose.connection.readyState === 1) {
                await mongoose.disconnect();
              }
              
              await mongoose.connect(this.clusterUris['cluster1'], connectionOptions);
              this.clusters['cluster1'] = mongoose.connection;
              console.log('✅ Mongoose reconectado ao cluster1 (PRIMARY)');
            }
          } catch (error) {
            console.error(`❌ Erro ao reconectar mongoose ao cluster1:`, error.message);
          }
        }
      }
    } else {
      console.log(`\n⚠️  Nenhum cluster disponível para ser eleito como PRIMARY\n`);
    }

    this.electionInProgress = false;
  }

  /**
   * Escreve dados em todos os clusters (replicação)
   * @param {string} skipCluster - Opcional: cluster a ser pulado (geralmente o PRIMARY onde já foi salvo)
   */
  async writeToAllClusters(collectionName, operation, ...args) {
    const results = {};
    const errors = {};
    
    // Extrair skipCluster dos argumentos se fornecido como último parâmetro string
    let skipCluster = null;
    if (args.length > 0 && typeof args[args.length - 1] === 'string' && args[args.length - 1].startsWith('skip:')) {
      skipCluster = args.pop().replace('skip:', '');
    }

    for (const [key, connection] of Object.entries(this.clusters)) {
      // Pular cluster se especificado (para evitar duplicate key no PRIMARY onde já foi salvo)
      if (skipCluster && key === skipCluster) {
        console.log(`⏭️  Pulando ${key} (já possui o dado)`);
        continue;
      }
      
      if (!connection || this.clusterStatus[key]?.status !== 'connected') {
        errors[key] = 'Cluster não conectado';
        continue;
      }

      try {
        // Para operações de escrita, usar diretamente a collection do MongoDB
        const collection = connection.db.collection(collectionName);

        let result;
        switch (operation) {
          case 'create':
            // args[0] é um objeto com os dados do documento
            // Usar upsert para evitar duplicate key
            result = await collection.replaceOne(
              { _id: args[0]._id },
              args[0],
              { upsert: true }
            );
            break;
          case 'insertOne':
            // Usar replaceOne com upsert para evitar duplicate key
            result = await collection.replaceOne(
              { _id: args[0]._id },
              args[0],
              { upsert: true }
            );
            break;
          case 'insertMany':
            result = await collection.insertMany(args[0]);
            break;
          case 'updateOne':
            result = await collection.updateOne(args[0], args[1], args[2] || {});
            break;
          case 'updateMany':
            result = await collection.updateMany(args[0], args[1], args[2] || {});
            break;
          case 'deleteOne':
            result = await collection.deleteOne(args[0]);
            break;
          case 'deleteMany':
            result = await collection.deleteMany(args[0]);
            break;
          case 'replaceOne':
            result = await collection.replaceOne(args[0], args[1], args[2] || {});
            break;
          default:
            throw new Error(`Operação ${operation} não suportada`);
        }

        results[key] = result;
      } catch (error) {
        errors[key] = error.message;
        console.error(`❌ Erro ao escrever no ${key}:`, error.message);
      }
    }

    // Se pelo menos uma escrita foi bem-sucedida, consideramos sucesso
    const successCount = Object.keys(results).length;
    if (successCount > 0) {
      return {
        success: true,
        results,
        errors,
        replicatedTo: successCount
      };
    }

    throw new Error(`Falha ao escrever em todos os clusters: ${JSON.stringify(errors)}`);
  }

  /**
   * Encontra um cluster disponível para escrita (tenta PRIMARY primeiro, depois SECONDARYs)
   * @returns {Object} { clusterKey, connection } ou null se nenhum estiver disponível
   */
  findAvailableCluster() {
    // Tentar PRIMARY primeiro
    const primaryKey = this.primaryCluster;
    const primaryConnection = this.clusters[primaryKey];
    const primaryStatus = this.clusterStatus[primaryKey];
    
    if (primaryConnection && primaryStatus?.status === 'connected') {
      try {
        // Verificar se connection.db está disponível
        if (primaryConnection.db) {
          return { clusterKey: primaryKey, connection: primaryConnection };
        }
      } catch (error) {
        console.log(`⚠️  PRIMARY (${primaryKey}) tem db indisponível`);
      }
    }
    
    // Se PRIMARY não está disponível, tentar SECONDARYs
    console.log(`⚠️  PRIMARY (${primaryKey}) não disponível, procurando SECONDARYs...`);
    const clusterOrder = ['cluster1', 'cluster2', 'cluster3'];
    
    for (const key of clusterOrder) {
      if (key === primaryKey) continue; // Pular PRIMARY já verificado
      
      const connection = this.clusters[key];
      const status = this.clusterStatus[key];
      
      if (connection && status?.status === 'connected') {
        try {
          if (connection.db) {
            console.log(`✅ Cluster disponível encontrado: ${key}`);
            return { clusterKey: key, connection: connection };
          }
        } catch (error) {
          console.log(`⚠️  ${key} tem db indisponível`);
        }
      }
    }
    
    return null;
  }

  /**
   * Escreve dados com fallback automático (tenta PRIMARY primeiro, se falhar tenta outros clusters)
   * @param {string} collectionName - Nome da coleção
   * @param {string} operation - Operação ('insertOne', 'create', etc)
   * @param {...any} args - Argumentos da operação
   * @returns {Object} { success, clusterUsed, result, errors }
   */
  async writeWithFallback(collectionName, operation, ...args) {
    const availableCluster = this.findAvailableCluster();
    
    if (!availableCluster) {
      throw new Error('Nenhum cluster disponível para escrita');
    }
    
    const { clusterKey, connection } = availableCluster;
    const results = {};
    const errors = {};
    
    try {
      const collection = connection.db.collection(collectionName);
      let result;
      
      switch (operation) {
        case 'create':
        case 'insertOne':
          // args[0] é um objeto com os dados do documento
          // Usar replaceOne com upsert para evitar duplicate key
          result = await collection.replaceOne(
            { _id: args[0]._id },
            args[0],
            { upsert: true }
          );
          break;
        case 'insertMany':
          result = await collection.insertMany(args[0]);
          break;
        case 'updateOne':
          result = await collection.updateOne(args[0], args[1], args[2] || {});
          break;
        case 'updateMany':
          result = await collection.updateMany(args[0], args[1], args[2] || {});
          break;
        case 'deleteOne':
          result = await collection.deleteOne(args[0]);
          break;
        case 'deleteMany':
          result = await collection.deleteMany(args[0]);
          break;
        case 'replaceOne':
          result = await collection.replaceOne(args[0], args[1], args[2] || {});
          break;
        default:
          throw new Error(`Operação ${operation} não suportada`);
      }
      
      results[clusterKey] = result;
      console.log(`✅ Dados salvos no cluster: ${clusterKey}`);
      
      // Tentar replicar nos outros clusters (exceto o que já salvou)
      console.log(`🔄 Tentando replicar em outros clusters...`);
      const replicationResult = await this.writeToAllClusters(
        collectionName, 
        operation, 
        ...args, 
        `skip:${clusterKey}`
      );
      
      return {
        success: true,
        clusterUsed: clusterKey,
        result: result,
        replication: replicationResult,
        errors: errors
      };
      
    } catch (error) {
      console.error(`❌ Erro ao escrever no ${clusterKey}:`, error.message);
      
      // Se falhou no cluster escolhido, tentar outro
      if (clusterKey !== this.primaryCluster) {
        console.log(`🔄 Tentando outro cluster após falha em ${clusterKey}...`);
        
        // Tentar outros clusters
        const clusterOrder = ['cluster1', 'cluster2', 'cluster3'];
        for (const key of clusterOrder) {
          if (key === clusterKey) continue; // Pular o que já falhou
          
          const conn = this.clusters[key];
          const st = this.clusterStatus[key];
          
          if (conn && st?.status === 'connected' && conn.db) {
            try {
              const collection = conn.db.collection(collectionName);
              let result;
              
              switch (operation) {
                case 'create':
                case 'insertOne':
                  result = await collection.replaceOne(
                    { _id: args[0]._id },
                    args[0],
                    { upsert: true }
                  );
                  break;
                default:
                  throw new Error(`Operação ${operation} não suportada para fallback`);
              }
              
              console.log(`✅ Dados salvos no cluster de fallback: ${key}`);
              
              // Tentar replicar nos outros clusters
              const replicationResult = await this.writeToAllClusters(
                collectionName, 
                operation, 
                ...args, 
                `skip:${key}`
              );
              
              return {
                success: true,
                clusterUsed: key,
                result: result,
                replication: replicationResult,
                errors: { [clusterKey]: error.message }
              };
            } catch (fallbackError) {
              console.error(`❌ Erro no fallback ${key}:`, fallbackError.message);
              errors[key] = fallbackError.message;
            }
          }
        }
      }
      
      throw error;
    }
  }

  /**
   * Sincroniza dados de volta para o PRIMARY quando ele volta (para dados salvos em SECONDARY enquanto PRIMARY estava offline)
   * @param {string} collectionName - Nome da coleção
   * @param {string} sourceCluster - Cluster de origem (onde os dados foram salvos)
   * @param {Date} sinceDate - Data mínima para sincronizar (opcional)
   */
  async syncBackToPrimary(collectionName, sourceCluster = null, sinceDate = null) {
    const primaryKey = 'cluster1'; // PRIMARY original é sempre cluster1
    const primaryConnection = this.clusters[primaryKey];
    const primaryStatus = this.clusterStatus[primaryKey];
    
    // Se PRIMARY não está conectado, não pode sincronizar
    if (!primaryConnection || primaryStatus?.status !== 'connected' || !primaryConnection.db) {
      console.log(`⚠️  PRIMARY (${primaryKey}) não está disponível para sincronização`);
      return { success: false, message: 'PRIMARY não disponível' };
    }
    
    // Se não especificou cluster de origem, tentar todos os SECONDARYs
    const sourceClusters = sourceCluster ? [sourceCluster] : ['cluster2', 'cluster3'];
    let syncedCount = 0;
    const errors = {};
    
    for (const sourceKey of sourceClusters) {
      if (sourceKey === primaryKey) continue; // Pular PRIMARY
      
      const sourceConnection = this.clusters[sourceKey];
      const sourceStatus = this.clusterStatus[sourceKey];
      
      if (!sourceConnection || sourceStatus?.status !== 'connected' || !sourceConnection.db) {
        continue; // Pular clusters não conectados
      }
      
      try {
        console.log(`🔄 Sincronizando ${collectionName} de ${sourceKey} para ${primaryKey}...`);
        
        const sourceCollection = sourceConnection.db.collection(collectionName);
        const primaryCollection = primaryConnection.db.collection(collectionName);
        
        // Construir query com data mínima se fornecida
        const query = sinceDate ? { createdAt: { $gte: sinceDate } } : {};
        
        // Buscar documentos do cluster de origem que não existem no PRIMARY (ou foram atualizados depois)
        const sourceDocs = await sourceCollection.find(query).toArray();
        
        for (const doc of sourceDocs) {
          try {
            // Verificar se documento existe no PRIMARY
            const existingDoc = await primaryCollection.findOne({ _id: doc._id });
            
            // Se não existe ou está desatualizado, inserir/atualizar
            if (!existingDoc || 
                (doc.updatedAt && existingDoc.updatedAt && 
                 new Date(doc.updatedAt) > new Date(existingDoc.updatedAt))) {
              await primaryCollection.replaceOne(
                { _id: doc._id },
                doc,
                { upsert: true }
              );
              syncedCount++;
            }
          } catch (docError) {
            console.error(`⚠️  Erro ao sincronizar documento ${doc._id}:`, docError.message);
          }
        }
        
        console.log(`✅ ${syncedCount} documentos sincronizados de ${sourceKey} para ${primaryKey}`);
      } catch (error) {
        console.error(`❌ Erro ao sincronizar de ${sourceKey}:`, error.message);
        errors[sourceKey] = error.message;
      }
    }
    
    return {
      success: syncedCount > 0 || Object.keys(errors).length === 0,
      syncedCount,
      errors
    };
  }

  /**
   * Lê dados do PRIMARY (com fallback para SECONDARY se PRIMARY estiver offline)
   */
  async readFromCluster(collectionName, operation, ...args) {
    // Tentar ler do PRIMARY primeiro
    let primaryKey = this.primaryCluster;
    let connection = this.clusters[primaryKey];
    let status = this.clusterStatus[primaryKey];

    // Se PRIMARY está offline, tentar SECONDARYs
    if (!connection || status?.status !== 'connected') {
      console.log(`⚠️  PRIMARY (${primaryKey}) offline, tentando SECONDARYs...`);
      
      for (const [key, conn] of Object.entries(this.clusters)) {
        if (key === primaryKey) continue;
        
        const st = this.clusterStatus[key];
        if (conn && st && st.status === 'connected') {
          connection = conn;
          primaryKey = key;
          status = st;
          break;
        }
      }
    }

    if (!connection) {
      throw new Error('Nenhum cluster disponível para leitura');
    }

    try {
      // Usar Model do mongoose padrão ou buscar do cluster
      const Model = mongoose.models[collectionName] || 
                   connection.model(collectionName) || 
                   mongoose.connection.model(collectionName);

      if (!Model) {
        // Se não encontrar modelo, usar collection diretamente
        const collection = connection.db.collection(collectionName);
        
        switch (operation) {
          case 'findOne':
            return await collection.findOne(...args);
          case 'find':
            return await collection.find(...args).toArray();
          case 'findById':
            return await collection.findOne({ _id: new mongoose.Types.ObjectId(args[0]) });
          default:
            throw new Error(`Modelo ${collectionName} não encontrado`);
        }
      }

      switch (operation) {
        case 'findOne':
          return await Model.findOne(...args);
        case 'find':
          return await Model.find(...args);
        case 'findById':
          return await Model.findById(...args);
        case 'findByIdAndUpdate':
          return await Model.findByIdAndUpdate(...args);
        case 'findByIdAndDelete':
          return await Model.findByIdAndDelete(...args);
        case 'countDocuments':
          return await Model.countDocuments(...args);
        default:
          throw new Error(`Operação ${operation} não suportada`);
      }
    } catch (error) {
      throw new Error(`Erro ao ler do ${primaryKey}: ${error.message}`);
    }
  }

  /**
   * Obtém conexão do cluster PRIMARY
   */
  getPrimaryConnection() {
    return this.clusters[this.primaryCluster];
  }

  /**
   * Obtém conexão de um cluster específico
   */
  getClusterConnection(clusterKey) {
    return this.clusters[clusterKey];
  }

  /**
   * Obtém status de todas as conexões
   */
  getConnectionStatus() {
    return {
      primary: this.primaryCluster,
      clusters: this.clusterStatus,
      lastHealthCheck: this.lastHealthCheck
    };
  }

  /**
   * Registra modelo em todos os clusters
   */
  registerModel(name, schema) {
    for (const [key, connection] of Object.entries(this.clusters)) {
      if (connection) {
        // Verificar se o modelo já existe para evitar avisos
        if (!connection.models[name]) {
          connection.model(name, schema);
        }
      }
    }
    
    // Também registrar na conexão padrão do mongoose (para compatibilidade)
    if (!mongoose.models[name]) {
      mongoose.model(name, schema);
    }
  }

  /**
   * Desconecta todos os clusters
   */
  async disconnectAll() {
    console.log('🔌 Desconectando todos os clusters...');
    
    for (const [key, connection] of Object.entries(this.clusters)) {
      if (connection) {
        try {
          // Se for cluster1 (PRIMARY), usa a conexão padrão do mongoose
          if (key === 'cluster1') {
            // Não fechar aqui, será fechado abaixo
            continue;
          } else {
            // Para SECONDARYs, fechar conexões separadas
            await connection.close();
            console.log(`✅ ${key} desconectado`);
          }
        } catch (error) {
          console.error(`❌ Erro ao desconectar ${key}:`, error.message);
        }
      }
    }

    // Desconectar conexão padrão (PRIMARY)
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      console.log('✅ cluster1 (PRIMARY) desconectado');
    }
  }
}

// Singleton instance
const databaseManager = new DatabaseManager();

module.exports = databaseManager;

