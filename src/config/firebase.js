const admin = require('firebase-admin');
require('dotenv').config();

// Inicializar Firebase Admin SDK
let auth = null;
let db = null; // Firestore
let storage = null; // Firebase Storage

if (!admin.apps.length) {
  try {
    // Tentar carregar service account
    let serviceAccount = null;
    
    // Opção 1: Arquivo de service account
    if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
      try {
        const fs = require('fs');
        const path = require('path');
        const serviceAccountPath = path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
        
        if (fs.existsSync(serviceAccountPath)) {
          serviceAccount = require(serviceAccountPath);
          console.log('✅ Service Account carregado do arquivo');
        } else {
          console.log('⚠️  Arquivo de Service Account não encontrado:', serviceAccountPath);
        }
      } catch (error) {
        console.error('❌ Erro ao carregar Service Account do arquivo:', error.message);
      }
    }
    
    // Opção 2: Variáveis de ambiente
    if (!serviceAccount && process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY) {
      serviceAccount = {
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      };
      console.log('✅ Service Account carregado das variáveis de ambiente');
    }
    
    // Inicializar se tiver credenciais
    if (serviceAccount) {
      const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || "teste-projeto-21506.firebasestorage.app";
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: storageBucket
      });
      
      auth = admin.auth();
      db = admin.firestore();
      storage = admin.storage();
      
      console.log('✅ Firebase Admin SDK inicializado');
      console.log('✅ Firestore inicializado');
      console.log('✅ Firebase Storage inicializado');
    } else {
      console.log('⚠️  Firebase Admin SDK não configurado');
      console.log('   Tentando inicializar Firestore sem Service Account...');
      
      // Tentar inicializar Firestore usando apenas as credenciais do projeto
      try {
        const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || "teste-projeto-21506.firebasestorage.app";
        const projectId = process.env.FIREBASE_PROJECT_ID || "teste-projeto-21506";
        
        // Inicializar sem credenciais (modo emulator ou desenvolvimento)
        // Isso permite usar Firestore localmente ou com Application Default Credentials
        admin.initializeApp({
          projectId: projectId,
          storageBucket: storageBucket
        });
        
        db = admin.firestore();
        storage = admin.storage();
        
        console.log('✅ Firestore inicializado sem Service Account');
        console.log('⚠️  Firebase Auth não estará disponível sem Service Account');
        console.log('   Configure FIREBASE_SERVICE_ACCOUNT_PATH no .env para funcionalidade completa');
      } catch (initError) {
        console.log('⚠️  Não foi possível inicializar Firestore:', initError.message);
        console.log('   Configure FIREBASE_SERVICE_ACCOUNT_PATH no .env');
        console.log('   O sistema funcionará, mas dados não serão salvos no Firestore');
      }
    }
  } catch (error) {
    console.error('❌ Erro ao inicializar Firebase Admin SDK:', error.message);
    console.log('⚠️  Continuando sem Firebase Admin SDK');
  }
} else {
  auth = admin.auth();
  db = admin.firestore();
  storage = admin.storage();
}

// Configuração do cliente (para frontend)
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "AIzaSyC8A8Dd4ZAI9gjyUMBWXw3aFU1An840hNs",
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || "teste-projeto-21506.firebaseapp.com",
  projectId: process.env.FIREBASE_PROJECT_ID || "teste-projeto-21506",
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "teste-projeto-21506.firebasestorage.app",
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "68267070578",
  appId: process.env.FIREBASE_APP_ID || "1:68267070578:web:c5f03dc5de138282201eeb"
};

module.exports = {
  admin,
  firebaseConfig,
  auth,
  db, // Firestore
  storage // Firebase Storage
};

