# Sistema de Arquivos Locais

## 📋 Mudanças Implementadas

### O que mudou:
- ✅ **Apenas metadados no banco**: Informações da música são salvas no MongoDB
- ✅ **Arquivos apenas locais**: Músicas e capas ficam apenas no servidor local
- ✅ **Sem transcodificação**: Processo removido para evitar loops infinitos
- ✅ **Servir via express.static**: Arquivos são servidos diretamente do diretório `uploads/`

## 🗂️ Estrutura de Arquivos

```
uploads/
├── musics/          # Arquivos de áudio (MP3, WAV, etc.)
│   └── music-*.mp3
└── covers/          # Capas de álbum (JPG, PNG, etc.)
    └── cover-*.jpg
```

## 📤 Como Funciona o Upload

1. **Upload do arquivo**:
   - Arquivo é salvo em `uploads/musics/` ou `uploads/covers/`
   - Nome único gerado automaticamente

2. **Salvar no banco**:
   - Apenas **metadados** são salvos no MongoDB
   - URL do arquivo é salva (ex: `/uploads/musics/music-123.mp3`)
   - **Path local NÃO é replicado** nos clusters

3. **Resposta imediata**:
   - Servidor responde imediatamente após salvar
   - Sem processamento pesado
   - Sem transcodificação

## 🎵 Como Funciona o Streaming

### Arquivos são servidos via `express.static`:
- URL: `http://localhost:3000/uploads/musics/music-123.mp3`
- Servido diretamente do sistema de arquivos
- Headers CORS configurados
- Suporte a Range Requests para streaming

### Endpoint de streaming (alternativo):
- URL: `http://localhost:3000/api/v1/streaming/stream/:id`
- Busca o arquivo pelo ID da música
- Serve o arquivo local com headers adequados

## 🔍 Verificação

### Verificar se arquivo existe:
```bash
# No servidor
ls uploads/musics/
ls uploads/covers/
```

### Testar acesso direto:
```
http://localhost:3000/uploads/musics/nome-do-arquivo.mp3
http://localhost:3000/uploads/covers/nome-do-arquivo.jpg
```

## ⚠️ Importante

### Arquivos NÃO são replicados:
- Arquivos ficam **apenas no servidor local**
- Se o servidor for reiniciado, arquivos permanecem
- **Backup recomendado** para produção

### Paths locais:
- Path completo é salvo no banco local (para servir)
- Path NÃO é replicado nos clusters MongoDB
- Apenas URL é replicada

## 🚀 Vantagens

1. **Upload rápido**: Sem processamento pesado
2. **Sem loops**: Transcodificação removida
3. **Simples**: Arquivos servidos diretamente
4. **Eficiente**: Sem duplicação de arquivos

## 📝 Notas Técnicas

### No banco de dados:
```javascript
{
  titulo: "Música",
  autor: "Artista",
  arquivo: {
    filename: "music-123.mp3",
    url: "/uploads/musics/music-123.mp3",
    tamanho: 5000000,
    formato: "mp3"
    // path NÃO é salvo (apenas localmente)
  }
}
```

### No servidor local:
- Arquivo físico: `uploads/musics/music-123.mp3`
- Acessível via: `http://localhost:3000/uploads/musics/music-123.mp3`

