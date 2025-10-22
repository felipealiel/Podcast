# 📘 Exemplos de Uso - Modelos PobreFy

Este documento contém exemplos práticos de como usar os modelos criados.

## 🔐 Usuários (User)

### Criar Usuário

```javascript
const User = require('./src/models/User');

const novoUsuario = new User({
  nomeUsuario: 'joao_dev',
  email: 'joao@example.com',
  senha: '123456',  // Será criptografada automaticamente
  profile: {
    firstName: 'João',
    lastName: 'Silva',
    bio: 'Desenvolvedor e amante de música'
  }
});

await novoUsuario.save();
```

### Login (Verificar Senha)

```javascript
const usuario = await User.findOne({ email: 'joao@example.com' })
  .select('+senha');  // Incluir senha na busca

const senhaCorreta = await usuario.comparePassword('123456');
if (senhaCorreta) {
  console.log('Login bem-sucedido!');
}
```

### Atualizar Assinatura

```javascript
usuario.account.subscription = 'premium';
usuario.account.subscriptionExpiresAt = new Date('2025-12-31');
await usuario.save();
```

## 🎙️ Podcasts

### Criar Podcast

```javascript
const Podcast = require('./src/models/Podcast');

const novoPodcast = new Podcast({
  titulo: 'Tecnologia e Inovação #01',
  autor: 'João Silva',
  ano: 2025,
  descricao: 'Discussão sobre as últimas tendências em tecnologia',
  categoria: 'Tecnologia',
  tags: ['tech', 'inovacao', 'programacao'],
  arquivo: {
    filename: 'podcast-001.mp3',
    path: '/uploads/podcasts/podcast-001.mp3',
    url: 'https://cdn.pobrefy.com/podcasts/podcast-001.mp3',
    tamanho: 45000000,  // 45MB em bytes
    duracao: 3600,      // 1 hora em segundos
    formato: 'mp3',
    bitrate: 128
  },
  capa: {
    filename: 'podcast-001-cover.jpg',
    path: '/uploads/covers/podcast-001-cover.jpg',
    url: 'https://cdn.pobrefy.com/covers/podcast-001-cover.jpg'
  },
  upload: {
    usuarioId: usuario._id
  }
});

await novoPodcast.save();
```

### Adicionar Avaliação

```javascript
await novoPodcast.adicionarAvaliacao(
  usuario._id,
  5,  // Nota de 1 a 5
  'Excelente podcast! Muito informativo.'
);
```

### Incrementar Reproduções

```javascript
await novoPodcast.incrementarReproducoes();
```

### Buscar Podcasts Populares

```javascript
const populares = await Podcast.buscarPopulares(10, 0);
// Retorna 10 podcasts mais populares
```

### Buscar por Categoria

```javascript
const tecnologia = await Podcast.buscarPorCategoria('Tecnologia', 20, 0);
```

## 🎵 Músicas

### Criar Música

```javascript
const Musica = require('./src/models/Musica');

const novaMusica = new Musica({
  titulo: 'Garota de Ipanema',
  autor: 'Tom Jobim',
  ano: 1962,
  genero: 'Bossa Nova',
  album: 'The Girl from Ipanema',
  duracao: 195,  // 3:15 em segundos
  letra: 'Olha que coisa mais linda...',
  arquivo: {
    filename: 'garota-ipanema.mp3',
    path: '/uploads/musicas/garota-ipanema.mp3',
    url: 'https://cdn.pobrefy.com/musicas/garota-ipanema.mp3',
    tamanho: 4800000,  // ~4.8MB
    formato: 'mp3',
    bitrate: 192,
    sampleRate: 44100
  },
  capa: {
    filename: 'garota-ipanema-cover.jpg',
    path: '/uploads/covers/garota-ipanema-cover.jpg',
    url: 'https://cdn.pobrefy.com/covers/garota-ipanema-cover.jpg'
  },
  tags: ['bossa nova', 'classico', 'brasileiro'],
  upload: {
    usuarioId: usuario._id
  }
});

await novaMusica.save();
```

### Buscar por Gênero

```javascript
const bossaNova = await Musica.buscarPorGenero('Bossa Nova', 20, 0);
```

### Buscar por Autor

```javascript
const tomJobim = await Musica.buscarPorAutor('Tom Jobim', 20, 0);
```

### Buscar Mais Favoritadas

```javascript
const maisAmadas = await Musica.buscarMaisFavoritadas(10, 0);
```

### Incrementar Stats

```javascript
await novaMusica.incrementarReproducoes();
await novaMusica.incrementarFavoritos();
await novaMusica.incrementarCompartilhamentos();
```

## 📝 Playlists

### Criar Playlist

```javascript
const Playlist = require('./src/models/Playlist');

const minhaPlaylist = new Playlist({
  nomePlaylist: 'Bossa Nova Clássica',
  descricao: 'As melhores músicas de Bossa Nova',
  usuarioId: usuario._id,
  visibilidade: 'publico',
  tags: ['bossa nova', 'classico', 'brasil'],
  configuracoes: {
    permiteColaboracao: false,
    permiteCompartilhamento: true,
    ordemAleatoria: false,
    repeticao: 'toda'
  }
});

await minhaPlaylist.save();
```

### Adicionar Músicas

```javascript
await minhaPlaylist.adicionarMusica(novaMusica._id);
await minhaPlaylist.adicionarMusica(outraMusica._id);
await minhaPlaylist.adicionarMusica(maisUmaMusica._id);
```

### Remover Música

```javascript
await minhaPlaylist.removerMusica(novaMusica._id);
```

### Reordenar Músicas

```javascript
const novaOrdem = [
  maisUmaMusica._id,
  outraMusica._id,
  novaMusica._id
];
await minhaPlaylist.reordenarMusicas(novaOrdem);
```

### Adicionar Colaborador

```javascript
await minhaPlaylist.adicionarColaborador(outroUsuario._id, {
  podeAdicionar: true,
  podeRemover: false,
  podeEditar: false
});
```

### Buscar Playlists Públicas

```javascript
const playlistsPublicas = await Playlist.buscarPublicas(20, 0);
```

### Buscar Playlists de um Usuário

```javascript
const minhasPlaylists = await Playlist.buscarPorUsuario(usuario._id, 10, 0);
```

### Incrementar Stats

```javascript
await minhaPlaylist.incrementarReproducoes();
await minhaPlaylist.incrementarSeguidores();
await minhaPlaylist.incrementarCompartilhamentos();
```

## 💳 Assinaturas

### Criar Assinatura Free

```javascript
const Assinatura = require('./src/models/Assinatura');

const assinaturaFree = new Assinatura({
  usuarioId: usuario._id,
  tipo: 'mensal',
  plano: 'free',
  pagamento: {
    metodoPagamento: 'cartao_credito',
    statusPagamento: 'aprovado'
  }
});

await assinaturaFree.save();
```

### Criar Assinatura Premium

```javascript
const assinaturaPremium = new Assinatura({
  usuarioId: usuario._id,
  tipo: 'anual',
  plano: 'premium',
  renovacaoAutomatica: true,
  pagamento: {
    metodoPagamento: 'cartao_credito',
    ultimosDigitosCartao: '4242',
    bandeiraCartao: 'visa',
    statusPagamento: 'aprovado'
  }
});

await assinaturaPremium.save();

// Os benefícios e valores são configurados automaticamente
console.log(assinaturaPremium.beneficios);
// {
//   streamingIlimitado: true,
//   qualidadeAlta: true,
//   downloadOffline: true,
//   semAnuncios: true,
//   ...
// }
```

### Iniciar Trial

```javascript
await assinatura.iniciarTrial(7);  // 7 dias de trial
```

### Aplicar Cupom

```javascript
const dataExpiracao = new Date();
dataExpiracao.setMonth(dataExpiracao.getMonth() + 3);

await assinatura.aplicarCupom('PRIMEIRA_COMPRA', 20, dataExpiracao);
// 20% de desconto
```

### Calcular Valor com Desconto

```javascript
const valorFinal = assinatura.calcularValorComDesconto();
// Se mensal: 19.90 - 20% = 15.92
```

### Adicionar Pagamento ao Histórico

```javascript
await assinatura.adicionarPagamento({
  valor: 199.90,
  tipo: 'anual',
  status: 'pago',
  metodoPagamento: 'cartao_credito',
  transacaoId: 'TXN-123456',
  fatura: {
    url: 'https://pobrefy.com/faturas/123456.pdf',
    numero: 'FAT-2025-001'
  },
  descricao: 'Assinatura Premium Anual'
});
```

### Renovar Assinatura

```javascript
await assinatura.renovar();
// Renova por mais um período (mensal ou anual)
```

### Cancelar Assinatura

```javascript
await assinatura.cancelar(
  'muito_caro',
  'Vou usar outra plataforma',
  usuario._id
);
```

### Buscar Assinaturas que Vão Expirar

```javascript
const expirandoEmBreve = await Assinatura.buscarExpirandoEmBreve(7);
// Assinaturas que expiram em 7 dias
```

### Verificar Status

```javascript
if (assinatura.isAtiva) {
  console.log('Assinatura ativa!');
}

if (assinatura.isEmTrial) {
  console.log('Em período de teste');
}

console.log(`Dias restantes: ${assinatura.diasRestantes}`);

if (assinatura.expiraEmBreve) {
  console.log('Renovação necessária em breve!');
}
```

## 🔍 Consultas Avançadas

### Buscar Podcasts por Texto

```javascript
const resultados = await Podcast.find({
  $text: { $search: 'tecnologia programação' }
})
.sort({ score: { $meta: 'textScore' } })
.limit(10);
```

### Buscar Músicas de uma Década

```javascript
const anos80 = await Musica.buscarPorDecada(1980, 50, 0);
// Músicas de 1980-1989
```

### Buscar Playlists Populares de um Tipo

```javascript
const descobertaSemanal = await Playlist.buscarPorTipo('descoberta-semanal', 10, 0);
```

### Estatísticas de Usuário

```javascript
const usuario = await User.findById(userId);

console.log({
  totalViews: usuario.stats.totalViews,
  totalLikes: usuario.stats.totalLikes,
  assinatura: usuario.account.subscription,
  isPremium: usuario.isPremium(),
  assinaturaAtiva: usuario.isSubscriptionActive()
});
```

## 🔄 Operações em Lote

### Criar Múltiplas Músicas

```javascript
const musicas = [
  { titulo: 'Música 1', autor: 'Artista 1', genero: 'Pop', ... },
  { titulo: 'Música 2', autor: 'Artista 2', genero: 'Rock', ... },
  { titulo: 'Música 3', autor: 'Artista 3', genero: 'Jazz', ... }
];

const musicasCriadas = await Musica.insertMany(musicas);
```

### Atualizar em Lote

```javascript
// Ativar todas as músicas de um usuário
await Musica.updateMany(
  { 'upload.usuarioId': usuario._id },
  { $set: { status: 'ativo' } }
);
```

### Deletar em Lote

```javascript
// Remover podcasts antigos inativos
await Podcast.deleteMany({
  status: 'inativo',
  'upload.dataUpload': { $lt: new Date('2020-01-01') }
});
```

## 📊 Agregações

### Top 10 Artistas por Número de Músicas

```javascript
const topArtistas = await Musica.aggregate([
  { $match: { status: 'ativo' } },
  { $group: { 
    _id: '$autor', 
    totalMusicas: { $sum: 1 },
    totalReproducoes: { $sum: '$stats.reproducoes' }
  }},
  { $sort: { totalMusicas: -1 } },
  { $limit: 10 }
]);
```

### Gêneros Mais Populares

```javascript
const generosPopulares = await Musica.aggregate([
  { $match: { status: 'ativo' } },
  { $group: { 
    _id: '$genero', 
    total: { $sum: 1 },
    reproducoes: { $sum: '$stats.reproducoes' }
  }},
  { $sort: { reproducoes: -1 } },
  { $limit: 10 }
]);
```

### Receita por Plano de Assinatura

```javascript
const receitaPorPlano = await Assinatura.aggregate([
  { $match: { status: 'ativa' } },
  { $group: {
    _id: '$plano',
    total: { $sum: 1 },
    receitaMensal: { $sum: '$valores.mensal' },
    receitaAnual: { $sum: '$valores.anual' }
  }}
]);
```

## 🔔 Eventos e Hooks

### Após Salvar Usuário

```javascript
userSchema.post('save', async function(doc) {
  console.log(`Usuário ${doc.nomeUsuario} foi salvo!`);
  
  // Criar assinatura free automática
  if (doc.isNew) {
    const Assinatura = require('./Assinatura');
    await new Assinatura({
      usuarioId: doc._id,
      tipo: 'mensal',
      plano: 'free'
    }).save();
  }
});
```

### Antes de Remover Playlist

```javascript
playlistSchema.pre('remove', async function(next) {
  // Decrementar contador nas músicas
  for (const item of this.musicas) {
    const Musica = mongoose.model('Musica');
    await Musica.findByIdAndUpdate(item.musicaId, {
      $inc: { 'stats.adicionadasPlaylists': -1 }
    });
  }
  next();
});
```

## 🧪 Testes

### Exemplo de Teste com Jest

```javascript
describe('Modelo de Podcast', () => {
  it('deve criar um podcast válido', async () => {
    const podcast = new Podcast({
      titulo: 'Teste',
      autor: 'Autor Teste',
      ano: 2025,
      categoria: 'Tecnologia',
      arquivo: {
        filename: 'test.mp3',
        path: '/test.mp3',
        url: 'http://test.com/test.mp3',
        tamanho: 1000,
        duracao: 60,
        formato: 'mp3'
      },
      upload: {
        usuarioId: mongoose.Types.ObjectId()
      }
    });
    
    const salvo = await podcast.save();
    expect(salvo.titulo).toBe('Teste');
    expect(salvo.stats.reproducoes).toBe(0);
  });
});
```

---

**PobreFy** - Exemplos de uso dos modelos! 📘✅

