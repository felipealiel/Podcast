# Correção de ERR_CONNECTION_RESET no Upload

## 🔧 Problema Resolvido

O erro `ERR_CONNECTION_RESET` durante o upload estava sendo causado por:
1. **Timeout muito curto** - O servidor estava fechando a conexão antes do upload terminar
2. **Processamento bloqueante** - O processamento de áudio estava bloqueando a resposta
3. **Erros não tratados** - Erros no ffmpeg estavam causando crash do servidor

## ✅ Correções Aplicadas

### 1. Timeout Aumentado
- ✅ Timeout do servidor aumentado para **5 minutos** (300 segundos)
- ✅ `keepAliveTimeout` e `headersTimeout` configurados adequadamente
- ✅ Suporte a uploads grandes sem interrupção

### 2. Processamento Assíncrono
- ✅ Resposta enviada **ANTES** do processamento pesado
- ✅ Transcodificação movida para `process.nextTick()` (não bloqueia)
- ✅ Processamento de áudio com timeout de 10 segundos
- ✅ Se o processamento falhar, usa valores padrão (não bloqueia upload)

### 3. Tratamento de Erros Robusto
- ✅ Verificação de disponibilidade do ffmpeg antes de usar
- ✅ Fallback para valores padrão se ffmpeg falhar
- ✅ Erros de transcodificação não afetam o upload
- ✅ Logging detalhado de todos os erros

### 4. Melhorias no Servidor
- ✅ Tratamento de erros não capturados melhorado
- ✅ Servidor HTTP criado explicitamente com timeouts
- ✅ Tratamento de erros do servidor (EADDRINUSE, etc.)

## 📋 Mudanças Técnicas

### Timeout do Servidor
```javascript
server.timeout = 300000; // 5 minutos
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;
```

### Processamento de Áudio com Timeout
```javascript
const timeoutPromise = new Promise((_, reject) => {
  setTimeout(() => reject(new Error('Timeout')), 10000);
});
audioInfo = await Promise.race([
  getAudioInfo(arquivoPath),
  timeoutPromise
]);
```

### Resposta Imediata
```javascript
// Resposta enviada ANTES de qualquer processamento pesado
res.status(201).json({
  success: true,
  message: 'Música enviada com sucesso. Transcodificação em andamento.',
  data: { id, titulo, autor, url }
});
```

## 🧪 Como Testar

1. **Reinicie o servidor:**
   ```bash
   npm start
   # ou
   npm run dev
   ```

2. **Teste o upload:**
   - Tente fazer upload de uma música
   - Verifique se a resposta chega rapidamente
   - A transcodificação acontece em background

3. **Verifique os logs:**
   - O servidor deve mostrar logs de upload
   - Se houver erro no ffmpeg, será logado mas não bloqueará

## ⚠️ Notas Importantes

### Se o ffmpeg não estiver instalado:
- O upload ainda funcionará
- Informações de áudio usarão valores padrão
- Transcodificação será pulada (mas não causará erro)

### Tamanho de Arquivo:
- Limite: 100MB (configurado no multer)
- Timeout: 5 minutos (suficiente para uploads grandes)

### Processamento em Background:
- A transcodificação acontece **depois** da resposta
- Pode levar alguns minutos dependendo do tamanho
- Não bloqueia outros uploads

## 🔍 Verificação

Após reiniciar, você deve ver:
- ✅ Upload completando sem ERR_CONNECTION_RESET
- ✅ Resposta rápida (mesmo com arquivos grandes)
- ✅ Logs mostrando o progresso
- ✅ Música salva no banco de dados

## 📝 Arquivos Modificados

1. `src/server.js` - Timeout aumentado e tratamento de erros
2. `src/controllers/musica.controller.js` - Processamento assíncrono e tratamento de erros
3. `src/utils/audioProcessor.js` - Verificação de ffmpeg e fallbacks

## 🚀 Próximos Passos

Se ainda houver problemas:
1. Verifique os logs do servidor para erros específicos
2. Verifique se o ffmpeg está instalado: `npm list ffmpeg-static`
3. Teste com um arquivo menor primeiro
4. Verifique o espaço em disco disponível

