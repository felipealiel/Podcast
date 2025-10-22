const mongoose = require('mongoose');
require('dotenv').config();

class DatabaseManager {
  constructor() {
    this.connections = {};
    this.shardConnections = {};
  }

  /**
   * Conecta ao banco principal (MongoDB Atlas)
   */
  async connectMain() {
    try {
      const options = {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      };

      this.connections.main = await mongoose.connect(process.env.MONGODB_URI, options);
      
      console.log('✅ Conectado ao MongoDB Atlas (Banco Principal)');
      
      // Configurar eventos de conexão
      mongoose.connection.on('error', (err) => {
        console.error('❌ Erro na conexão principal:', err);
      });

      mongoose.connection.on('disconnected', () => {
        console.log('⚠️ Desconectado do banco principal');
      });

      return this.connections.main;
    } catch (error) {
      console.error('❌ Erro ao conectar ao banco principal:', error);
      throw error;
    }
  }

  /**
   * Conecta aos shards específicos
   */
  async connectShards() {
    const shardUris = [
      process.env.MONGODB_SHARD_URI_1,
      process.env.MONGODB_SHARD_URI_2,
      process.env.MONGODB_SHARD_URI_3
    ];

    for (let i = 0; i < shardUris.length; i++) {
      if (shardUris[i]) {
        try {
          const shardConnection = await mongoose.createConnection(shardUris[i], {
            maxPoolSize: 5,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
          });

          this.shardConnections[`shard${i + 1}`] = shardConnection;
          console.log(`✅ Conectado ao Shard ${i + 1}`);
        } catch (error) {
          console.error(`❌ Erro ao conectar ao Shard ${i + 1}:`, error);
        }
      }
    }
  }

  /**
   * Obtém conexão de um shard específico
   */
  getShardConnection(shardName) {
    return this.shardConnections[shardName];
  }

  /**
   * Obtém conexão principal
   */
  getMainConnection() {
    return this.connections.main;
  }

  /**
   * Desconecta todas as conexões
   */
  async disconnectAll() {
    try {
      // Desconectar shards
      for (const [shardName, connection] of Object.entries(this.shardConnections)) {
        await connection.close();
        console.log(`🔌 Desconectado do ${shardName}`);
      }

      // Desconectar conexão principal
      if (this.connections.main) {
        await mongoose.disconnect();
        console.log('🔌 Desconectado do banco principal');
      }
    } catch (error) {
      console.error('❌ Erro ao desconectar:', error);
    }
  }

  /**
   * Verifica status das conexões
   */
  getConnectionStatus() {
    const status = {
      main: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      shards: {}
    };

    for (const [shardName, connection] of Object.entries(this.shardConnections)) {
      status.shards[shardName] = connection.readyState === 1 ? 'connected' : 'disconnected';
    }

    return status;
  }
}

// Singleton instance
const databaseManager = new DatabaseManager();

module.exports = databaseManager;
