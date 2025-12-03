const { db } = require('../config/firebase');

/**
 * Serviço para interagir com Firestore
 */
class FirestoreService {
  /**
   * Verificar se Firestore está disponível
   */
  _checkFirestore() {
    if (!db) {
      throw new Error('Firestore não está inicializado. Configure FIREBASE_SERVICE_ACCOUNT_PATH no .env');
    }
    // Verificar se db é um objeto válido do Firestore
    if (typeof db.collection !== 'function') {
      throw new Error('Firestore não está configurado corretamente. Configure FIREBASE_SERVICE_ACCOUNT_PATH no .env');
    }
  }

  /**
   * Criar documento
   */
  async create(collection, data) {
    try {
      this._checkFirestore();
      const docRef = await db.collection(collection).add({
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      return { id: docRef.id, ...data };
    } catch (error) {
      console.error(`❌ Erro ao criar documento em ${collection}:`, error);
      throw error;
    }
  }

  /**
   * Buscar documento por ID
   */
  async findById(collection, id) {
    try {
      this._checkFirestore();
      const doc = await db.collection(collection).doc(id).get();
      if (!doc.exists) {
        return null;
      }
      return { id: doc.id, ...doc.data() };
    } catch (error) {
      console.error(`❌ Erro ao buscar documento em ${collection}:`, error);
      throw error;
    }
  }

  /**
   * Buscar documentos por campo
   */
  async findByField(collection, field, value) {
    try {
      this._checkFirestore();
      const snapshot = await db.collection(collection)
        .where(field, '==', value)
        .get();
      
      if (snapshot.empty) {
        return null;
      }
      
      const doc = snapshot.docs[0];
      return { id: doc.id, ...doc.data() };
    } catch (error) {
      console.error(`❌ Erro ao buscar por campo em ${collection}:`, error);
      throw error;
    }
  }

  /**
   * Buscar todos os documentos
   */
  async findAll(collection, limit = null) {
    try {
      this._checkFirestore();
      let query = db.collection(collection);
      
      if (limit) {
        query = query.limit(limit);
      }
      
      const snapshot = await query.get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error(`❌ Erro ao buscar documentos em ${collection}:`, error);
      throw error;
    }
  }

  /**
   * Atualizar documento
   */
  async update(collection, id, data) {
    try {
      this._checkFirestore();
      await db.collection(collection).doc(id).update({
        ...data,
        updatedAt: new Date()
      });
      return await this.findById(collection, id);
    } catch (error) {
      console.error(`❌ Erro ao atualizar documento em ${collection}:`, error);
      throw error;
    }
  }

  /**
   * Deletar documento
   */
  async delete(collection, id) {
    try {
      this._checkFirestore();
      await db.collection(collection).doc(id).delete();
      return true;
    } catch (error) {
      console.error(`❌ Erro ao deletar documento em ${collection}:`, error);
      throw error;
    }
  }

  /**
   * Buscar múltiplos documentos por campo
   */
  async findManyByField(collection, field, value, limit = null) {
    try {
      this._checkFirestore();
      let query = db.collection(collection).where(field, '==', value);
      
      if (limit) {
        query = query.limit(limit);
      }
      
      const snapshot = await query.get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error(`❌ Erro ao buscar múltiplos documentos em ${collection}:`, error);
      throw error;
    }
  }

  /**
   * Buscar com múltiplas condições (AND)
   */
  async findWhere(collection, conditions, limit = null) {
    try {
      this._checkFirestore();
      let query = db.collection(collection);
      
      conditions.forEach(condition => {
        query = query.where(condition.field, condition.operator, condition.value);
      });
      
      if (limit) {
        query = query.limit(limit);
      }
      
      const snapshot = await query.get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error(`❌ Erro ao buscar com condições em ${collection}:`, error);
      throw error;
    }
  }
}

module.exports = new FirestoreService();

