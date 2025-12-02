/**
 * Script para promover usuários a produtores
 * Uso: node scripts/promover-produtor.js <email_ou_username>
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');

async function promoverProdutor(emailOuUsername) {
  try {
    // Conectar ao MongoDB (usando o primeiro cluster disponível)
    const uri = process.env.MONGODB_CLUSTER_1_URI || 
                process.env.MONGODB_CLUSTER_2_URI || 
                process.env.MONGODB_CLUSTER_3_URI ||
                process.env.MONGODB_URI;

    if (!uri) {
      console.error('❌ Erro: Nenhuma URI do MongoDB encontrada no .env');
      process.exit(1);
    }

    await mongoose.connect(uri);
    console.log('✅ Conectado ao MongoDB\n');

    // Buscar usuário por email ou nome de usuário
    const user = await User.findOne({
      $or: [
        { email: emailOuUsername },
        { nomeUsuario: emailOuUsername }
      ]
    });

    if (!user) {
      console.error(`❌ Usuário não encontrado: ${emailOuUsername}`);
      await mongoose.disconnect();
      process.exit(1);
    }

    console.log(`📋 Usuário encontrado:`);
    console.log(`   - Nome: ${user.nomeUsuario}`);
    console.log(`   - Email: ${user.email}`);
    console.log(`   - Role atual: ${user.account?.role || 'user'}\n`);

    // Promover a produtor
    user.account.role = 'producer';
    await user.save();

    console.log(`✅ Usuário promovido a PRODUTOR com sucesso!\n`);
    console.log(`📝 Agora você pode:`);
    console.log(`   1. Fazer login novamente`);
    console.log(`   2. Escolher "Produtor" na tela de login`);
    console.log(`   3. Acessar a área do produtor\n`);

    // Se houver outros clusters, atualizar também
    if (process.env.MONGODB_CLUSTER_2_URI) {
      try {
        const conn2 = mongoose.createConnection(process.env.MONGODB_CLUSTER_2_URI);
        await conn2.db.collection('users').updateOne(
          { email: user.email },
          { $set: { 'account.role': 'producer' } }
        );
        await conn2.close();
        console.log('✅ Atualizado no Cluster 2');
      } catch (error) {
        console.log('⚠️  Não foi possível atualizar no Cluster 2:', error.message);
      }
    }

    if (process.env.MONGODB_CLUSTER_3_URI) {
      try {
        const conn3 = mongoose.createConnection(process.env.MONGODB_CLUSTER_3_URI);
        await conn3.db.collection('users').updateOne(
          { email: user.email },
          { $set: { 'account.role': 'producer' } }
        );
        await conn3.close();
        console.log('✅ Atualizado no Cluster 3');
      } catch (error) {
        console.log('⚠️  Não foi possível atualizar no Cluster 3:', error.message);
      }
    }

    await mongoose.disconnect();
    console.log('\n✅ Concluído!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error.message);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Verificar argumentos
const emailOuUsername = process.argv[2];

if (!emailOuUsername) {
  console.log('📋 Script para promover usuários a produtores\n');
  console.log('Uso: node scripts/promover-produtor.js <email_ou_username>\n');
  console.log('Exemplos:');
  console.log('  node scripts/promover-produtor.js joao@email.com');
  console.log('  node scripts/promover-produtor.js joaogsmaciel\n');
  process.exit(1);
}

promoverProdutor(emailOuUsername);

