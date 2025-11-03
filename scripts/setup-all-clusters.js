const mongoose = require('mongoose');
const databaseManager = require('../src/config/database');
require('dotenv').config();

// Importar todos os modelos
const { User, Podcast, Musica, Playlist, Assinatura } = require('../src/models');

/**
 * Script para configurar todos os 3 clusters com as mesmas coleções e índices
 */
class MultiClusterSetup {
  constructor() {
    this.clusterConfigs = [
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
  }

  /**
   * Conecta a um cluster específico
   */
  async connectToCluster(config) {
    if (!config.uri) {
      console.log(`⚠️  ${config.name}: URI não configurada, pulando...`);
      return null;
    }

    try {
      const connection = mongoose.createConnection(config.uri, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 15000,
        socketTimeoutMS: 45000,
      });
      
      // Aguardar conexão estar pronta usando asPromise() se disponível
      if (connection.asPromise) {
        await connection.asPromise();
      } else {
        // Fallback: aguardar evento connected
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Timeout ao conectar (15s)'));
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
      }
      
      // Aguardar um pouco mais para garantir que db está disponível
      let attempts = 0;
      while (!connection.db && attempts < 10) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
      
      if (!connection.db) {
        throw new Error('Banco de dados não disponível após conexão');
      }
      
      console.log(`✅ Conectado ao ${config.name}`);
      return connection;
    } catch (error) {
      console.error(`❌ Erro ao conectar ao ${config.name}:`, error.message);
      return null;
    }
  }

  /**
   * Cria todas as coleções em um cluster
   */
  async createCollections(connection, clusterName) {
    console.log(`\n📦 Criando coleções no ${clusterName}...`);
    
    if (!connection || !connection.db) {
      throw new Error('Conexão ou banco de dados não disponível');
    }
    
    const db = connection.db;
    const collections = await db.listCollections().toArray();
    const existingCollections = collections.map(col => col.name);

    const collectionsToCreate = [
      { name: 'users', model: User },
      { name: 'assinaturas', model: Assinatura },
      { name: 'musicas', model: Musica },
      { name: 'playlists', model: Playlist },
      { name: 'podcasts', model: Podcast }
    ];

    for (const collection of collectionsToCreate) {
      if (existingCollections.includes(collection.name)) {
        console.log(`   ⏭️  Coleção "${collection.name}" já existe`);
      } else {
        await db.createCollection(collection.name);
        console.log(`   ✨ Coleção "${collection.name}" criada`);
      }
    }
  }

  /**
   * Cria índices em um cluster
   */
  async createIndexes(connection, clusterName) {
    console.log(`\n📊 Criando índices no ${clusterName}...`);

    if (!connection || !connection.db) {
      throw new Error('Conexão ou banco de dados não disponível');
    }
    
    const db = connection.db;

    try {
      // Índices para usuários
      await db.collection('users').createIndex({ email: 1 }, { unique: true });
      await db.collection('users').createIndex({ nomeUsuario: 1 }, { unique: true });
      await db.collection('users').createIndex({ createdAt: -1 });
      await db.collection('users').createIndex({ 'account.subscription': 1 });
      console.log('   ✓ Índices de users criados');

      // Índices para podcasts
      await db.collection('podcasts').createIndex({ titulo: 'text', descricao: 'text' });
      await db.collection('podcasts').createIndex({ autor: 1 });
      await db.collection('podcasts').createIndex({ ano: -1 });
      await db.collection('podcasts').createIndex({ categoria: 1 });
      await db.collection('podcasts').createIndex({ tags: 1 });
      await db.collection('podcasts').createIndex({ 'stats.reproducoes': -1 });
      console.log('   ✓ Índices de podcasts criados');

      // Índices para músicas
      await db.collection('musicas').createIndex({ titulo: 'text', autor: 'text' });
      await db.collection('musicas').createIndex({ autor: 1 });
      await db.collection('musicas').createIndex({ ano: -1 });
      await db.collection('musicas').createIndex({ genero: 1 });
      await db.collection('musicas').createIndex({ album: 1 });
      await db.collection('musicas').createIndex({ 'stats.reproducoes': -1 });
      console.log('   ✓ Índices de musicas criados');

      // Índices para playlists
      await db.collection('playlists').createIndex({ nomePlaylist: 'text', descricao: 'text' });
      await db.collection('playlists').createIndex({ usuarioId: 1 });
      await db.collection('playlists').createIndex({ visibilidade: 1 });
      await db.collection('playlists').createIndex({ 'stats.seguidores': -1 });
      console.log('   ✓ Índices de playlists criados');

      // Índices para assinaturas
      await db.collection('assinaturas').createIndex({ usuarioId: 1 }, { unique: true });
      await db.collection('assinaturas').createIndex({ tipo: 1 });
      await db.collection('assinaturas').createIndex({ plano: 1 });
      await db.collection('assinaturas').createIndex({ status: 1 });
      console.log('   ✓ Índices de assinaturas criados');

    } catch (error) {
      // Ignorar erros de índices duplicados
      if (error.code !== 85 && error.code !== 86) {
        console.error(`   ❌ Erro ao criar índices:`, error.message);
      }
    }
  }

  /**
   * Cria dados iniciais (apenas no PRIMARY)
   */
  async createInitialData(connection, clusterName) {
    if (clusterName !== 'Cluster 1 (PRIMARY)') {
      return; // Só criar dados iniciais no PRIMARY
    }

    console.log(`\n🌱 Criando dados iniciais no ${clusterName}...`);

    try {
      if (!connection || !connection.db) {
        throw new Error('Conexão ou banco de dados não disponível');
      }
      
      const db = connection.db;
      
      const planos = [
        { 
          nome: 'Free', 
          codigo: 'free',
          descricao: 'Plano gratuito com funcionalidades básicas',
          mensal: 0,
          anual: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        { 
          nome: 'Premium', 
          codigo: 'premium',
          descricao: 'Plano premium com streaming ilimitado e sem anúncios',
          mensal: 19.90,
          anual: 199.90,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        { 
          nome: 'Pro', 
          codigo: 'pro',
          descricao: 'Plano profissional com todos os recursos',
          mensal: 39.90,
          anual: 399.90,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      for (const plano of planos) {
        await db.collection('planos').updateOne(
          { codigo: plano.codigo },
          { $setOnInsert: plano },
          { upsert: true }
        );
      }

      console.log('   ✅ Dados iniciais criados');
    } catch (error) {
      console.error('   ❌ Erro ao criar dados iniciais:', error.message);
    }
  }

  /**
   * Configura um cluster completo
   */
  async setupCluster(config) {
    const connection = await this.connectToCluster(config);
    
    if (!connection) {
      return false;
    }

    try {
      await this.createCollections(connection, config.name);
      await this.createIndexes(connection, config.name);
      await this.createInitialData(connection, config.name);
      
      await connection.close();
      return true;
    } catch (error) {
      console.error(`❌ Erro ao configurar ${config.name}:`, error.message);
      if (connection) {
        await connection.close();
      }
      return false;
    }
  }

  /**
   * Executa configuração completa em todos os clusters
   */
  async run() {
    console.log('🚀 Iniciando configuração de todos os clusters...\n');
    console.log('═══════════════════════════════════════════\n');

    const results = {};

    for (const config of this.clusterConfigs) {
      console.log(`\n${'='.repeat(50)}`);
      console.log(`Configurando: ${config.name}`);
      console.log('='.repeat(50));
      
      const success = await this.setupCluster(config);
      results[config.key] = success;
      
      // Pequeno delay entre clusters
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n═══════════════════════════════════════════\n');
    console.log('📊 RESUMO DA CONFIGURAÇÃO:\n');
    
    for (const config of this.clusterConfigs) {
      const status = results[config.key] ? '✅ Configurado' : '❌ Falhou';
      console.log(`   ${config.name}: ${status}`);
    }

    const successCount = Object.values(results).filter(r => r).length;
    console.log(`\n🎉 ${successCount}/${this.clusterConfigs.length} clusters configurados com sucesso!\n`);
    
    process.exit(0);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  const setup = new MultiClusterSetup();
  setup.run().catch(error => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  });
}

module.exports = MultiClusterSetup;

