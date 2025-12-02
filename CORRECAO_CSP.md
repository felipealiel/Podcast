# Correção de Content Security Policy (CSP)

## 🔧 Problema Resolvido

O erro "Refused to execute inline script because it violates the following Content Security Policy directive" foi causado pelas políticas de segurança muito restritivas do Helmet.

## ✅ Correções Aplicadas

### 1. Configuração do Helmet
- ✅ Permitido `'unsafe-inline'` para scripts (necessário para algumas páginas HTML)
- ✅ Permitido `'unsafe-eval'` para bibliotecas que precisam
- ✅ Permitido estilos inline
- ✅ Permitido imagens de qualquer origem HTTPS
- ✅ Permitido blob URLs para streaming de mídia
- ✅ Permitido WebSocket (ws:// e wss://)
- ✅ Configurado `crossOriginResourcePolicy` para permitir recursos cross-origin

### 2. Headers CORS para Arquivos Estáticos
- ✅ Adicionados headers CORS para arquivos em `/public`
- ✅ Adicionados headers CORS para arquivos em `/uploads`
- ✅ Headers específicos para streaming de áudio
- ✅ Cache adequado para mídia e imagens

### 3. Headers no Controller de Streaming
- ✅ Adicionados headers CORS no streaming de áudio
- ✅ Headers `Access-Control-Expose-Headers` para permitir Range Requests

## 📋 Configurações Aplicadas

### Content Security Policy
```javascript
contentSecurityPolicy: {
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
    styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
    fontSrc: ["'self'", "https://fonts.gstatic.com"],
    imgSrc: ["'self'", "data:", "blob:", "https:"],
    mediaSrc: ["'self'", "blob:", "data:"],
    connectSrc: ["'self'", "ws:", "wss:"]
  }
}
```

### Arquivos Estáticos
- Headers CORS configurados
- Content-Type correto para mídia
- Cache de 1 ano para uploads

## 🧪 Como Testar

1. **Reinicie o servidor:**
   ```bash
   npm start
   # ou
   npm run dev
   ```

2. **Teste no navegador:**
   - Abra o console do navegador (F12)
   - Verifique se não há mais erros de CSP
   - Teste carregar uma música
   - Teste carregar uma capa de álbum

3. **Verifique os headers:**
   - Abra DevTools > Network
   - Carregue uma música ou imagem
   - Verifique se os headers CORS estão presentes

## ⚠️ Notas de Segurança

### Desenvolvimento
As configurações atuais são mais permissivas para facilitar o desenvolvimento. Isso inclui:
- `'unsafe-inline'` para scripts
- `'unsafe-eval'` para eval()
- Imagens de qualquer origem HTTPS

### Produção
Para produção, considere:
1. **Usar nonces** em vez de `'unsafe-inline'`:
   ```javascript
   scriptSrc: ["'self'", (req, res) => `'nonce-${res.locals.nonce}'`]
   ```

2. **Remover `'unsafe-eval'`** se não for necessário

3. **Restringir `imgSrc`** para domínios específicos

4. **Habilitar `upgradeInsecureRequests`**:
   ```javascript
   upgradeInsecureRequests: []
   ```

## 🔍 Verificação

Após reiniciar o servidor, você deve ver:
- ✅ Scripts inline funcionando
- ✅ Músicas carregando corretamente
- ✅ Capas de álbum exibindo
- ✅ Sem erros de CSP no console

## 📝 Arquivos Modificados

1. `src/server.js` - Configuração do Helmet e arquivos estáticos
2. `src/controllers/streaming.controller.js` - Headers CORS no streaming

## 🚀 Próximos Passos

Se ainda houver problemas:
1. Limpe o cache do navegador (Ctrl+Shift+Delete)
2. Verifique os logs do servidor
3. Verifique o console do navegador para erros específicos
4. Teste em modo anônimo/privado

