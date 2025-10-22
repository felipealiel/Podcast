const mongoose = require('mongoose');
const databaseManager = require('../src/config/database');
require('dotenv').config();

/**
 * Script para configurar o banco de dados e criar as coleções com sharding
 */
class DatabaseSetup {
  constructor() {
    this.db = null;
  }

  async connect() {
    try {
      await databaseManager.connectMain();
      this.db = databaseManager.getMainConnection().connection.db;
      console.log('🔗 Conectado ao banco de dados');
    } catch (error) {
      console.error('❌ Erro ao conectar:', error);
      process.exit(1);
    }
  }

  /**
   * Cria índices para otimização de consultas
   */
  async createIndexes() {
    console.log('📊 Criando índices...');

    try {
      // Índices para usuários
      await this.db.collection('users').createIndex({ email: 1 }, { unique: true });
      await this.db.collection('users').createIndex({ nomeUsuario: 1 }, { unique: true });
      await this.db.collection('users').createIndex({ createdAt: -1 });
      await this.db.collection('users').createIndex({ 'account.subscription': 1 });

      // Índices para podcasts
      await this.db.collection('podcasts').createIndex({ titulo: 'text', descricao: 'text' });
      await this.db.collection('podcasts').createIndex({ autor: 1 });
      await this.db.collection('podcasts').createIndex({ ano: -1 });
      await this.db.collection('podcasts').createIndex({ categoria: 1 });
      await this.db.collection('podcasts').createIndex({ tags: 1 });
      await this.db.collection('podcasts').createIndex({ 'avaliacoes.media': -1 });
      await this.db.collection('podcasts').createIndex({ 'stats.reproducoes': -1 });
      await this.db.collection('podcasts').createIndex({ status: 1 });

      // Índices para músicas
      await this.db.collection('musicas').createIndex({ titulo: 'text', autor: 'text' });
      await this.db.collection('musicas').createIndex({ autor: 1 });
      await this.db.collection('musicas').createIndex({ ano: -1 });
      await this.db.collection('musicas').createIndex({ genero: 1 });
      await this.db.collection('musicas').createIndex({ album: 1 });
      await this.db.collection('musicas').createIndex({ tags: 1 });
      await this.db.collection('musicas').createIndex({ 'stats.reproducoes': -1 });
      await this.db.collection('musicas').createIndex({ 'stats.favoritos': -1 });
      await this.db.collection('musicas').createIndex({ status: 1 });

      // Índices para playlists
      await this.db.collection('playlists').createIndex({ nomePlaylist: 'text', descricao: 'text' });
      await this.db.collection('playlists').createIndex({ usuarioId: 1 });
      await this.db.collection('playlists').createIndex({ visibilidade: 1 });
      await this.db.collection('playlists').createIndex({ 'stats.seguidores': -1 });
      await this.db.collection('playlists').createIndex({ tags: 1 });
      await this.db.collection('playlists').createIndex({ createdAt: -1 });

      // Índices para assinaturas
      await this.db.collection('assinaturas').createIndex({ usuarioId: 1 }, { unique: true });
      await this.db.collection('assinaturas').createIndex({ tipo: 1 });
      await this.db.collection('assinaturas').createIndex({ plano: 1 });
      await this.db.collection('assinaturas').createIndex({ status: 1 });
      await this.db.collection('assinaturas').createIndex({ dataFim: 1 });

      console.log('✅ Índices criados com sucesso');
    } catch (error) {
      console.error('❌ Erro ao criar índices:', error);
    }
  }

  /**
   * Configura sharding para coleções específicas
   */
  async setupSharding() {
    console.log('🔀 Configurando sharding...');

    try {
      // Habilitar sharding no banco
      await this.db.admin().command({ enableSharding: 'pobrefy_streaming' });

      // Configurar sharding para podcasts (por categoria)
      await this.db.admin().command({
        shardCollection: 'pobrefy_streaming.podcasts',
        key: { categoria: 1, _id: 1 }
      });

      // Configurar sharding para músicas (por gênero)
      await this.db.admin().command({
        shardCollection: 'pobrefy_streaming.musicas',
        key: { genero: 1, _id: 1 }
      });

      // Configurar sharding para playlists (por usuarioId)
      await this.db.admin().command({
        shardCollection: 'pobrefy_streaming.playlists',
        key: { usuarioId: 1, _id: 1 }
      });

      console.log('✅ Sharding configurado com sucesso');
    } catch (error) {
      console.error('❌ Erro ao configurar sharding:', error);
    }
  }

  /**
   * Cria dados iniciais (planos de assinatura)
   */
  async createInitialData() {
    console.log('🌱 Criando dados iniciais...');

    try {
      // Criar planos de assinatura padrão
      const planos = [
        { 
          nome: 'Free', 
          codigo: 'free',
          descricao: 'Plano gratuito com funcionalidades básicas',
          mensal: 0,
          anual: 0
        },
        { 
          nome: 'Premium', 
          codigo: 'premium',
          descricao: 'Plano premium com streaming ilimitado e sem anúncios',
          mensal: 19.90,
          anual: 199.90
        },
        { 
          nome: 'Pro', 
          codigo: 'pro',
          descricao: 'Plano profissional com todos os recursos',
          mensal: 39.90,
          anual: 399.90
        }
      ];

      for (const plano of planos) {
        await this.db.collection('planos').updateOne(
          { codigo: plano.codigo },
          { $setOnInsert: { ...plano, createdAt: new Date(), updatedAt: new Date() } },
          { upsert: true }
        );
      }

      console.log('✅ Dados iniciais criados com sucesso');
    } catch (error) {
      console.error('❌ Erro ao criar dados iniciais:', error);
    }
  }

  /**
   * Executa todo o setup do banco
   */
  async run() {
    console.log('🚀 Iniciando configuração do banco de dados...');
    
    await this.connect();
    await this.createIndexes();
    await this.setupSharding();
    await this.createInitialData();
    
    console.log('🎉 Configuração do banco concluída!');
    process.exit(0);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  const setup = new DatabaseSetup();
  setup.run().catch(error => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  });
}

module.exports = DatabaseSetup;
