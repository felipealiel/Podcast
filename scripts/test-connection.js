/**
 * Script para testar conexão com cada cluster individualmente
 * Ajuda a diagnosticar problemas de conexão
 */

require('dotenv').config();
const mongoose = require('mongoose');

const clusters = [
  {
    name: 'Cluster 1 (PRIMARY)',
    uri: process.env.MONGODB_CLUSTER_1_URI,
    key: 'cluster1'
  },
  {
    name: 'Cluster 2 (SECONDARY)',
    uri: process.env.MONGODB_CLUSTER_2_URI,
    key: 'cluster2'
  },
  {
    name: 'Cluster 3 (SECONDARY)',
    uri: process.env.MONGODB_CLUSTER_3_URI,
    key: 'cluster3'
  }
];

async function testConnection(cluster) {
  console.log(`\n🔍 Testando conexão com ${cluster.name}...`);
  console.log(`   URI: ${cluster.uri ? cluster.uri.replace(/mongodb\+srv:\/\/([^:]+):([^@]+)@/, 'mongodb+srv://$1:***@') : 'NÃO CONFIGURADA'}`);
  
  if (!cluster.uri || cluster.uri.trim() === '') {
    console.log(`   ❌ URI não configurada (variável MONGODB_${cluster.key.toUpperCase()}_URI)`);
    return false;
  }

  const connectionOptions = {
    maxPoolSize: 5,
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 10000,
    retryWrites: true,
    w: 'majority'
  };

  try {
    const connection = await mongoose.createConnection(cluster.uri, connectionOptions);
    
    // Aguardar conexão estar pronta
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout ao conectar (10 segundos)'));
      }, 10000);
      
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

    // Testar ping
    await connection.db.admin().ping();
    
    console.log(`   ✅ Conexão bem-sucedida!`);
    console.log(`   📊 Status: ${connection.readyState === 1 ? 'Conectado' : 'Desconectado'}`);
    console.log(`   🗄️  Database: ${connection.db ? connection.db.databaseName : 'N/A'}`);
    
    // Fechar conexão
    await connection.close();
    return true;
  } catch (error) {
    console.log(`   ❌ Erro na conexão:`);
    console.log(`      ${error.message}`);
    
    // Dicas baseadas no erro
    if (error.message.includes('IP') || error.message.includes('whitelist')) {
      console.log(`   💡 Dica: Verifique Network Access no MongoDB Atlas`);
      console.log(`      - Adicione 0.0.0.0/0 para permitir todos os IPs`);
      console.log(`      - Pode levar alguns minutos para aplicar`);
    } else if (error.message.includes('authentication') || error.message.includes('credential')) {
      console.log(`   💡 Dica: Verifique usuário e senha na URI`);
    } else if (error.message.includes('timeout')) {
      console.log(`   💡 Dica: Verifique sua conexão de internet`);
      console.log(`      - Pode ser bloqueado por firewall`);
      console.log(`      - Verifique se o cluster está online no Atlas`);
    } else if (error.message.includes('ENOTFOUND') || error.message.includes('DNS')) {
      console.log(`   💡 Dica: Verifique se o hostname da URI está correto`);
    }
    
    return false;
  }
}

async function runTests() {
  console.log('🧪 Iniciando testes de conexão com clusters MongoDB...\n');
  console.log('=' .repeat(60));
  
  const results = [];
  
  for (const cluster of clusters) {
    const result = await testConnection(cluster);
    results.push({ cluster: cluster.name, success: result });
    
    // Aguardar um pouco entre testes
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 Resumo dos testes:\n');
  
  results.forEach(result => {
    const icon = result.success ? '✅' : '❌';
    console.log(`${icon} ${result.cluster}: ${result.success ? 'OK' : 'FALHOU'}`);
  });
  
  const successCount = results.filter(r => r.success).length;
  console.log(`\n🎯 Resultado: ${successCount}/${results.length} clusters conectados`);
  
  if (successCount === 0) {
    console.log('\n⚠️  Nenhum cluster conectado. Verifique:');
    console.log('   1. Network Access no MongoDB Atlas (0.0.0.0/0)');
    console.log('   2. Credenciais nas URIs');
    console.log('   3. Status dos clusters no Atlas Dashboard');
    console.log('   4. Conexão de internet/firewall');
    process.exit(1);
  } else if (successCount < results.length) {
    console.log('\n⚠️  Alguns clusters não conectaram, mas o sistema pode funcionar com os disponíveis');
    process.exit(0);
  } else {
    console.log('\n✅ Todos os clusters conectados com sucesso!');
    process.exit(0);
  }
}

// Executar testes
runTests().catch(error => {
  console.error('\n❌ Erro ao executar testes:', error);
  process.exit(1);
});

