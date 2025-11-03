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
        uri: process.env.MONGODB_CLUSTER_1_URI || process.env.MONGODB_URI,
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
    
    // Armazenar URIs para uso posterior
    this.clusterUris = {};
    clusterConfigs.forEach(config => {
      if (config.uri) {
        this.clusterUris[config.key] = config.uri;
      }
    });

    const connectionOptions = {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      retryWrites: true,
      w: 'majority'
    };

      for (const config of clusterConfigs) {
      if (!config.uri) {
        console.log(`⚠️  ${config.name}: URI não configurada`);
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
          await mongoose.connect(config.uri, connectionOptions);
          connection = mongoose.connection;
          console.log(`✅ ${config.name}: Conectado (conexão padrão)`);
        } else {
          // Para SECONDARYs, criar conexões separadas
          connection = mongoose.createConnection(config.uri, connectionOptions);
          
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

        connection.on('reconnected', () => {
          console.log(`✅ ${config.name}: Reconectado`);
          this.clusterStatus[config.key].status = 'connected';
        });
      } catch (error) {
        console.error(`❌ Erro ao conectar ao ${config.name}:`, error.message);
        this.clusterStatus[config.key] = {
          status: 'error',
          role: config.key === 'cluster1' ? 'PRIMARY' : 'SECONDARY',
          error: error.message,
          lastCheck: new Date()
        };
      }
    }

    // Verificar se temos pelo menos um cluster conectado
    const connectedClusters = Object.values(this.clusterStatus).filter(
      s => s.status === 'connected'
    ).length;

    if (connectedClusters === 0) {
      throw new Error('❌ Nenhum cluster conectado!');
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
          
          if (existingConnection && existingConnection.readyState === 1 && existingConnection.db) {
            // Se já existe conexão separada com db disponível, fechar e usar mongoose padrão
            await existingConnection.close();
          }
          
          // Verificar se mongoose já está conectado antes de conectar novamente
          if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
          }
          
          // Conectar mongoose ao novo PRIMARY
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
          
          // Atualizar referências - ambos apontam para a mesma conexão padrão do mongoose
          this.clusters['cluster1'] = mongoose.connection;
          this.clusters[newPrimary] = mongoose.connection;
          
          console.log(`✅ Mongoose padrão conectado ao novo PRIMARY (${newPrimary})\n`);
    } catch (error) {
          console.error(`❌ Erro ao conectar mongoose ao novo PRIMARY:`, error.message);
          throw new Error(`Falha ao conectar mongoose ao novo PRIMARY: ${error.message}`);
        }
      } else {
        throw new Error('Nenhum PRIMARY disponível após eleição');
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
    } else {
      console.log(`\n⚠️  Nenhum cluster disponível para ser eleito como PRIMARY\n`);
    }

    this.electionInProgress = false;
  }

  /**
   * Escreve dados em todos os clusters (replicação)
   */
  async writeToAllClusters(collectionName, operation, ...args) {
    const results = {};
    const errors = {};

    for (const [key, connection] of Object.entries(this.clusters)) {
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
            result = await collection.insertOne(args[0]);
            break;
          case 'insertOne':
            result = await collection.insertOne(args[0]);
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

