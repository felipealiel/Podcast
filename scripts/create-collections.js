/**
 * Script para criar todas as coleções vazias no MongoDB
 * Isso garante que todas as coleções existam, mesmo sem documentos
 */

require('dotenv').config();
const mongoose = require('mongoose');

// Importar todos os modelos
const { User, Podcast, Musica, Playlist, Assinatura } = require('../src/models');

async function createCollections() {
  try {
    console.log('🔄 Conectando ao MongoDB...');
    
    // Conectar ao MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado ao MongoDB com sucesso!');

    // Obter o banco de dados
    const db = mongoose.connection.db;
    
    console.log('\n📦 Criando coleções...\n');

    // Listar coleções existentes
    const collections = await db.listCollections().toArray();
    const existingCollections = collections.map(col => col.name);

    // Definir as coleções que queremos criar
    const collectionsToCreate = [
      { name: 'users', model: User },
      { name: 'assinaturas', model: Assinatura },
      { name: 'musicas', model: Musica },
      { name: 'playlists', model: Playlist },
      { name: 'podcasts', model: Podcast }
    ];

    // Criar cada coleção
    for (const collection of collectionsToCreate) {
      if (existingCollections.includes(collection.name)) {
        console.log(`⏭️  Coleção "${collection.name}" já existe`);
      } else {
        await db.createCollection(collection.name);
        console.log(`✨ Coleção "${collection.name}" criada com sucesso`);
      }
    }

    console.log('\n🎉 Todas as coleções foram verificadas/criadas!');
    console.log('\n📋 Coleções disponíveis:');
    
    // Listar todas as coleções novamente
    const finalCollections = await db.listCollections().toArray();
    finalCollections.forEach((col, index) => {
      console.log(`   ${index + 1}. ${col.name}`);
    });

    console.log('\n✅ Processo concluído!');
    
  } catch (error) {
    console.error('❌ Erro ao criar coleções:', error);
    process.exit(1);
  } finally {
    // Fechar conexão
    await mongoose.connection.close();
    console.log('\n🔌 Conexão fechada');
    process.exit(0);
  }
}

// Executar o script
createCollections();

