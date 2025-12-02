/**
 * Script de teste para upload de música
 * 
 * Uso: node scripts/test-upload.js
 * 
 * Requer:
 * - Um arquivo de teste em ./test-music.mp3 (ou ajuste o caminho)
 * - Um token JWT válido de um usuário com role 'producer' ou 'admin'
 * - Servidor rodando em http://localhost:3000
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

// Configurações
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';
const TOKEN = process.env.JWT_TOKEN || 'SEU_TOKEN_AQUI';
const MUSIC_FILE = process.env.MUSIC_FILE || './test-music.mp3';
const COVER_FILE = process.env.COVER_FILE || null; // Opcional

// Função auxiliar para criar boundary do multipart/form-data
function createMultipartFormData(fields, files) {
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
  const CRLF = '\r\n';
  let body = '';

  // Adicionar campos de texto
  for (const [key, value] of Object.entries(fields)) {
    body += `--${boundary}${CRLF}`;
    body += `Content-Disposition: form-data; name="${key}"${CRLF}${CRLF}`;
    body += `${value}${CRLF}`;
  }

  // Adicionar arquivos
  for (const [key, filePath] of Object.entries(files)) {
    const fileName = path.basename(filePath);
    const fileContent = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = ext === '.mp3' ? 'audio/mpeg' : 
                       ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' :
                       ext === '.png' ? 'image/png' : 'application/octet-stream';

    body += `--${boundary}${CRLF}`;
    body += `Content-Disposition: form-data; name="${key}"; filename="${fileName}"${CRLF}`;
    body += `Content-Type: ${contentType}${CRLF}${CRLF}`;
    body = Buffer.concat([
      Buffer.from(body, 'utf8'),
      fileContent,
      Buffer.from(CRLF, 'utf8')
    ]);
  }

  body = Buffer.concat([
    body,
    Buffer.from(`--${boundary}--${CRLF}`, 'utf8')
  ]);

  return { body, boundary, contentType: `multipart/form-data; boundary=${boundary}` };
}

function testUpload() {
  console.log('🧪 Teste de Upload de Música\n');
  console.log(`📡 Servidor: ${SERVER_URL}`);
  console.log(`🎵 Arquivo: ${MUSIC_FILE}\n`);

  // Verificar se o arquivo existe
  if (!fs.existsSync(MUSIC_FILE)) {
    console.error('❌ Arquivo de música não encontrado:', MUSIC_FILE);
    console.log('\n💡 Dica: Coloque um arquivo MP3 na raiz do projeto ou ajuste MUSIC_FILE');
    console.log('   Exemplo: MUSIC_FILE=./test-music.mp3 node scripts/test-upload.js');
    process.exit(1);
  }

  // Verificar token
  if (TOKEN === 'SEU_TOKEN_AQUI') {
    console.error('❌ Token JWT não configurado!');
    console.log('\n💡 Configure a variável JWT_TOKEN:');
    console.log('   Exemplo: JWT_TOKEN=seu_token node scripts/test-upload.js');
    process.exit(1);
  }

  try {
    const url = new URL(SERVER_URL);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;

    // Preparar dados
    const fields = {
      titulo: 'Música de Teste',
      autor: 'Artista de Teste',
      ano: '2024',
      genero: 'Rock',
      album: 'Álbum de Teste',
      tags: 'teste,rock,upload'
    };

    const files = {
      arquivo: MUSIC_FILE
    };

    if (COVER_FILE && fs.existsSync(COVER_FILE)) {
      files.capa = COVER_FILE;
      console.log(`🖼️  Capa: ${COVER_FILE}`);
    }

    const { body, boundary, contentType } = createMultipartFormData(fields, files);

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: '/api/v1/musicas/upload',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': contentType,
        'Content-Length': body.length
      }
    };

    console.log('📤 Enviando upload...\n');

    const req = client.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        console.log(`📊 Status: ${res.statusCode} ${res.statusMessage}\n`);

        try {
          const jsonData = JSON.parse(data);

          if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log('✅ Upload realizado com sucesso!\n');
            console.log('📋 Resposta:');
            console.log(JSON.stringify(jsonData, null, 2));
            
            if (jsonData.data && jsonData.data.results) {
              const firstResult = Object.values(jsonData.data.results)[0];
              if (firstResult && firstResult.insertedId) {
                console.log(`\n🎵 ID da música: ${firstResult.insertedId}`);
                console.log(`🔗 URL: ${SERVER_URL}/api/v1/musicas/${firstResult.insertedId}`);
              }
            }
          } else {
            console.error('❌ Erro no upload:\n');
            console.error(JSON.stringify(jsonData, null, 2));
            
            if (jsonData.message) {
              console.error(`\n💡 Mensagem: ${jsonData.message}`);
            }
            
            if (jsonData.hint) {
              console.error(`💡 Dica: ${jsonData.hint}`);
            }
          }
        } catch (e) {
          console.error('❌ Erro ao parsear resposta:', e.message);
          console.error('Resposta recebida:', data);
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Erro na requisição:', error.message);
    });

    req.write(body);
    req.end();

  } catch (error) {
    console.error('❌ Erro ao fazer upload:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
  }
}

// Executar teste
if (require.main === module) {
  testUpload();
}

module.exports = { testUpload };

