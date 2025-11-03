/**
 * Script para simular e monitorar falha do servidor principal MongoDB
 * Demonstra a alta disponibilidade e failover automático
 */

require('dotenv').config();
const mongoose = require('mongoose');

// Configuração de conexão com timeout reduzido para detectar falhas mais rapidamente
const connectionOptions = {
  serverSelectionTimeoutMS: 5000, // 5 segundos
  connectTimeoutMS: 10000,        // 10 segundos
  socketTimeoutMS: 45000,         // 45 segundos
  maxPoolSize: 10,
  minPoolSize: 1,
  maxIdleTimeMS: 30000,
  bufferMaxEntries: 0,
  useNewUrlParser: true,
  useUnifiedTopology: true
};

let isConnected = false;
let connectionAttempts = 0;
let lastServerInfo = null;

async function connectToDatabase() {
  try {
    console.log('🔄 Tentando conectar ao MongoDB Atlas...');
    connectionAttempts++;
    
    await mongoose.connect(process.env.MONGODB_URI, connectionOptions);
    
    if (!isConnected) {
      console.log('✅ CONECTADO COM SUCESSO!');
      isConnected = true;
      connectionAttempts = 0;
      
      // Obter informações do servidor
      await getServerInfo();
    }
    
    return true;
  } catch (error) {
    if (isConnected) {
      console.log('❌ FALHA DETECTADA! Servidor principal caiu!');
      console.log('🔄 Tentando reconectar...');
      isConnected = false;
    }
    
    console.log(`⚠️  Erro de conexão (tentativa ${connectionAttempts}):`, error.message);
    return false;
  }
}

async function getServerInfo() {
  try {
    const admin = mongoose.connection.db.admin();
    const serverStatus = await admin.serverStatus();
    const replicaSetStatus = await admin.replSetGetStatus();
    
    const currentServer = replicaSetStatus.members.find(member => 
      member.self === true
    );
    
    if (currentServer) {
      const serverInfo = {
        name: currentServer.name,
        state: currentServer.state,
        stateStr: currentServer.stateStr,
        uptime: currentServer.uptime,
        lastHeartbeat: currentServer.lastHeartbeat
      };
      
      if (!lastServerInfo || lastServerInfo.name !== serverInfo.name) {
        console.log('\n📊 INFORMAÇÕES DO SERVIDOR ATUAL:');
        console.log('═══════════════════════════════════════════');
        console.log(`🖥️  Servidor: ${serverInfo.name}`);
        console.log(`📊 Estado: ${serverInfo.stateStr} (${serverInfo.state})`);
        console.log(`⏱️  Uptime: ${Math.floor(serverInfo.uptime / 60)} minutos`);
        console.log(`💓 Último Heartbeat: ${new Date(serverInfo.lastHeartbeat).toLocaleString('pt-BR')}`);
        
        if (serverInfo.stateStr === 'PRIMARY') {
          console.log('👑 ESTE É O SERVIDOR PRINCIPAL (PRIMARY)');
        } else if (serverInfo.stateStr === 'SECONDARY') {
          console.log('🔄 ESTE É UM SERVIDOR SECUNDÁRIO (SECONDARY)');
          console.log('🎯 PROMOÇÃO AUTOMÁTICA DETECTADA!');
        }
        
        console.log('═══════════════════════════════════════════\n');
        
        lastServerInfo = serverInfo;
      }
    }
  } catch (error) {
    console.log('⚠️  Erro ao obter informações do servidor:', error.message);
  }
}

async function testDatabaseOperation() {
  try {
    // Teste simples de operação no banco
    const result = await mongoose.connection.db.admin().ping();
    return result.ok === 1;
  } catch (error) {
    return false;
  }
}

async function monitorConnection() {
  console.log('🎭 SIMULAÇÃO DE FALHA - MONGODB ATLAS');
  console.log('═══════════════════════════════════════════');
  console.log('📋 INSTRUÇÕES PARA A APRESENTAÇÃO:');
  console.log('1. Deixe este script rodando');
  console.log('2. No MongoDB Atlas Dashboard:');
  console.log('   - Vá para seu cluster');
  console.log('   - Clique nos 3 pontos → "Pause Cluster"');
  console.log('   - Ou "Restart Cluster"');
  console.log('3. Observe a detecção automática da falha');
  console.log('4. Veja a promoção do servidor secundário');
  console.log('═══════════════════════════════════════════\n');
  
  // Conectar inicialmente
  await connectToDatabase();
  
  // Monitorar conexão a cada 3 segundos
  setInterval(async () => {
    if (!isConnected) {
      await connectToDatabase();
    } else {
      // Testar operação no banco
      const isWorking = await testDatabaseOperation();
      if (!isWorking) {
        console.log('❌ Operação no banco falhou - possível falha detectada');
        isConnected = false;
      }
    }
  }, 3000);
  
  // Mostrar status a cada 10 segundos
  setInterval(async () => {
    if (isConnected) {
      console.log(`✅ Status: Conectado (${new Date().toLocaleTimeString('pt-BR')})`);
      await getServerInfo();
    } else {
      console.log(`❌ Status: Desconectado (${new Date().toLocaleTimeString('pt-BR')})`);
    }
  }, 10000);
}

// Tratamento de sinais para encerramento limpo
process.on('SIGINT', async () => {
  console.log('\n🛑 Encerrando monitoramento...');
  await mongoose.connection.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Encerrando monitoramento...');
  await mongoose.connection.close();
  process.exit(0);
});

// Iniciar monitoramento
monitorConnection().catch(console.error);
