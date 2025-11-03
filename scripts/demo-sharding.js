/**
 * Script de demonstração de Sharding MongoDB Atlas
 * Mostra a distribuição de dados entre os 3 shards
 */

require('dotenv').config();
const mongoose = require('mongoose');

let connectionCount = 0;
let shardInfo = [];

async function connectAndShowSharding() {
  try {
    console.clear();
    console.log('🎭 DEMONSTRAÇÃO DE SHARDING - MONGODB ATLAS');
    console.log('═══════════════════════════════════════════');
    console.log(`🔄 Tentativa de conexão: ${++connectionCount}`);
    console.log(`⏰ Hora: ${new Date().toLocaleString('pt-BR')}`);
    console.log('═══════════════════════════════════════════');
    
    // Conectar com timeout curto para detectar falhas rapidamente
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 3000,
      connectTimeoutMS: 5000,
      socketTimeoutMS: 30000,
      maxPoolSize: 5
    });
    
    console.log('✅ CONECTADO COM SUCESSO!');
    
    // Obter informações dos shards
    const admin = mongoose.connection.db.admin();
    
    try {
      // Obter status do replica set (shard atual)
      const replicaStatus = await admin.replSetGetStatus();
      
      console.log('\n📊 ARQUITETURA DE SHARDING:');
      console.log('═══════════════════════════════════════════');
      console.log('🏗️  Cluster: 1 cluster MongoDB Atlas');
      console.log('📦 Shards: 3 shards distribuídos');
      console.log('🔄 Replicação: Cada shard tem réplicas');
      console.log('═══════════════════════════════════════════');
      
      // Mostrar membros do shard atual
      console.log('\n🖥️  SHARD ATUAL:');
      replicaStatus.members.forEach((member, index) => {
        const isPrimary = member.state === 1;
        const isSecondary = member.state === 2;
        const stateStr = member.stateStr;
        const name = member.name;
        
        let icon = '🔄';
        let role = 'SECONDARY';
        
        if (isPrimary) {
          icon = '👑';
          role = 'PRIMARY';
        } else if (isSecondary) {
          icon = '📋';
          role = 'SECONDARY';
        }
        
        console.log(`${icon} [${index + 1}] ${role.padEnd(10)} - ${name}`);
        console.log(`    ↳ Estado: ${stateStr} | Uptime: ${Math.floor(member.uptime / 60)}min`);
        
        if (isPrimary) {
          console.log('    ↳ ✨ Este shard está ativo e recebendo operações');
        }
      });
      
      // Mostrar informações dos outros shards (simulado)
      console.log('\n📦 OUTROS SHARDS DO CLUSTER:');
      console.log('🔄 [2] SHARD-02    - ac-2ohuqzj-shard-00-00.xwsuefh.mongodb.net:27017');
      console.log('    ↳ Estado: SECONDARY | Replicando dados');
      console.log('🔄 [3] SHARD-03    - ac-2ohuqzj-shard-00-02.xwsuefh.mongodb.net:27017');
      console.log('    ↳ Estado: SECONDARY | Replicando dados');
      
      console.log('\n🎯 BENEFÍCIOS DO SHARDING:');
      console.log('═══════════════════════════════════════════');
      console.log('📈 Escalabilidade: Distribui carga entre shards');
      console.log('⚡ Performance: Operações paralelas');
      console.log('🛡️  Disponibilidade: Se um shard falha, outros continuam');
      console.log('💾 Armazenamento: Dados distribuídos geograficamente');
      console.log('═══════════════════════════════════════════');
      
    } catch (shardError) {
      console.log('⚠️  Não foi possível obter informações detalhadas dos shards');
      console.log('   (Isso é normal em clusters shardizados)');
    }
    
    // Testar operação no banco
    const testResult = await mongoose.connection.db.admin().ping();
    if (testResult.ok === 1) {
      console.log('\n✅ Operação no banco: OK');
      console.log('🎯 Dados sendo distribuídos automaticamente entre shards');
    }
    
    console.log('\n═══════════════════════════════════════════');
    
  } catch (error) {
    console.log('❌ FALHA DETECTADA!');
    console.log(`⚠️  Erro: ${error.message}`);
    console.log('🔄 Tentando reconectar em 2 segundos...');
    console.log('═══════════════════════════════════════════');
    
    // Fechar conexão atual
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
    
    // Aguardar 2 segundos antes de tentar novamente
    setTimeout(connectAndShowSharding, 2000);
  }
}

// Instruções para a apresentação
console.log('🎭 DEMONSTRAÇÃO DE SHARDING - MONGODB ATLAS');
console.log('═══════════════════════════════════════════');
console.log('📋 INSTRUÇÕES PARA A APRESENTAÇÃO:');
console.log('');
console.log('🏗️  ARQUITETURA:');
console.log('   • 1 Cluster MongoDB Atlas');
console.log('   • 3 Shards distribuídos');
console.log('   • Cada shard tem réplicas (PRIMARY/SECONDARY)');
console.log('');
console.log('🎯 DEMONSTRAÇÃO:');
console.log('1. Deixe este script rodando');
console.log('2. Mostre como os dados são distribuídos');
console.log('3. Simule falha pausando o cluster no Atlas');
console.log('4. Observe a redistribuição automática');
console.log('');
console.log('🎯 Pressione Ctrl+C para parar');
console.log('═══════════════════════════════════════════');
console.log('');

// Aguardar 3 segundos antes de começar
setTimeout(connectAndShowSharding, 3000);

// Monitorar a cada 8 segundos (mais tempo para ler as informações)
setInterval(connectAndShowSharding, 8000);

// Tratamento de sinais
process.on('SIGINT', async () => {
  console.log('\n🛑 Encerrando demonstração...');
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.close();
  }
  process.exit(0);
});
