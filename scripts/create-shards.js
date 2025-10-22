const mongoose = require('mongoose');
const databaseManager = require('../src/config/database');
require('dotenv').config();

/**
 * Script para configurar shards específicos e distribuir dados
 */
class ShardManager {
  constructor() {
    this.shardConnections = {};
  }

  async connectToShards() {
    console.log('🔗 Conectando aos shards...');
    
    try {
      await databaseManager.connectShards();
      this.shardConnections = databaseManager.shardConnections;
      console.log('✅ Conectado a todos os shards');
    } catch (error) {
      console.error('❌ Erro ao conectar aos shards:', error);
      throw error;
    }
  }

  /**
   * Configura replicação para cada shard
   */
  async setupReplication() {
    console.log('🔄 Configurando replicação...');

    try {
      for (const [shardName, connection] of Object.entries(this.shardConnections)) {
        console.log(`Configurando replicação para ${shardName}...`);
        
        // Configurar opções de replicação
        const replicationOptions = {
          replicaSet: `${shardName}_replica`,
          readPreference: 'secondaryPreferred',
          readConcern: { level: 'majority' },
          writeConcern: { w: 'majority', j: true }
        };

        // Aplicar configurações de replicação
        await connection.db.admin().command({
          replSetInitiate: {
            _id: `${shardName}_replica`,
            members: [
              { _id: 0, host: `${shardName}-primary:27017`, priority: 2 },
              { _id: 1, host: `${shardName}-secondary1:27017`, priority: 1 },
              { _id: 2, host: `${shardName}-secondary2:27017`, priority: 1, arbiterOnly: true }
            ]
          }
        });

        console.log(`✅ Replicação configurada para ${shardName}`);
      }
    } catch (error) {
      console.error('❌ Erro ao configurar replicação:', error);
    }
  }

  /**
   * Distribui dados existentes entre shards
   */
  async distributeData() {
    console.log('📊 Distribuindo dados entre shards...');

    try {
      // Conectar ao banco principal para obter dados
      await databaseManager.connectMain();
      const mainDb = databaseManager.getMainConnection();

      // Distribuir vídeos por categoria
      await this.distributeVideosByCategory(mainDb);
      
      // Distribuir comentários por videoId
      await this.distributeCommentsByVideo(mainDb);
      
      // Distribuir visualizações por videoId
      await this.distributeViewsByVideo(mainDb);

      console.log('✅ Dados distribuídos com sucesso');
    } catch (error) {
      console.error('❌ Erro ao distribuir dados:', error);
    }
  }

  /**
   * Distribui vídeos por categoria entre shards
   */
  async distributeVideosByCategory(mainDb) {
    console.log('📹 Distribuindo vídeos por categoria...');

    const categories = await mainDb.collection('categories').find({}).toArray();
    const shardNames = Object.keys(this.shardConnections);
    
    for (let i = 0; i < categories.length; i++) {
      const category = categories[i];
      const shardIndex = i % shardNames.length;
      const targetShard = shardNames[shardIndex];
      
      // Mover vídeos desta categoria para o shard específico
      const videos = await mainDb.collection('videos').find({ category: category.slug }).toArray();
      
      if (videos.length > 0) {
        await this.shardConnections[targetShard].collection('videos').insertMany(videos);
        console.log(`📹 ${videos.length} vídeos da categoria "${category.name}" movidos para ${targetShard}`);
      }
    }
  }

  /**
   * Distribui comentários por videoId
   */
  async distributeCommentsByVideo(mainDb) {
    console.log('💬 Distribuindo comentários por vídeo...');

    const videos = await mainDb.collection('videos').find({}).toArray();
    const shardNames = Object.keys(this.shardConnections);
    
    for (const video of videos) {
      const shardIndex = video._id.toString().charCodeAt(0) % shardNames.length;
      const targetShard = shardNames[shardIndex];
      
      const comments = await mainDb.collection('comments').find({ videoId: video._id }).toArray();
      
      if (comments.length > 0) {
        await this.shardConnections[targetShard].collection('comments').insertMany(comments);
        console.log(`💬 ${comments.length} comentários do vídeo "${video.title}" movidos para ${targetShard}`);
      }
    }
  }

  /**
   * Distribui visualizações por videoId
   */
  async distributeViewsByVideo(mainDb) {
    console.log('👀 Distribuindo visualizações por vídeo...');

    const videos = await mainDb.collection('videos').find({}).toArray();
    const shardNames = Object.keys(this.shardConnections);
    
    for (const video of videos) {
      const shardIndex = video._id.toString().charCodeAt(0) % shardNames.length;
      const targetShard = shardNames[shardIndex];
      
      const views = await mainDb.collection('views').find({ videoId: video._id }).toArray();
      
      if (views.length > 0) {
        await this.shardConnections[targetShard].collection('views').insertMany(views);
        console.log(`👀 ${views.length} visualizações do vídeo "${video.title}" movidas para ${targetShard}`);
      }
    }
  }

  /**
   * Configura balanceamento automático
   */
  async setupBalancing() {
    console.log('⚖️ Configurando balanceamento automático...');

    try {
      await databaseManager.connectMain();
      const mainDb = databaseManager.getMainConnection();

      // Habilitar balanceamento automático
      await mainDb.admin().command({ enableSharding: 'pobrefy_streaming' });
      await mainDb.admin().command({ balancerStart: 1 });

      // Configurar chunks para balanceamento
      await mainDb.admin().command({
        shardCollection: 'pobrefy_streaming.videos',
        key: { category: 1, _id: 1 },
        numInitialChunks: 64
      });

      console.log('✅ Balanceamento automático configurado');
    } catch (error) {
      console.error('❌ Erro ao configurar balanceamento:', error);
    }
  }

  /**
   * Monitora status dos shards
   */
  async monitorShards() {
    console.log('📊 Status dos shards:');
    
    try {
      await databaseManager.connectMain();
      const mainDb = databaseManager.getMainConnection();

      const shardStatus = await mainDb.admin().command({ listShards: 1 });
      console.log('Shards ativos:', shardStatus.shards);

      const balancerStatus = await mainDb.admin().command({ balancerStatus: 1 });
      console.log('Status do balanceador:', balancerStatus);

    } catch (error) {
      console.error('❌ Erro ao monitorar shards:', error);
    }
  }

  /**
   * Executa configuração completa dos shards
   */
  async run() {
    console.log('🚀 Iniciando configuração de shards...');
    
    try {
      await this.connectToShards();
      await this.setupReplication();
      await this.distributeData();
      await this.setupBalancing();
      await this.monitorShards();
      
      console.log('🎉 Configuração de shards concluída!');
    } catch (error) {
      console.error('❌ Erro na configuração de shards:', error);
      process.exit(1);
    }
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  const shardManager = new ShardManager();
  shardManager.run().catch(error => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  });
}

module.exports = ShardManager;
