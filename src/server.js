const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
require('dotenv').config();

const databaseManager = require('./config/database');
const { metricsMiddleware, errorMetricsMiddleware } = require('./middlewares/metrics');
const logger = require('./utils/logger');

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
    // Segurança - Configurar Helmet com políticas adequadas
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: [
            "'self'",
            "'unsafe-inline'", // Permitir scripts inline (necessário para algumas páginas)
            "'unsafe-eval'" // Permitir eval (pode ser necessário para algumas libs)
          ],
          styleSrc: [
            "'self'",
            "'unsafe-inline'", // Permitir estilos inline
            "https://fonts.googleapis.com"
          ],
          fontSrc: [
            "'self'",
            "https://fonts.gstatic.com"
          ],
          imgSrc: [
            "'self'",
            "data:", // Permitir data URIs para imagens
            "blob:", // Permitir blob URLs
            "https:" // Permitir imagens de qualquer origem HTTPS
          ],
          mediaSrc: [
            "'self'",
            "blob:", // Permitir blob URLs para streaming
            "data:" // Permitir data URIs
          ],
          connectSrc: [
            "'self'",
            "ws:", // WebSocket
            "wss:" // WebSocket seguro
          ],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
        }
      },
      crossOriginEmbedderPolicy: false, // Desabilitar para permitir recursos externos
      crossOriginResourcePolicy: { policy: "cross-origin" } // Permitir recursos cross-origin
    }));
    
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
    
    // RF09 - Métricas e logs
    this.app.use(metricsMiddleware);
    
    // Body parser
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    
    // Arquivos estáticos
    this.app.use(express.static('public', {
      setHeaders: (res, path) => {
        // Permitir CORS para arquivos estáticos
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
        
        // Headers específicos para mídia
        if (path.match(/\.(mp3|wav|aac|ogg|m4a|flac)$/)) {
          res.set('Content-Type', 'audio/mpeg');
          res.set('Accept-Ranges', 'bytes');
        }
        if (path.match(/\.(jpg|jpeg|png|gif|webp)$/)) {
          res.set('Content-Type', 'image/jpeg');
        }
      }
    }));
    
    // Servir uploads com headers adequados
    this.app.use('/uploads', express.static('uploads', {
      setHeaders: (res, filePath) => {
        // Permitir CORS
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
        
        // Headers para streaming de áudio
        if (filePath.match(/\.(mp3|wav|aac|ogg|m4a|flac)$/)) {
          res.set('Content-Type', 'audio/mpeg');
          res.set('Accept-Ranges', 'bytes');
          res.set('Cache-Control', 'public, max-age=31536000'); // Cache de 1 ano
        }
        
        // Headers para imagens
        if (filePath.match(/\.(jpg|jpeg|png|gif|webp)$/)) {
          res.set('Cache-Control', 'public, max-age=31536000');
        }
      }
    }));
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
    this.app.use('/api/v1/playlists', require('./routes/playlist.routes'));
    this.app.use('/api/v1/favoritos', require('./routes/favorito.routes'));
    this.app.use('/api/v1/historico', require('./routes/historico.routes'));
    this.app.use('/api/v1/musicas', require('./routes/musica.routes'));
    this.app.use('/api/v1/busca', require('./routes/busca.routes'));
    this.app.use('/api/v1/streaming', require('./routes/streaming.routes'));
    this.app.use('/api/v1/metrics', require('./routes/metrics.routes'));
    this.app.use('/api/v1/recomendacoes', require('./routes/recomendacao.routes'));
    this.app.use('/api/v1/admin', require('./routes/admin.routes'));
    // this.app.use('/api/v1/podcasts', require('./routes/podcasts'));
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
    // RF09 - Middleware de métricas de erro
    this.app.use(errorMetricsMiddleware);
    
    this.app.use((err, req, res, next) => {
      logger.error('Erro na requisição', err, {
        method: req.method,
        path: req.path,
        statusCode: err.statusCode || 500
      });

      // Verificar se a resposta já foi enviada
      if (res.headersSent) {
        logger.warn('Erro após resposta enviada', err, {
          method: req.method,
          path: req.path
        });
        return next(err);
      }

      const statusCode = err.statusCode || 500;
      const message = err.message || 'Erro interno do servidor';

      try {
        res.status(statusCode).json({
          success: false,
          error: {
            message,
            ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
          }
        });
      } catch (sendError) {
        // Se não conseguir enviar resposta, apenas logar
        logger.error('Erro crítico ao enviar resposta de erro', sendError);
      }
    });

    // Tratamento de erros não capturados
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection', reason instanceof Error ? reason : new Error(String(reason)), {
        promise: promise.toString()
      });
      // Não encerrar o processo em desenvolvimento
      if (process.env.NODE_ENV === 'production') {
        console.error('Unhandled Rejection - Encerrando processo');
        process.exit(1);
      }
    });

    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception', error);
      console.error('Uncaught Exception:', error);
      // Em produção, encerrar graciosamente
      if (process.env.NODE_ENV === 'production') {
        this.shutdown();
      }
    });
  }

  /**
   * Conectar ao banco de dados
   */
  async connectDatabase() {
    try {
      await databaseManager.connectAllClusters();
      console.log('✅ Todos os clusters conectados');
    } catch (error) {
      console.error('❌ Erro ao conectar aos clusters:', error);
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

      // Criar servidor HTTP com timeout aumentado para uploads
      const http = require('http');
      const server = http.createServer(this.app);
      
      // Aumentar timeout para uploads grandes (10 minutos)
      // Isso é necessário para arquivos grandes e processamento de áudio
      server.timeout = 600000; // 10 minutos
      server.keepAliveTimeout = 120000; // 2 minutos
      server.headersTimeout = 125000; // 2 minutos e 5 segundos
      
      // Desabilitar timeout automático para requisições de upload
      // O timeout será gerenciado manualmente no middleware
      
      // Armazenar referência do servidor para shutdown
      this.server = server;
      
      // Tratamento de erros do servidor
      server.on('error', (error) => {
        logger.error('Erro no servidor HTTP', error);
        if (error.code === 'EADDRINUSE') {
          console.error(`❌ Porta ${this.port} já está em uso`);
        } else {
          console.error('❌ Erro no servidor:', error);
        }
      });
      
      // Tratamento de erros de conexão (evitar crash)
      server.on('clientError', (err, socket) => {
        logger.warn('Erro de cliente HTTP', err);
        if (!socket.destroyed) {
          socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
        }
      });
      
      // Prevenir crash por erros não tratados em requisições
      server.on('request', (req, res) => {
        // Para rotas de upload, usar timeout maior
        const isUploadRoute = req.path && req.path.includes('/upload');
        const timeoutDuration = isUploadRoute ? 600000 : 300000; // 10 min para upload, 5 min para outros
        
        // Adicionar timeout na requisição para evitar conexões penduradas
        req.setTimeout(timeoutDuration, () => {
          if (!res.headersSent) {
            logger.warn('Timeout da requisição', {
              method: req.method,
              path: req.path,
              timeout: timeoutDuration
            });
            try {
              res.status(408).json({
                success: false,
                message: 'Tempo limite da requisição excedido'
              });
            } catch (e) {
              logger.error('Erro ao enviar resposta de timeout', e);
            }
          }
        });
        
        // Para rotas de upload, não fechar conexão prematuramente
        if (isUploadRoute) {
          // Desabilitar timeout automático do socket para uploads
          req.socket.setTimeout(0); // Sem timeout no socket
        }
        
        // Garantir que erros não fechem o servidor
        res.on('error', (err) => {
          if (!res.headersSent) {
            logger.warn('Erro ao enviar resposta', err, {
              method: req.method,
              path: req.path
            });
            try {
              res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
              });
            } catch (e) {
              // Se não conseguir enviar resposta, apenas logar
              logger.error('Erro crítico ao enviar resposta', e);
            }
          }
        });
      });
      
      // Iniciar servidor
      server.listen(this.port, () => {
        console.log('');
        console.log('🎵 PobreFy Streaming API');
        console.log('================================');
        console.log(`🚀 Servidor rodando na porta ${this.port}`);
        console.log(`🌍 Ambiente: ${process.env.NODE_ENV || 'development'}`);
        console.log(`📡 URL: http://localhost:${this.port}`);
        console.log(`💚 Health Check: http://localhost:${this.port}/health`);
        console.log(`📊 Métricas: http://localhost:${this.port}/api/v1/metrics/system`);
        console.log('================================');
        console.log('');
        
        logger.info('Servidor iniciado com sucesso', {
          port: this.port,
          environment: process.env.NODE_ENV || 'development'
        });
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
      // Fechar servidor HTTP
      if (this.server) {
        this.server.close(() => {
          console.log('✅ Servidor HTTP fechado');
        });
      }
      
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
