const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Garantir que os diretórios existam
const uploadDir = process.env.UPLOAD_PATH || './uploads';
const musicDir = path.join(uploadDir, 'musics');
const coverDir = path.join(uploadDir, 'covers');
const tempDir = process.env.TEMP_PATH || './temp';

[uploadDir, musicDir, coverDir, tempDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Configuração de armazenamento para músicas
const musicStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, musicDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'music-' + uniqueSuffix + ext);
  }
});

// Configuração de armazenamento para capas
const coverStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, coverDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'cover-' + uniqueSuffix + ext);
  }
});

// Filtros de arquivo
const musicFilter = (req, file, cb) => {
  // IMPORTANTE: Este filtro só deve ser usado para o campo "arquivo"
  // Se for chamado para outro campo, rejeitar
  if (file.fieldname && file.fieldname !== 'arquivo') {
    console.error('❌ [UPLOAD] musicFilter chamado incorretamente para campo:', file.fieldname);
    cb(new Error(`Filtro de música aplicado incorretamente ao campo "${file.fieldname}". Use o filtro correto.`), false);
    return;
  }
  
  const allowedMimes = [
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/wave',
    'audio/x-wav',
    'audio/aac',
    'audio/x-aac',
    'audio/ogg',
    'audio/oga',
    'audio/m4a',
    'audio/x-m4a',
    'audio/mp4',
    'audio/flac',
    'audio/x-flac',
    'application/octet-stream' // Permitir arquivos sem mimetype definido (será validado pela extensão)
  ];
  
  // Verificar mimetype
  if (allowedMimes.includes(file.mimetype)) {
    console.log('✅ [UPLOAD] Mimetype aceito:', file.mimetype, 'para arquivo:', file.originalname);
    cb(null, true);
  } else {
    // Se o mimetype não for reconhecido, verificar pela extensão do arquivo
    const ext = require('path').extname(file.originalname).toLowerCase();
    const allowedExts = ['.mp3', '.wav', '.aac', '.ogg', '.m4a', '.flac', '.mp4'];
    
    if (allowedExts.includes(ext)) {
      console.log('✅ [UPLOAD] Extensão aceita:', ext, 'para arquivo:', file.originalname, '(mimetype:', file.mimetype, ')');
      cb(null, true);
    } else {
      console.error('❌ [UPLOAD] Formato rejeitado:', {
        mimetype: file.mimetype,
        originalname: file.originalname,
        ext: ext,
        fieldname: file.fieldname
      });
      cb(new Error(`Formato de arquivo não suportado (${ext || file.mimetype}). Use MP3, WAV, AAC, OGG, M4A ou FLAC.`), false);
    }
  }
};

const imageFilter = (req, file, cb) => {
  const allowedMimes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif'
  ];
  
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Formato de imagem não suportado. Use JPEG, PNG, WEBP ou GIF.'), false);
  }
};

// Configurar tamanho máximo (100MB)
const maxFileSize = 100 * 1024 * 1024; // 100MB em bytes

// Upload de música
const uploadMusic = multer({
  storage: musicStorage,
  fileFilter: musicFilter,
  limits: {
    fileSize: maxFileSize
  }
});

// Upload de capa
const uploadCover = multer({
  storage: coverStorage,
  fileFilter: imageFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB para imagens
  }
});

// Filtro customizado para upload múltiplo (música + capa)
const musicAndCoverFilter = (req, file, cb) => {
  console.log(`🔍 [UPLOAD] Verificando arquivo: campo="${file.fieldname}", tipo="${file.mimetype}", nome="${file.originalname}"`);
  console.log(`🔍 [UPLOAD] Detalhes do arquivo:`, {
    fieldname: file.fieldname,
    mimetype: file.mimetype,
    originalname: file.originalname,
    size: file.size
  });
  
  // Se for o campo "arquivo", usar filtro de música
  if (file.fieldname === 'arquivo') {
    console.log('🎵 [UPLOAD] Aplicando filtro de música para campo "arquivo"');
    return musicFilter(req, file, cb);
  }
  
  // Se for o campo "capa", usar filtro de imagem
  if (file.fieldname === 'capa') {
    console.log('🖼️ [UPLOAD] Aplicando filtro de imagem para campo "capa"');
    const allowedMimes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/gif'
    ];
    
    // Verificar tamanho da imagem (máximo 5MB)
    const maxImageSize = 5 * 1024 * 1024; // 5MB
    if (file.size && file.size > maxImageSize) {
      console.error('❌ [UPLOAD] Imagem muito grande:', file.size, 'bytes (máximo:', maxImageSize, 'bytes)');
      cb(new Error('Imagem muito grande. Tamanho máximo: 5MB'), false);
      return;
    }
    
    if (allowedMimes.includes(file.mimetype)) {
      console.log('✅ [UPLOAD] Imagem aceita (mimetype):', file.mimetype, 'para arquivo:', file.originalname, 'tamanho:', file.size, 'bytes');
      cb(null, true);
      return;
    }
    
    // Verificar pela extensão também
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExts = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    
    if (allowedExts.includes(ext)) {
      console.log('✅ [UPLOAD] Imagem aceita (extensão):', ext, 'para arquivo:', file.originalname, 'tamanho:', file.size, 'bytes');
      cb(null, true);
      return;
    }
    
    // Se chegou aqui, a imagem não foi aceita
    console.error('❌ [UPLOAD] Formato de imagem rejeitado:', {
      mimetype: file.mimetype,
      originalname: file.originalname,
      ext: ext,
      fieldname: file.fieldname
    });
    cb(new Error(`Formato de imagem não suportado (${ext || file.mimetype}). Use JPEG, PNG, WEBP ou GIF.`), false);
    return;
  }
  
  // Campo desconhecido, rejeitar
  console.error('❌ [UPLOAD] Campo desconhecido:', file.fieldname);
  cb(new Error(`Campo de arquivo desconhecido: ${file.fieldname}. Use "arquivo" para música e "capa" para imagem.`), false);
};

// Upload múltiplo (música + capa)
// Usar limites diferentes para cada campo
const uploadMusicWithCover = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      // Salvar música no diretório de músicas
      if (file.fieldname === 'arquivo') {
        cb(null, musicDir);
      }
      // Salvar capa no diretório de capas
      else if (file.fieldname === 'capa') {
        cb(null, coverDir);
      }
      else {
        cb(new Error('Campo desconhecido'), null);
      }
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname);
      
      if (file.fieldname === 'arquivo') {
        cb(null, 'music-' + uniqueSuffix + ext);
      } else if (file.fieldname === 'capa') {
        cb(null, 'cover-' + uniqueSuffix + ext);
      } else {
        cb(new Error('Campo desconhecido'), null);
      }
    }
  }),
  fileFilter: musicAndCoverFilter,
  limits: {
    fileSize: maxFileSize, // Limite máximo (100MB) - será validado individualmente no filtro
    files: 2 // Máximo de 2 arquivos (música + capa)
  }
}).fields([
  { name: 'arquivo', maxCount: 1 },
  { name: 'capa', maxCount: 1 }
]);

module.exports = {
  uploadMusic,
  uploadCover,
  uploadMusicWithCover,
  musicDir,
  coverDir,
  tempDir
};

