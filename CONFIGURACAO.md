# 📖 Guia de Configuração - PobreFy

Este guia fornece instruções detalhadas para configurar e executar a plataforma PobreFy.

## 📋 Índice

1. [Requisitos do Sistema](#requisitos-do-sistema)
2. [Configuração do MongoDB Atlas](#configuração-do-mongodb-atlas)
3. [Configuração do Projeto](#configuração-do-projeto)
4. [Configuração de Sharding](#configuração-de-sharding)
5. [Configuração de Replicação](#configuração-de-replicação)
6. [Variáveis de Ambiente](#variáveis-de-ambiente)
7. [Inicialização do Banco](#inicialização-do-banco)
8. [Troubleshooting](#troubleshooting)

## 🖥️ Requisitos do Sistema

### Software Necessário

- **Node.js**: v18.0.0 ou superior
- **npm**: v8.0.0 ou superior (incluído com Node.js)
- **MongoDB Atlas**: Conta gratuita ou paga
- **Git**: Para controle de versão

### Hardware Recomendado

- **CPU**: 2 cores ou mais
- **RAM**: 4GB mínimo, 8GB recomendado
- **Armazenamento**: 10GB disponível

## ☁️ Configuração do MongoDB Atlas

### Passo 1: Criar Conta

1. Acesse https://www.mongodb.com/cloud/atlas
2. Clique em "Try Free"
3. Complete o cadastro com seu email
4. Confirme seu email

### Passo 2: Criar Organização e Projeto

1. Após o login, crie uma nova organização
2. Dentro da organização, crie um novo projeto
3. Nome sugerido: "PobreFy"

### Passo 3: Criar Cluster

1. Clique em "Build a Database"
2. Escolha o plano:
   - **M0 (Free)**: Para desenvolvimento e testes
   - **M10+**: Para produção com sharding
3. Selecione o provedor de nuvem (AWS, Google Cloud, ou Azure)
4. Escolha a região mais próxima do Brasil (ex: São Paulo)
5. Nomeie o cluster: `pobrefy-cluster`
6. Clique em "Create Cluster"

> **Nota**: Sharding completo requer cluster M10 ou superior

### Passo 4: Configurar Segurança

#### 4.1 Criar Usuário do Banco

1. Vá para "Database Access"
2. Clique em "Add New Database User"
3. Configure:
   - **Username**: `pobrefy_user`
   - **Password**: Gere uma senha forte (anote!)
   - **Privileges**: Read and write to any database
4. Clique em "Add User"

#### 4.2 Configurar Network Access

1. Vá para "Network Access"
2. Clique em "Add IP Address"
3. Opções:
   - **Desenvolvimento**: Adicione seu IP atual
   - **Produção**: Configure IPs específicos
   - **Teste**: "Allow Access from Anywhere" (0.0.0.0/0) - **NÃO RECOMENDADO EM PRODUÇÃO**
4. Clique em "Confirm"

### Passo 5: Obter String de Conexão

1. Volte para "Database"
2. Clique em "Connect" no seu cluster
3. Escolha "Connect your application"
4. Driver: Node.js
5. Copie a string de conexão:
```
mongodb+srv://pobrefy_user:<password>@pobrefy-cluster.xxxxx.mongodb.net/?retryWrites=true&w=majority
```
6. Substitua `<password>` pela senha do usuário
7. Adicione o nome do banco: `pobrefy_streaming`

String final:
```
mongodb+srv://pobrefy_user:SuaSenha123@pobrefy-cluster.xxxxx.mongodb.net/pobrefy_streaming?retryWrites=true&w=majority
```

## 🔧 Configuração do Projeto

### Passo 1: Clonar/Criar Diretório

```bash
# Se ainda não criou, navegue até o diretório
cd "C:\Users\joaog\OneDrive\Área de Trabalho\PobreFy"
```

### Passo 2: Instalar Dependências

```bash
npm install
```

Este comando instalará:
- Express (servidor web)
- Mongoose (ODM MongoDB)
- bcryptjs (criptografia)
- jsonwebtoken (autenticação)
- E outras dependências...

### Passo 3: Configurar Variáveis de Ambiente

1. Copie o arquivo exemplo:
```bash
copy env.example .env
```

2. Abra o arquivo `.env` em um editor de texto

3. Configure as variáveis:

```env
# Servidor
NODE_ENV=development
PORT=3000
HOST=localhost

# MongoDB Atlas
MONGODB_URI=mongodb+srv://pobrefy_user:SuaSenha123@pobrefy-cluster.xxxxx.mongodb.net/pobrefy_streaming?retryWrites=true&w=majority

# Se tiver múltiplos clusters para sharding (opcional)
MONGODB_SHARD_URI_1=mongodb+srv://...
MONGODB_SHARD_URI_2=mongodb+srv://...
MONGODB_SHARD_URI_3=mongodb+srv://...

# JWT
JWT_SECRET=gere_uma_chave_secreta_super_segura_aqui_123456789
JWT_EXPIRES_IN=7d

# Redis (opcional, para cache)
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=

# Upload
MAX_FILE_SIZE=100MB
UPLOAD_PATH=./uploads
TEMP_PATH=./temp

# Streaming
STREAMING_BASE_URL=http://localhost:3000/stream
HLS_SEGMENT_DURATION=10
HLS_PLAYLIST_SIZE=6

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info
LOG_FILE=./logs/app.log
```

### Passo 4: Criar Diretórios Necessários

```bash
mkdir uploads
mkdir temp
mkdir logs
```

## 🔀 Configuração de Sharding

### Requisitos

- Cluster M10 ou superior no MongoDB Atlas
- Sharding habilitado no cluster

### Configuração Automática

O script `setup-database.js` configura automaticamente o sharding:

```bash
npm run setup-db
```

Este script irá:
1. Habilitar sharding no banco `pobrefy_streaming`
2. Configurar shard keys:
   - **Podcasts**: `{ categoria: 1, _id: 1 }`
   - **Músicas**: `{ genero: 1, _id: 1 }`
   - **Playlists**: `{ usuarioId: 1, _id: 1 }`

### Configuração Manual (MongoDB Atlas)

Se preferir configurar manualmente:

1. Acesse o MongoDB Atlas
2. Vá para seu cluster
3. Clique em "Configuration"
4. Em "Cluster Tier", certifique-se que está em M10+
5. Habilite sharding se não estiver habilitado

### Verificar Sharding

Execute no MongoDB Shell:

```javascript
use pobrefy_streaming
db.podcasts.getShardDistribution()
db.musicas.getShardDistribution()
db.playlists.getShardDistribution()
```

## 🔄 Configuração de Replicação

### No MongoDB Atlas

A replicação é automática! O MongoDB Atlas fornece:

- **3 réplicas** por padrão
- **1 Primary** (escrita e leitura)
- **2 Secondary** (somente leitura)
- **Failover automático** em caso de falha

### Configuração de Read Preference

No arquivo `src/config/database.js`, você pode configurar:

```javascript
{
  readPreference: 'secondaryPreferred', // Prefere ler de secundários
  readConcern: { level: 'majority' },   // Garantia de leitura
  writeConcern: { w: 'majority' }       // Garantia de escrita
}
```

Opções de Read Preference:
- `primary`: Sempre lê do primário
- `primaryPreferred`: Prefere primário, mas pode ler de secundários
- `secondary`: Sempre lê de secundários
- `secondaryPreferred`: Prefere secundários, mas pode ler do primário
- `nearest`: Lê do mais próximo (menor latência)

## 📝 Variáveis de Ambiente

### Variáveis Obrigatórias

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `MONGODB_URI` | String de conexão MongoDB | `mongodb+srv://...` |
| `JWT_SECRET` | Chave secreta para JWT | `minha_chave_secreta_123` |

### Variáveis Opcionais

| Variável | Descrição | Padrão |
|----------|-----------|--------|
| `PORT` | Porta do servidor | `3000` |
| `NODE_ENV` | Ambiente de execução | `development` |
| `MONGODB_SHARD_URI_1/2/3` | URIs de shards adicionais | - |
| `REDIS_URL` | URL do Redis para cache | `redis://localhost:6379` |
| `MAX_FILE_SIZE` | Tamanho máximo de upload | `100MB` |
| `UPLOAD_PATH` | Diretório de uploads | `./uploads` |

### Gerar JWT_SECRET

Use um dos métodos:

**Node.js:**
```javascript
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Online:**
```
https://randomkeygen.com/
```

## 🚀 Inicialização do Banco

### Passo 1: Executar Setup

```bash
npm run setup-db
```

Este comando:
1. ✅ Conecta ao MongoDB Atlas
2. ✅ Cria todos os índices necessários
3. ✅ Configura sharding (se disponível)
4. ✅ Insere dados iniciais (planos de assinatura)

### Passo 2: Verificar Status

Inicie o servidor:
```bash
npm run dev
```

Acesse o health check:
```
http://localhost:3000/health
```

Resposta esperada:
```json
{
  "status": "ok",
  "timestamp": "2025-10-21T...",
  "database": {
    "main": "connected",
    "shards": {
      "shard1": "connected",
      "shard2": "connected",
      "shard3": "connected"
    }
  },
  "uptime": 123.456
}
```

## 🐛 Troubleshooting

### Erro: "MONGODB_URI not defined"

**Problema**: Variável de ambiente não configurada

**Solução**:
1. Verifique se o arquivo `.env` existe
2. Certifique-se que `MONGODB_URI` está definida
3. Reinicie o servidor

### Erro: "MongoServerError: bad auth"

**Problema**: Credenciais incorretas

**Solução**:
1. Verifique username e password
2. Certifique-se que o usuário existe no MongoDB Atlas
3. Verifique se a senha contém caracteres especiais (pode precisar de URL encoding)

Exemplo de encoding:
- `@` → `%40`
- `#` → `%23`
- `$` → `%24`

### Erro: "MongoNetworkError: connection timed out"

**Problema**: IP não está na whitelist

**Solução**:
1. Vá para "Network Access" no MongoDB Atlas
2. Adicione seu IP atual
3. Aguarde 1-2 minutos para propagação

### Erro: "Sharding not enabled"

**Problema**: Cluster não suporta sharding

**Solução**:
1. Sharding requer cluster M10 ou superior
2. Para desenvolvimento, comente as linhas de sharding em `setup-database.js`
3. Ou faça upgrade do cluster

### Erro: "Cannot connect to shard"

**Problema**: URIs de shards não configuradas

**Solução**:
1. Se não está usando múltiplos shards, remova as variáveis `MONGODB_SHARD_URI_*`
2. Ou configure corretamente no `.env`

### Performance Lenta

**Soluções**:
1. Verifique índices: `db.collection.getIndexes()`
2. Use o MongoDB Atlas Performance Advisor
3. Ative profiling para queries lentas
4. Considere adicionar cache com Redis

### Backup e Restore

**Backup Manual**:
```bash
mongodump --uri="mongodb+srv://..." --out=./backup
```

**Restore**:
```bash
mongorestore --uri="mongodb+srv://..." ./backup
```

**MongoDB Atlas** oferece backup automático contínuo (clusters M10+)

## 📊 Monitoramento

### MongoDB Atlas

1. Acesse o Dashboard do cluster
2. Visualize:
   - **Metrics**: CPU, memória, operações/segundo
   - **Real-time Performance**: Queries lentas
   - **Collections**: Tamanho e distribuição
   - **Indexes**: Uso e eficiência

### Logs da Aplicação

Logs são salvos em `./logs/app.log`

Visualizar em tempo real:
```bash
tail -f logs/app.log
```

### Health Check

Monitore o endpoint:
```bash
curl http://localhost:3000/health
```

## 🔒 Segurança em Produção

### Checklist

- [ ] Alterar `JWT_SECRET` para valor forte e único
- [ ] Configurar IPs específicos no Network Access
- [ ] Usar HTTPS/TLS
- [ ] Habilitar rate limiting
- [ ] Configurar backup automático
- [ ] Revisar permissões de usuários
- [ ] Ativar auditoria de logs
- [ ] Usar variáveis de ambiente seguras (não commitar `.env`)
- [ ] Implementar rotação de senhas
- [ ] Configurar alertas de segurança

## 📚 Recursos Adicionais

- [Documentação MongoDB Atlas](https://docs.atlas.mongodb.com/)
- [Documentação Mongoose](https://mongoosejs.com/docs/)
- [Guia de Sharding](https://docs.mongodb.com/manual/sharding/)
- [Guia de Replicação](https://docs.mongodb.com/manual/replication/)
- [Express.js](https://expressjs.com/)

## 🆘 Suporte

Se encontrar problemas:

1. Verifique os logs: `./logs/app.log`
2. Consulte a documentação oficial
3. Revise este guia de configuração
4. Verifique o status do MongoDB Atlas

---

**PobreFy** - Configuração completa! 🎵✅

