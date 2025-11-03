/**
 * Script de demonstração de failover do MongoDB Atlas
 * Para usar na apresentação - mostra a alta disponibilidade
 */

require('dotenv').config();
const mongoose = require('mongoose');

let connectionCount = 0;
let lastServer = null;

async function connectAndMonitor() {
  try {
    console.clear();
    console.log('🎭 DEMONSTRAÇÃO DE FALHA - MONGODB ATLAS');
    console.log('═══════════════════════════════════════════');
    console.log(`🔄 Tentativa de conexão: ${++connectionCount}`);
    console.log(`⏰ Hora: ${new Date().toLocaleString('pt-BR')}`);
    console.log('═══════════════════════════════════════════');
    
    // Conectar com timeout curto para detectar falhas rapidamente
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 3000,
      connectTimeoutMS: 5000,
      socketTimeoutMS: 30000,
      maxPoolSize: 5,
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('✅ CONECTADO COM SUCESSO!');
    
    // Obter informações do servidor atual
    const admin = mongoose.connection.db.admin();
    const replicaStatus = await admin.replSetGetStatus();
    
    const currentServer = replicaStatus.members.find(member => member.self === true);
    
    if (currentServer) {
      const serverName = currentServer.name;
      const serverState = currentServer.stateStr;
      
      console.log(`🖥️  Servidor Atual: ${serverName}`);
      console.log(`📊 Estado: ${serverState}`);
      
      if (serverState === 'PRIMARY') {
        console.log('👑 SERVIDOR PRINCIPAL ATIVO');
        if (lastServer && lastServer !== serverName) {
          console.log('🎯 FALHA DETECTADA E RECUPERADA!');
          console.log(`🔄 Servidor anterior: ${lastServer}`);
          console.log(`✨ Novo servidor: ${serverName}`);
        }
      } else if (serverState === 'SECONDARY') {
        console.log('🔄 SERVIDOR SECUNDÁRIO PROMOVIDO!');
        console.log('🎉 FAILOVER AUTOMÁTICO FUNCIONANDO!');
      }
      
      lastServer = serverName;
    }
    
    // Testar operação no banco
    const testResult = await mongoose.connection.db.admin().ping();
    if (testResult.ok === 1) {
      console.log('✅ Operação no banco: OK');
    }
    
    console.log('═══════════════════════════════════════════');
    
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
    setTimeout(connectAndMonitor, 2000);
  }
}

// Instruções para a apresentação
console.log('🎭 DEMONSTRAÇÃO DE FALHA - MONGODB ATLAS');
console.log('═══════════════════════════════════════════');
console.log('📋 INSTRUÇÕES PARA A APRESENTAÇÃO:');
console.log('');
console.log('1. Deixe este script rodando');
console.log('2. Abra o MongoDB Atlas Dashboard:');
console.log('   https://cloud.mongodb.com');
console.log('3. Vá para seu cluster "pobrefy-streaming"');
console.log('4. Clique nos 3 pontos → "Pause Cluster"');
console.log('5. Observe a detecção automática da falha');
console.log('6. Veja a promoção do servidor secundário');
console.log('7. Para reativar: "Resume Cluster"');
console.log('');
console.log('🎯 Pressione Ctrl+C para parar');
console.log('═══════════════════════════════════════════');
console.log('');

// Aguardar 3 segundos antes de começar
setTimeout(connectAndMonitor, 3000);

// Monitorar a cada 5 segundos
setInterval(connectAndMonitor, 5000);

// Tratamento de sinais
process.on('SIGINT', async () => {
  console.log('\n🛑 Encerrando demonstração...');
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.close();
  }
  process.exit(0);
});
