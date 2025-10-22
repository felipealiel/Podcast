# PobreFy - Plataforma de Streaming

Plataforma de streaming de podcasts e músicas com sharding e replicação usando MongoDB Atlas.

## 📋 Características

- **Streaming de Podcasts e Músicas**
- **Sharding e Replicação** com MongoDB Atlas
- **Sistema de Playlists**
- **Sistema de Assinaturas** (Mensal e Anual)
- **Avaliações e Comentários**
- **API RESTful**

## 🏗️ Arquitetura

### Banco de Dados

O projeto utiliza MongoDB Atlas com:
- **Sharding**: Distribuição de dados por categoria (podcasts), gênero (músicas) e usuário (playlists)
- **Replicação**: Alta disponibilidade e redundância de dados
- **Índices Otimizados**: Para consultas rápidas

### Coleções

#### 1. **Users** (Usuários)
- Nome de Usuário
- Email
- Senha (criptografada com bcrypt)
- Perfil e configurações
- Estatísticas

#### 2. **Podcasts**
- Título
- Autor
- Ano
- Nota de Avaliações
- Categoria
- Arquivo de áudio
- Estatísticas (reproduções, downloads, favoritos)

#### 3. **Musicas** (Músicas)
- Título
- Autor
- Ano
- Gênero
- Álbum
- Arquivo de áudio
- Estatísticas (reproduções, downloads, favoritos)

#### 4. **Playlists**
- Nome da Playlist
- Músicas
- Proprietário (usuário)
- Configurações de visibilidade
- Colaboradores
- Estatísticas (seguidores, reproduções)

#### 5. **Assinaturas**
- Tipo: Mensal ou Anual
- Plano: Free, Premium, Pro
- Status da assinatura
- Histórico de pagamentos
- Benefícios e limites

## 🚀 Instalação

### Pré-requisitos

- Node.js >= 18.0.0
- MongoDB Atlas (cluster configurado)
- NPM ou Yarn

### Passos

1. **Clone o repositório**
```bash
git clone <url-do-repositorio>
cd PobreFy
```

2. **Instale as dependências**
```bash
npm install
```

3. **Configure as variáveis de ambiente**

Copie o arquivo `env.example` para `.env`:
```bash
copy env.example .env
```

Edite o arquivo `.env` com suas configurações:
```env
# MongoDB Atlas
MONGODB_URI=mongodb+srv://seu-usuario:sua-senha@cluster.mongodb.net/pobrefy_streaming

# JWT
JWT_SECRET=seu-secret-super-seguro

# Servidor
PORT=3000
NODE_ENV=development
```

4. **Configure o banco de dados**
```bash
npm run setup-db
```

Este comando irá:
- Criar índices otimizados
- Configurar sharding
- Inserir dados iniciais (planos de assinatura)

5. **Inicie o servidor**
```bash
# Desenvolvimento
npm run dev

# Produção
npm start
```

## 📂 Estrutura do Projeto

```
PobreFy/
├── src/
│   ├── config/
│   │   └── database.js          # Configuração do MongoDB
│   ├── models/
│   │   ├── User.js              # Modelo de Usuário
│   │   ├── Podcast.js           # Modelo de Podcast
│   │   ├── Musica.js            # Modelo de Música
│   │   ├── Playlist.js          # Modelo de Playlist
│   │   └── Assinatura.js        # Modelo de Assinatura
│   └── server.js                # Servidor Express
├── scripts/
│   ├── setup-database.js        # Script de configuração do banco
│   └── create-shards.js         # Script de configuração de shards
├── package.json
├── env.example
└── README.md
```

## 🗄️ Configuração do MongoDB Atlas

### 1. Criar Cluster

1. Acesse [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Crie uma conta ou faça login
3. Crie um novo cluster (pode usar o tier gratuito M0)
4. Configure o usuário do banco de dados
5. Adicione seu IP à lista de IPs permitidos

### 2. Configurar Sharding

No MongoDB Atlas, o sharding é gerenciado automaticamente. O projeto utiliza as seguintes chaves de shard:

- **Podcasts**: `{ categoria: 1, _id: 1 }`
- **Músicas**: `{ genero: 1, _id: 1 }`
- **Playlists**: `{ usuarioId: 1, _id: 1 }`

### 3. String de Conexão

Copie a string de conexão do MongoDB Atlas:
```
mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<database>?retryWrites=true&w=majority
```

Substitua:
- `<username>`: seu usuário
- `<password>`: sua senha
- `<cluster>`: nome do seu cluster
- `<database>`: pobrefy_streaming

## 📊 Sharding e Replicação

### Estratégia de Sharding

#### Podcasts
- **Shard Key**: `categoria`
- **Vantagem**: Distribui podcasts de diferentes categorias entre shards
- **Consultas otimizadas**: Buscar por categoria acessa apenas um shard

#### Músicas
- **Shard Key**: `genero`
- **Vantagem**: Distribui músicas por gênero musical
- **Consultas otimizadas**: Buscar por gênero acessa apenas um shard

#### Playlists
- **Shard Key**: `usuarioId`
- **Vantagem**: Todas as playlists de um usuário ficam no mesmo shard
- **Consultas otimizadas**: Buscar playlists de um usuário acessa apenas um shard

### Replicação

O MongoDB Atlas fornece replicação automática com:
- **3 réplicas** por padrão
- **Failover automático**
- **Backup contínuo**

## 🔧 Scripts Disponíveis

```bash
# Iniciar servidor em desenvolvimento (com nodemon)
npm run dev

# Iniciar servidor em produção
npm start

# Configurar banco de dados (índices e sharding)
npm run setup-db

# Criar/configurar shards
npm run create-shards

# Executar testes
npm test
```

## 📡 API Endpoints

### Health Check
```
GET /health
```
Retorna o status do servidor e conexões do banco de dados.

### Endpoints Principais (a implementar)

```
# Usuários
POST   /api/v1/users/register
POST   /api/v1/users/login
GET    /api/v1/users/profile

# Podcasts
GET    /api/v1/podcasts
GET    /api/v1/podcasts/:id
POST   /api/v1/podcasts
PUT    /api/v1/podcasts/:id
DELETE /api/v1/podcasts/:id

# Músicas
GET    /api/v1/musicas
GET    /api/v1/musicas/:id
POST   /api/v1/musicas
PUT    /api/v1/musicas/:id
DELETE /api/v1/musicas/:id

# Playlists
GET    /api/v1/playlists
GET    /api/v1/playlists/:id
POST   /api/v1/playlists
PUT    /api/v1/playlists/:id
DELETE /api/v1/playlists/:id

# Assinaturas
GET    /api/v1/assinaturas/planos
POST   /api/v1/assinaturas/assinar
PUT    /api/v1/assinaturas/cancelar
GET    /api/v1/assinaturas/minha
```

## 💳 Planos de Assinatura

### Free (Gratuito)
- Streaming básico
- 5 playlists
- 50 músicas por playlist
- Com anúncios

### Premium (R$ 19,90/mês ou R$ 199,90/ano)
- Streaming ilimitado
- Sem anúncios
- Download offline (500/mês)
- Playlists ilimitadas
- Qualidade alta

### Pro (R$ 39,90/mês ou R$ 399,90/ano)
- Todos os benefícios Premium
- Upload de conteúdo (100/mês)
- 50GB de armazenamento
- Suporte prioritário
- Playlists colaborativas

## 🔐 Segurança

- Senhas criptografadas com bcrypt (12 rounds)
- JWT para autenticação
- Helmet para segurança HTTP
- Rate limiting
- Validação de dados com Joi

## 📈 Performance

### Índices Otimizados
- Índices de texto para busca
- Índices compostos para consultas frequentes
- Índices únicos para integridade de dados

### Caching (a implementar)
- Redis para cache de sessões
- Cache de consultas frequentes
- Cache de arquivos de streaming

## 🛠️ Tecnologias Utilizadas

- **Node.js** - Runtime JavaScript
- **Express** - Framework web
- **MongoDB** - Banco de dados NoSQL
- **Mongoose** - ODM para MongoDB
- **bcryptjs** - Criptografia de senhas
- **jsonwebtoken** - Autenticação JWT
- **Helmet** - Segurança HTTP
- **Morgan** - Logging HTTP
- **Compression** - Compressão de respostas

## 📝 Próximos Passos

- [ ] Implementar rotas da API
- [ ] Sistema de autenticação completo
- [ ] Upload de arquivos (podcasts/músicas)
- [ ] Processamento de áudio (conversão, compressão)
- [ ] Sistema de streaming HLS/DASH
- [ ] Cache com Redis
- [ ] Sistema de pagamentos
- [ ] Interface de administração
- [ ] Testes automatizados
- [ ] Documentação da API (Swagger)
- [ ] Deploy em produção

## 🤝 Contribuindo

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/MinhaFeature`)
3. Commit suas mudanças (`git commit -m 'Adiciona MinhaFeature'`)
4. Push para a branch (`git push origin feature/MinhaFeature`)
5. Abra um Pull Request

## 📄 Licença

MIT

## 👨‍💻 Autor

João Gabriel

---

**PobreFy** - Streaming de qualidade para todos! 🎵🎧

