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
  const allowedMimes = [
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/aac',
    'audio/ogg',
    'audio/m4a',
    'audio/flac',
    'audio/x-m4a'
  ];
  
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Formato de arquivo não suportado. Use MP3, WAV, AAC, OGG, M4A ou FLAC.'), false);
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

// Upload múltiplo (música + capa)
const uploadMusicWithCover = multer({
  storage: musicStorage,
  fileFilter: musicFilter,
  limits: {
    fileSize: maxFileSize
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

