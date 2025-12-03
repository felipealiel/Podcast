const { storage } = require('../config/firebase');
const fs = require('fs');
const path = require('path');

/**
 * Serviço para interagir com Firebase Storage
 */
class StorageService {
  /**
   * Upload de arquivo
   */
  async uploadFile(localFilePath, destinationPath, metadata = {}) {
    try {
      const bucket = storage.bucket();
      const fileName = path.basename(localFilePath);
      const filePath = destinationPath || `uploads/${fileName}`;
      
      // Upload do arquivo
      await bucket.upload(localFilePath, {
        destination: filePath,
        metadata: {
          metadata: metadata
        }
      });
      
      // Obter URL pública
      const file = bucket.file(filePath);
      await file.makePublic();
      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;
      
      return {
        url: publicUrl,
        path: filePath,
        name: fileName
      };
    } catch (error) {
      console.error('❌ Erro ao fazer upload para Firebase Storage:', error);
      throw error;
    }
  }

  /**
   * Upload de buffer (para arquivos em memória)
   */
  async uploadBuffer(buffer, destinationPath, metadata = {}) {
    try {
      const bucket = storage.bucket();
      const file = bucket.file(destinationPath);
      
      await file.save(buffer, {
        metadata: {
          metadata: metadata
        }
      });
      
      await file.makePublic();
      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${destinationPath}`;
      
      return {
        url: publicUrl,
        path: destinationPath
      };
    } catch (error) {
      console.error('❌ Erro ao fazer upload de buffer para Firebase Storage:', error);
      throw error;
    }
  }

  /**
   * Deletar arquivo
   */
  async deleteFile(filePath) {
    try {
      const bucket = storage.bucket();
      await bucket.file(filePath).delete();
      return true;
    } catch (error) {
      console.error('❌ Erro ao deletar arquivo do Firebase Storage:', error);
      throw error;
    }
  }

  /**
   * Obter URL pública de um arquivo
   */
  async getPublicUrl(filePath) {
    try {
      const bucket = storage.bucket();
      const file = bucket.file(filePath);
      
      // Verificar se arquivo existe
      const [exists] = await file.exists();
      if (!exists) {
        return null;
      }
      
      // Tornar público se não estiver
      try {
        await file.makePublic();
      } catch (error) {
        // Pode já estar público
      }
      
      return `https://storage.googleapis.com/${bucket.name}/${filePath}`;
    } catch (error) {
      console.error('❌ Erro ao obter URL pública:', error);
      throw error;
    }
  }

  /**
   * Gerar URL assinada (temporária)
   */
  async getSignedUrl(filePath, expiresInMinutes = 60) {
    try {
      const bucket = storage.bucket();
      const file = bucket.file(filePath);
      
      const [url] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + expiresInMinutes * 60 * 1000
      });
      
      return url;
    } catch (error) {
      console.error('❌ Erro ao gerar URL assinada:', error);
      throw error;
    }
  }
}

module.exports = new StorageService();

