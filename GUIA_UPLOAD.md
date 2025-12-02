# Guia de Upload de Músicas

## 📋 Requisitos

### Permissões
- Você precisa estar autenticado (token JWT)
- Você precisa ter a role de **produtor** ou **admin**

### Campos Obrigatórios
- `titulo` - Título da música
- `autor` - Nome do artista/autor
- `ano` - Ano de lançamento
- `genero` - Gênero musical
- `arquivo` - Arquivo de áudio (multipart/form-data)

### Campos Opcionais
- `album` - Nome do álbum
- `letra` - Letra da música
- `tags` - Tags separadas por vírgula
- `capa` - Imagem de capa (multipart/form-data)
- `visibilidade` - 'publico' ou 'privado' (padrão: 'publico')
- `permiteDownload` - 'true' ou 'false' (padrão: 'true')
- `permiteStreaming` - 'true' ou 'false' (padrão: 'true')
- `permiteCompartilhamento` - 'true' ou 'false' (padrão: 'true')

## 📤 Como Fazer Upload

### Endpoint
```
POST /api/v1/musicas/upload
```

### Headers
```
Authorization: Bearer SEU_TOKEN_JWT
Content-Type: multipart/form-data
```

### Form Data
- `arquivo`: Arquivo de áudio (MP3, WAV, AAC, OGG, M4A, FLAC)
- `capa`: Arquivo de imagem (opcional) - JPEG, PNG, WEBP, GIF
- `titulo`: String
- `autor`: String
- `ano`: Number
- `genero`: String (deve ser um dos gêneros válidos)
- `album`: String (opcional)
- `letra`: String (opcional)
- `tags`: String separada por vírgulas (opcional)

### Exemplo com cURL
```bash
curl -X POST http://localhost:3000/api/v1/musicas/upload \
  -H "Authorization: Bearer SEU_TOKEN" \
  -F "arquivo=@musica.mp3" \
  -F "capa=@capa.jpg" \
  -F "titulo=Minha Música" \
  -F "autor=Artista" \
  -F "ano=2024" \
  -F "genero=Rock" \
  -F "album=Meu Álbum"
```

### Exemplo com JavaScript (Fetch)
```javascript
const formData = new FormData();
formData.append('arquivo', arquivoAudio); // File object
formData.append('capa', arquivoCapa); // File object (opcional)
formData.append('titulo', 'Minha Música');
formData.append('autor', 'Artista');
formData.append('ano', '2024');
formData.append('genero', 'Rock');
formData.append('album', 'Meu Álbum');
formData.append('tags', 'rock,pop,brasil');

const response = await fetch('http://localhost:3000/api/v1/musicas/upload', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});

const data = await response.json();
console.log(data);
```

### Exemplo com Axios
```javascript
const formData = new FormData();
formData.append('arquivo', arquivoAudio);
formData.append('titulo', 'Minha Música');
formData.append('autor', 'Artista');
formData.append('ano', '2024');
formData.append('genero', 'Rock');

const response = await axios.post(
  'http://localhost:3000/api/v1/musicas/upload',
  formData,
  {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'multipart/form-data'
    }
  }
);
```

## 🎵 Gêneros Válidos

Os seguintes gêneros são aceitos:
- Pop, Rock, Hip Hop, R&B, Country, Jazz, Blues
- Classical, Electronic, Folk, Reggae, Funk, Soul
- Gospel, Alternative, Indie, Metal, Punk, Ska
- Bossa Nova, Sertanejo, Forró, Axé, MPB, Funk Carioca
- Trap, Drill, Lo-Fi, Ambient, Outros

## 📏 Limites

- **Tamanho máximo do áudio**: 100MB
- **Tamanho máximo da capa**: 5MB
- **Formatos de áudio aceitos**: MP3, WAV, AAC, OGG, M4A, FLAC
- **Formatos de imagem aceitos**: JPEG, PNG, WEBP, GIF

## ⚠️ Erros Comuns

### 1. "Arquivo de áudio é obrigatório"
- Certifique-se de que o campo do arquivo se chama **"arquivo"** (não "file" ou "music")
- Verifique se está enviando como `multipart/form-data`

### 2. "Título, autor, ano e gênero são obrigatórios"
- Todos esses campos devem ser enviados no body da requisição
- Verifique se os nomes dos campos estão corretos

### 3. "Acesso negado. Apenas produtores e administradores..."
- Você precisa ser promovido a produtor por um admin
- Use o endpoint: `POST /api/v1/admin/promover-produtor/:userId`

### 4. "Formato de arquivo não suportado"
- Verifique se o arquivo é um dos formatos aceitos
- Verifique o MIME type do arquivo

### 5. "Arquivo muito grande"
- Reduza o tamanho do arquivo ou comprima o áudio
- Limite: 100MB

## 🔍 Verificar Status do Upload

Após o upload, você receberá uma resposta como:

```json
{
  "success": true,
  "message": "Música enviada com sucesso. Transcodificação em andamento.",
  "data": {
    "results": {
      "cluster1": {
        "insertedId": "..."
      }
    }
  }
}
```

A transcodificação para múltiplas qualidades acontece em background e pode levar alguns minutos dependendo do tamanho do arquivo.

## 📝 Notas

- O arquivo original é mantido
- Versões transcodificadas (high, medium, low) são criadas automaticamente
- As informações do áudio (duração, bitrate) são extraídas automaticamente
- Se houver erro, o arquivo enviado é automaticamente removido

