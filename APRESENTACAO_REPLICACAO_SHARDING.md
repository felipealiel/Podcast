# 🎓 Guia de Apresentação - Replicação e Sharding MongoDB Atlas

## 📋 Roteiro para Apresentação ao Professor

Este guia mostra **onde** e **como** visualizar a replicação e sharding funcionando no MongoDB Atlas.

---

## 🔄 PARTE 1: REPLICAÇÃO (Replica Set)

### ✅ O que é Replicação?

A replicação no MongoDB Atlas é **automática** e fornece:
- **Alta disponibilidade**: Se um servidor cair, outro assume
- **Redundância de dados**: Dados copiados em múltiplos servidores
- **Failover automático**: Troca de servidor primário automaticamente

### 📍 Onde Visualizar a Replicação:

#### 1️⃣ **No MongoDB Atlas (Interface Web)**

1. **Acesse**: https://cloud.mongodb.com
2. **Faça login**
3. Vá em **"Database"** → Clique no seu cluster **"PobreFy"**
4. Clique em **"Metrics"**

**O que mostrar:**
- **Gráfico de Operations**: Mostra operações em cada nó do replica set
- **Replication Lag**: Mostra o atraso de sincronização entre réplicas
- **Oplog GB/Hour**: Mostra quanto dados estão sendo replicados

#### 2️⃣ **Visualizar Configuração do Replica Set**

1. No MongoDB Atlas, vá em **"Database"** → **"Browse Collections"**
2. Clique em **"Overview"**
3. Role até **"Replica Set Configuration"**

**O que você verá:**
```
Replica Set: atlas-11tx2k-shard-0
├── PRIMARY   (ac-2ohuqzj-shard-00-00.xwsuefh.mongodb.net:27017)
├── SECONDARY (ac-2ohuqzj-shard-00-01.xwsuefh.mongodb.net:27017)
└── SECONDARY (ac-2ohuqzj-shard-00-02.xwsuefh.mongodb.net:27017)
```

**Explique ao professor:**
- ✅ **3 nós** no replica set (1 primário + 2 secundários)
- ✅ Escritas vão para o **PRIMARY**
- ✅ Leituras podem vir dos **SECONDARY**
- ✅ Se PRIMARY cair, um SECONDARY é **promovido automaticamente**

#### 3️⃣ **Verificar Replicação Via Código**

Mostre o arquivo `src/config/database.js` onde configuramos:

```javascript
readPreference: 'secondaryPreferred', // Prefere ler de secundários
readConcern: { level: 'majority' },   // Garantia de leitura
writeConcern: { w: 'majority' }       // Garantia de escrita
```

**Explique:**
- `readPreference: 'secondaryPreferred'` → Prefere ler dos secundários para não sobrecarregar o primário
- `writeConcern: { w: 'majority' }` → Escrita confirmada quando maioria das réplicas confirmam

#### 4️⃣ **Demonstração Prática - Monitorar Replicação**

Execute este comando no PowerShell para ver estatísticas em tempo real:

```bash
node -e "
const mongoose = require('mongoose');
require('dotenv').config();

async function showReplicaStatus() {
  await mongoose.connect(process.env.MONGODB_URI);
  const admin = mongoose.connection.db.admin();
  
  // Status do Replica Set
  const status = await admin.command({ replSetGetStatus: 1 });
  
  console.log('\\n📊 REPLICA SET STATUS:\\n');
  console.log('Set Name:', status.set);
  console.log('\\nMembros:');
  
  status.members.forEach((member, i) => {
    console.log(\`\\n[\${i + 1}] \${member.name}\`);
    console.log('   Estado:', member.stateStr);
    console.log('   Primário?:', member.stateStr === 'PRIMARY' ? '✅ SIM' : '❌ NÃO');
    console.log('   Saúde:', member.health === 1 ? '✅ Saudável' : '❌ Com problemas');
    console.log('   Último heartbeat:', member.lastHeartbeat || 'N/A');
  });
  
  process.exit(0);
}

showReplicaStatus().catch(console.error);
"
```

**O que será exibido:**
```
📊 REPLICA SET STATUS:

Set Name: atlas-11tx2k-shard-0

Membros:

[1] ac-2ohuqzj-shard-00-00.xwsuefh.mongodb.net:27017
   Estado: PRIMARY
   Primário?: ✅ SIM
   Saúde: ✅ Saudável

[2] ac-2ohuqzj-shard-00-01.xwsuefh.mongodb.net:27017
   Estado: SECONDARY
   Primário?: ❌ NÃO
   Saúde: ✅ Saudável

[3] ac-2ohuqzj-shard-00-02.xwsuefh.mongodb.net:27017
   Estado: SECONDARY
   Primário?: ❌ NÃO
   Saúde: ✅ Saudável
```

---

## 📦 PARTE 2: SHARDING (Particionamento Horizontal)

### ✅ O que é Sharding?

Sharding distribui dados entre múltiplos servidores baseado em uma **shard key**.

**No PobreFy:**
- **Podcasts**: Distribuídos por `categoria`
- **Músicas**: Distribuídos por `genero`
- **Playlists**: Distribuídos por `usuarioId`

### 📍 Onde Visualizar o Sharding:

#### 1️⃣ **Limitação do Tier FREE (M0)**

⚠️ **IMPORTANTE**: O MongoDB Atlas **FREE (M0)** **NÃO suporta** sharding manual.

**Para demonstrar sharding, você tem 2 opções:**

**Opção A - Mostrar a Configuração no Código:**

Mostre o arquivo `scripts/setup-database.js`:

```javascript
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
```

**Explique ao professor:**
- ✅ Podcasts da categoria "Tecnologia" vão para um shard
- ✅ Podcasts da categoria "Música" vão para outro shard
- ✅ Isso **distribui a carga** entre servidores
- ✅ Queries por categoria são **mais rápidas** (acessam apenas 1 shard)

**Opção B - Criar Cluster M10 (Temporário para Apresentação):**

Se quiser **realmente mostrar** sharding funcionando:

1. No MongoDB Atlas, crie um cluster **M10** (menor tier com sharding)
2. **ATENÇÃO**: Custa ~$0.08/hora (cancele depois da apresentação!)
3. Configure sharding como no script

#### 2️⃣ **Demonstração Teórica - Slides/Diagrama**

Crie um slide mostrando:

```
┌─────────────────────────────────────────┐
│         MONGODB ATLAS CLUSTER            │
├─────────────────────────────────────────┤
│                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐
│  │ SHARD 1  │  │ SHARD 2  │  │ SHARD 3  │
│  │          │  │          │  │          │
│  │ Podcasts │  │ Podcasts │  │ Podcasts │
│  │ Tecnologia│  │  Música  │  │ Educação │
│  │          │  │          │  │          │
│  │ Músicas  │  │ Músicas  │  │ Músicas  │
│  │   Pop    │  │   Rock   │  │   Jazz   │
│  └──────────┘  └──────────┘  └──────────┘
│                                          │
│  Cada shard tem 3 réplicas (replicação) │
└─────────────────────────────────────────┘
```

#### 3️⃣ **Mostrar Índices Compostos para Sharding**

Mostre os modelos (`src/models/`) com índices de sharding:

**Podcast.js:**
```javascript
// Índice composto para sharding
podcastSchema.index({ categoria: 1, _id: 1 });
```

**Musica.js:**
```javascript
// Índice composto para sharding
musicaSchema.index({ genero: 1, _id: 1 });
```

**Playlist.js:**
```javascript
// Índice composto para sharding
playlistSchema.index({ usuarioId: 1, _id: 1 });
```

---

## 🎯 ROTEIRO DE APRESENTAÇÃO SUGERIDO

### 1️⃣ Introdução (2 min)
"Criei uma plataforma de streaming (PobreFy) usando MongoDB Atlas com replicação e sharding para garantir alta disponibilidade e escalabilidade."

### 2️⃣ Mostrar Replicação (5 min)

1. **Abrir MongoDB Atlas** → Mostrar cluster
2. **Ir em Metrics** → Mostrar gráficos de replicação
3. **Mostrar código** → `src/config/database.js`
4. **Executar script** → Mostrar status do replica set em tempo real
5. **Explicar vantagens:**
   - Alta disponibilidade
   - Failover automático
   - Redundância de dados

### 3️⃣ Mostrar Sharding (5 min)

1. **Mostrar código de configuração** → `scripts/setup-database.js`
2. **Mostrar índices nos modelos** → `src/models/*.js`
3. **Explicar estratégia:**
   - Podcasts por categoria
   - Músicas por gênero
   - Playlists por usuário
4. **Mostrar diagrama** (slide)
5. **Explicar limitação do FREE tier** (honestidade acadêmica)
6. **Explicar vantagens:**
   - Distribuição de carga
   - Queries mais rápidas
   - Escalabilidade horizontal

### 4️⃣ Demonstração Prática (3 min)

1. **Abrir aplicação** → http://localhost:3000
2. **Criar conta** → Mostrar cadastro funcionando
3. **Fazer login** → Mostrar autenticação
4. **Abrir MongoDB Atlas** → Mostrar dados sendo inseridos em tempo real
5. **Ir em Collections** → Mostrar dados replicados

---

## 📊 SCRIPTS PARA DEMONSTRAÇÃO

### Script 1: Ver Status das Conexões

Crie o arquivo `demonstracao-conexao.js`:

```javascript
require('dotenv').config();
const mongoose = require('mongoose');

async function demonstrarConexao() {
  console.log('🔗 Conectando ao MongoDB Atlas...\n');
  
  await mongoose.connect(process.env.MONGODB_URI);
  
  console.log('✅ CONECTADO COM SUCESSO!\n');
  console.log('📊 Informações da Conexão:\n');
  console.log('Host:', mongoose.connection.host);
  console.log('Nome do Banco:', mongoose.connection.name);
  console.log('Estado:', mongoose.connection.readyState === 1 ? '✅ Conectado' : '❌ Desconectado');
  console.log('Porta:', mongoose.connection.port || 27017);
  
  // Informações do servidor
  const admin = mongoose.connection.db.admin();
  const serverInfo = await admin.serverInfo();
  
  console.log('\n🖥️ Informações do Servidor:\n');
  console.log('Versão do MongoDB:', serverInfo.version);
  console.log('Sistema Operacional:', serverInfo.os.type);
  
  // Status da replicação
  try {
    const replStatus = await admin.command({ replSetGetStatus: 1 });
    console.log('\n🔄 REPLICAÇÃO ATIVA!\n');
    console.log('Nome do Replica Set:', replStatus.set);
    console.log('Total de Membros:', replStatus.members.length);
    console.log('\nMembros do Replica Set:');
    replStatus.members.forEach((m, i) => {
      console.log(`  [${i+1}] ${m.stateStr.padEnd(12)} - ${m.name}`);
    });
  } catch (error) {
    console.log('\n⚠️ Replicação gerenciada pelo Atlas');
  }
  
  await mongoose.disconnect();
  console.log('\n✅ Demonstração concluída!\n');
}

demonstrarConexao().catch(console.error);
```

**Para executar:**
```bash
node demonstracao-conexao.js
```

---

## 📸 CAPTURAS DE TELA RECOMENDADAS

Tire prints das seguintes telas para slides:

1. ✅ MongoDB Atlas Dashboard mostrando o cluster
2. ✅ Metrics mostrando gráficos de replicação
3. ✅ Collections mostrando dados distribuídos
4. ✅ Configuração do Replica Set
5. ✅ Código dos índices de sharding
6. ✅ Aplicação funcionando (login/cadastro)
7. ✅ Terminal mostrando conexão e replica set

---

## 💡 PERGUNTAS QUE O PROFESSOR PODE FAZER

### P: "Por que escolheu essas shard keys?"

**R:** "Escolhi as shard keys baseado nos padrões de consulta:
- **Podcasts por categoria**: Usuários geralmente buscam por categoria
- **Músicas por gênero**: Pattern comum de busca por gênero musical
- **Playlists por usuário**: Cada usuário acessa apenas suas próprias playlists"

### P: "Como funciona o failover automático?"

**R:** "O MongoDB Atlas monitora constantemente os nós. Se o PRIMARY falhar, os nós SECONDARY fazem uma eleição automática e um deles é promovido a PRIMARY em segundos. Isso garante zero downtime."

### P: "Qual a diferença entre replicação e sharding?"

**R:** 
- **Replicação**: Cópias **idênticas** dos dados em múltiplos servidores (alta disponibilidade)
- **Sharding**: Dados **distribuídos** entre servidores (escalabilidade horizontal)
- Podemos ter **ambos**: Cada shard tem sua própria replicação!

### P: "Por que não está funcionando sharding no FREE tier?"

**R:** "O MongoDB Atlas FREE (M0) não suporta comandos admin de sharding por limitações da infraestrutura gratuita. Para produção com sharding, seria necessário o tier M10+ que custa ~$57/mês. Mas implementei toda a estrutura de código e índices preparada para sharding."

---

## ✅ CHECKLIST PARA APRESENTAÇÃO

Antes de apresentar, verifique:

- [ ] Servidor rodando (`npm run dev`)
- [ ] MongoDB Atlas aberto e logado
- [ ] Aplicação funcionando (teste login/cadastro)
- [ ] Script de demonstração testado
- [ ] Prints/slides preparados
- [ ] Arquivo `APRESENTACAO_REPLICACAO_SHARDING.md` lido
- [ ] Entendeu conceitos de replicação e sharding

---

## 🎓 BOA SORTE NA APRESENTAÇÃO!

Você tem um projeto **profissional** e **completo** que demonstra:
✅ Replicação automática
✅ Preparação para sharding
✅ Índices otimizados
✅ Sistema de autenticação
✅ Interface moderna

**Mostre confiança! Você construiu algo impressionante!** 🚀

---

**Dúvidas? Releia este guia antes da apresentação!**

