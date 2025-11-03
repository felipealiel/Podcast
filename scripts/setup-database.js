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
      // Função auxiliar para criar índice com tratamento de erro
      const createIndexSafe = async (collection, index, options = {}) => {
        try {
          await this.db.collection(collection).createIndex(index, options);
          console.log(`   ✓ Índice criado em ${collection}: ${JSON.stringify(index)}`);
        } catch (error) {
          if (error.code === 85 || error.codeName === 'IndexOptionsConflict') {
            console.log(`   ⏭️  Índice já existe em ${collection}: ${JSON.stringify(index)}`);
          } else if (error.code === 86 || error.codeName === 'IndexKeySpecsConflict') {
            console.log(`   ⏭️  Índice equivalente já existe em ${collection}`);
          } else {
            console.error(`   ❌ Erro ao criar índice em ${collection}:`, error.message);
          }
        }
      };

      // Índices para usuários
      await createIndexSafe('users', { email: 1 }, { unique: true });
      await createIndexSafe('users', { nomeUsuario: 1 }, { unique: true });
      await createIndexSafe('users', { createdAt: -1 });
      await createIndexSafe('users', { 'account.subscription': 1 });

      // Índices para podcasts
      await createIndexSafe('podcasts', { titulo: 'text', descricao: 'text' });
      await createIndexSafe('podcasts', { autor: 1 });
      await createIndexSafe('podcasts', { ano: -1 });
      await createIndexSafe('podcasts', { categoria: 1 });
      await createIndexSafe('podcasts', { tags: 1 });
      await createIndexSafe('podcasts', { 'avaliacoes.media': -1 });
      await createIndexSafe('podcasts', { 'stats.reproducoes': -1 });
      await createIndexSafe('podcasts', { status: 1 });

      // Índices para músicas
      await createIndexSafe('musicas', { titulo: 'text', autor: 'text' });
      await createIndexSafe('musicas', { autor: 1 });
      await createIndexSafe('musicas', { ano: -1 });
      await createIndexSafe('musicas', { genero: 1 });
      await createIndexSafe('musicas', { album: 1 });
      await createIndexSafe('musicas', { tags: 1 });
      await createIndexSafe('musicas', { 'stats.reproducoes': -1 });
      await createIndexSafe('musicas', { 'stats.favoritos': -1 });
      await createIndexSafe('musicas', { status: 1 });

      // Índices para playlists
      await createIndexSafe('playlists', { nomePlaylist: 'text', descricao: 'text' });
      await createIndexSafe('playlists', { usuarioId: 1 });
      await createIndexSafe('playlists', { visibilidade: 1 });
      await createIndexSafe('playlists', { 'stats.seguidores': -1 });
      await createIndexSafe('playlists', { tags: 1 });
      await createIndexSafe('playlists', { createdAt: -1 });

      // Índices para assinaturas
      await createIndexSafe('assinaturas', { usuarioId: 1 }, { unique: true });
      await createIndexSafe('assinaturas', { tipo: 1 });
      await createIndexSafe('assinaturas', { plano: 1 });
      await createIndexSafe('assinaturas', { status: 1 });
      await createIndexSafe('assinaturas', { dataFim: 1 });

      console.log('✅ Índices verificados/criados com sucesso');
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
      if (error.code === 8000 || error.codeName === 'AtlasError') {
        console.log('⚠️  Sharding não disponível no MongoDB Atlas Free Tier');
        console.log('   Para habilitar sharding, você precisa de um cluster Atlas configurado especificamente para sharding');
        console.log('   Isso não afeta o funcionamento normal da aplicação');
      } else {
        console.error('❌ Erro ao configurar sharding:', error.message);
      }
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
