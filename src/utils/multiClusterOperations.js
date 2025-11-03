const databaseManager = require('../config/database');

/**
 * Helper para operações em múltiplos clusters
 */
class MultiClusterOperations {
  /**
   * Cria um documento em todos os clusters
   */
  static async create(collectionName, data) {
    return await databaseManager.writeToAllClusters(
      collectionName,
      'create',
      data
    );
  }

  /**
   * Salva um documento em todos os clusters
   */
  static async save(document) {
    const collectionName = document.constructor.modelName.toLowerCase() + 's';
    const data = document.toObject();
    delete data._id; // Permitir que cada cluster gere seu próprio ID
    
    return await databaseManager.writeToAllClusters(
      collectionName,
      'create',
      data
    );
  }

  /**
   * Atualiza um documento em todos os clusters
   */
  static async updateOne(collectionName, filter, update) {
    return await databaseManager.writeToAllClusters(
      collectionName,
      'updateOne',
      filter,
      update
    );
  }

  /**
   * Atualiza múltiplos documentos em todos os clusters
   */
  static async updateMany(collectionName, filter, update) {
    return await databaseManager.writeToAllClusters(
      collectionName,
      'updateMany',
      filter,
      update
    );
  }

  /**
   * Deleta um documento em todos os clusters
   */
  static async deleteOne(collectionName, filter) {
    return await databaseManager.writeToAllClusters(
      collectionName,
      'deleteOne',
      filter
    );
  }

  /**
   * Deleta múltiplos documentos em todos os clusters
   */
  static async deleteMany(collectionName, filter) {
    return await databaseManager.writeToAllClusters(
      collectionName,
      'deleteMany',
      filter
    );
  }

  /**
   * Busca um documento (do PRIMARY ou SECONDARY se PRIMARY offline)
   */
  static async findOne(collectionName, filter) {
    return await databaseManager.readFromCluster(
      collectionName,
      'findOne',
      filter
    );
  }

  /**
   * Busca múltiplos documentos
   */
  static async find(collectionName, filter) {
    return await databaseManager.readFromCluster(
      collectionName,
      'find',
      filter
    );
  }

  /**
   * Busca por ID
   */
  static async findById(collectionName, id) {
    return await databaseManager.readFromCluster(
      collectionName,
      'findById',
      id
    );
  }

  /**
   * Conta documentos
   */
  static async countDocuments(collectionName, filter = {}) {
    return await databaseManager.readFromCluster(
      collectionName,
      'countDocuments',
      filter
    );
  }
}

module.exports = MultiClusterOperations;

