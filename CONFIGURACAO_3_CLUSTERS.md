# 🔄 Configuração de 3 Clusters com Replicação Distribuída

## 📋 Visão Geral

O sistema agora está configurado para usar **3 clusters MongoDB** como shards, onde:
- Cada cluster contém **todas as coleções** do banco
- Quando um dado é cadastrado, ele é **replicado automaticamente nos 3 clusters**
- O sistema gerencia **PRIMARY/SECONDARY** automaticamente
- Há **eleição automática** quando o PRIMARY cai

## ⚙️ Configuração Inicial

### 1. Atualizar arquivo `.env`

Adicione as seguintes variáveis ao seu arquivo `.env`:

```env
# MongoDB Atlas Configuration - 3 Clusters (Shards com Replicação)
# Cluster 1 - PRIMARY (por padrão)
MONGODB_CLUSTER_1_URI=mongodb+srv://joaogsmaciel:EcIhF93g6zs6h67U@cluster0.un8y19u.mongodb.net/pobrefy_streaming?retryWrites=true&w=majority&appName=Cluster0

# Cluster 2 - SECONDARY
MONGODB_CLUSTER_2_URI=mongodb+srv://joaomaciel_db_user:XWd12ri2FJHwgqdL@pobrefy.ttjcgkr.mongodb.net/pobrefy_streaming?retryWrites=true&w=majority&appName=PobreFY

# Cluster 3 - SECONDARY
MONGODB_CLUSTER_3_URI=mongodb+srv://joaogsmaciel:SSlNbDxccMKoPooR@cluster0.xvozz4d.mongodb.net/pobrefy_streaming?retryWrites=true&w=majority&appName=Cluster0

# Mantido para compatibilidade (aponta para Cluster 1)
MONGODB_URI=mongodb+srv://joaogsmaciel:EcIhF93g6zs6h67U@cluster0.un8y19u.mongodb.net/pobrefy_streaming?retryWrites=true&w=majority&appName=Cluster0
```

### 2. Configurar todos os clusters

Execute o script para criar coleções e índices em todos os 3 clusters:

```bash
node scripts/setup-all-clusters.js
```

Este script irá:
- ✅ Conectar aos 3 clusters
- ✅ Criar todas as coleções em cada cluster
- ✅ Criar todos os índices em cada cluster
- ✅ Criar dados iniciais (planos) apenas no PRIMARY

## 🏗️ Arquitetura

### Sistema de Conexão

```
┌─────────────────────────────────────────┐
│         DatabaseManager                  │
├─────────────────────────────────────────┤
│  Cluster 1 (PRIMARY)                     │
│  - Recebe escritas                        │
│  - Serve leituras preferenciais          │
├─────────────────────────────────────────┤
│  Cluster 2 (SECONDARY)                   │
│  - Replica dados do PRIMARY              │
│  - Pode ser promovido a PRIMARY          │
├─────────────────────────────────────────┤
│  Cluster 3 (SECONDARY)                   │
│  - Replica dados do PRIMARY              │
│  - Pode ser promovido a PRIMARY          │
└─────────────────────────────────────────┘
```

### Fluxo de Escrita

1. **Escrita no PRIMARY**: Dados são salvos primeiro no cluster PRIMARY
2. **Replicação Automática**: Sistema replica automaticamente nos outros 2 clusters
3. **Tolerância a Falhas**: Se um cluster falhar, a escrita continua nos outros

### Fluxo de Leitura

1. **Leitura do PRIMARY**: Por padrão, lê do cluster PRIMARY
2. **Fallback Automático**: Se PRIMARY está offline, lê automaticamente de um SECONDARY
3. **Eleição Automática**: Se PRIMARY cai, um SECONDARY é automaticamente promovido

## 🔧 Como Funciona

### Escrita em Múltiplos Clusters

Quando você cria um novo usuário:

```javascript
const user = new User({ ... });
await user.save(); // Salva no PRIMARY

// Replicação automática
await databaseManager.writeToAllClusters('users', 'insertOne', userData);
// ✅ Dados replicados em Cluster 1, 2 e 3
```

### Eleição de PRIMARY

O sistema verifica a saúde dos clusters a cada 30 segundos:

1. Se o PRIMARY atual cai
2. O sistema detecta automaticamente
3. Elege o próximo cluster disponível como novo PRIMARY
4. Atualiza os roles (PRIMARY → SECONDARY, SECONDARY → PRIMARY)

## 📊 Monitoramento

### Verificar Status dos Clusters

Acesse o endpoint de health check:

```bash
GET http://localhost:3000/health
```

Resposta:

```json
{
  "status": "ok",
  "database": {
    "primary": "cluster1",
    "clusters": {
      "cluster1": {
        "status": "connected",
        "role": "PRIMARY"
      },
      "cluster2": {
        "status": "connected",
        "role": "SECONDARY"
      },
      "cluster3": {
        "status": "connected",
        "role": "SECONDARY"
      }
    }
  }
}
```

## ⚠️ Importante

### Consistência de Dados

- Cada cluster pode ter IDs diferentes para o mesmo documento
- Use campos únicos (email, nomeUsuario) para identificar documentos entre clusters
- O sistema garante que dados são escritos em pelo menos 1 cluster (tolerância a falhas)

### Performance

- Escritas podem ser mais lentas (aguarda replicação em 3 clusters)
- Leituras são otimizadas (lê apenas do PRIMARY ou do primeiro SECONDARY disponível)
- Sistema continua funcionando mesmo se 1 ou 2 clusters estiverem offline

## 🔍 Troubleshooting

### Cluster não conecta

1. Verifique a string de conexão no `.env`
2. Verifique se o IP está liberado no MongoDB Atlas
3. Verifique credenciais de usuário

### Dados não replicam

1. Verifique logs do servidor para erros
2. Verifique se todos os clusters estão conectados
3. Dados no PRIMARY sempre serão salvos, mesmo se replicação falhar

### PRIMARY não elege novo cluster

1. Verifique se pelo menos um SECONDARY está online
2. Sistema faz verificação a cada 30 segundos
3. Verifique logs para mensagens de eleição

## 🚀 Próximos Passos

1. ✅ Atualizar `.env` com as 3 URIs
2. ✅ Executar `node scripts/setup-all-clusters.js`
3. ✅ Iniciar servidor: `npm start`
4. ✅ Testar criação de usuário e verificar replicação
5. ✅ Monitorar health check endpoint

---

**Nota**: Esta arquitetura implementa replicação distribuída manual entre clusters separados. Cada cluster funciona como um shard completo com todas as coleções.

