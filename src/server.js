const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
require('dotenv').config();

const databaseManager = require('./config/database');

class Server {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3000;
    this.setupMiddlewares();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * Configurar middlewares
   */
  setupMiddlewares() {
    // Segurança
    this.app.use(helmet());
    
    // CORS
    this.app.use(cors({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
      credentials: true
    }));
    
    // Compressão
    this.app.use(compression());
    
    // Logging
    if (process.env.NODE_ENV === 'development') {
      this.app.use(morgan('dev'));
    } else {
      this.app.use(morgan('combined'));
    }
    
    // Body parser
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    
    // Arquivos estáticos
    this.app.use(express.static('public'));
    this.app.use('/uploads', express.static('uploads'));
  }

  /**
   * Configurar rotas
   */
  setupRoutes() {
    // Rota de health check
    this.app.get('/health', (req, res) => {
      const dbStatus = databaseManager.getConnectionStatus();
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: dbStatus,
        uptime: process.uptime()
      });
    });

    // Rota principal
    this.app.get('/', (req, res) => {
      res.json({
        message: 'PobreFy Streaming API',
        version: '1.0.0',
        endpoints: {
          health: '/health',
          api: '/api/v1'
        }
      });
    });

    // Rotas da API
    this.app.use('/api/v1/auth', require('./routes/auth.routes'));
    // this.app.use('/api/v1/podcasts', require('./routes/podcasts'));
    // this.app.use('/api/v1/musicas', require('./routes/musicas'));
    // this.app.use('/api/v1/playlists', require('./routes/playlists'));
    // this.app.use('/api/v1/assinaturas', require('./routes/assinaturas'));

    // Rota 404
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Rota não encontrada',
        path: req.originalUrl
      });
    });
  }

  /**
   * Configurar tratamento de erros
   */
  setupErrorHandling() {
    this.app.use((err, req, res, next) => {
      console.error('Erro:', err);

      const statusCode = err.statusCode || 500;
      const message = err.message || 'Erro interno do servidor';

      res.status(statusCode).json({
        error: {
          message,
          ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
        }
      });
    });

    // Tratamento de erros não capturados
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });

    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
      process.exit(1);
    });
  }

  /**
   * Conectar ao banco de dados
   */
  async connectDatabase() {
    try {
      await databaseManager.connectMain();
      console.log('✅ Banco de dados conectado');
      
      // Conectar aos shards (opcional)
      if (process.env.MONGODB_SHARD_URI_1) {
        await databaseManager.connectShards();
        console.log('✅ Shards conectados');
      }
    } catch (error) {
      console.error('❌ Erro ao conectar ao banco de dados:', error);
      process.exit(1);
    }
  }

  /**
   * Iniciar servidor
   */
  async start() {
    try {
      // Conectar ao banco
      await this.connectDatabase();

      // Iniciar servidor
      this.app.listen(this.port, () => {
        console.log('');
        console.log('🎵 PobreFy Streaming API');
        console.log('================================');
        console.log(`🚀 Servidor rodando na porta ${this.port}`);
        console.log(`🌍 Ambiente: ${process.env.NODE_ENV || 'development'}`);
        console.log(`📡 URL: http://localhost:${this.port}`);
        console.log(`💚 Health Check: http://localhost:${this.port}/health`);
        console.log('================================');
        console.log('');
      });

      // Tratamento de encerramento gracioso
      process.on('SIGTERM', () => this.shutdown());
      process.on('SIGINT', () => this.shutdown());
    } catch (error) {
      console.error('❌ Erro ao iniciar servidor:', error);
      process.exit(1);
    }
  }

  /**
   * Encerramento gracioso
   */
  async shutdown() {
    console.log('\n🔴 Encerrando servidor...');
    
    try {
      // Desconectar do banco
      await databaseManager.disconnectAll();
      console.log('✅ Banco de dados desconectado');
      
      console.log('✅ Servidor encerrado com sucesso');
      process.exit(0);
    } catch (error) {
      console.error('❌ Erro ao encerrar servidor:', error);
      process.exit(1);
    }
  }
}

// Iniciar servidor
const server = new Server();
server.start();

module.exports = server;
