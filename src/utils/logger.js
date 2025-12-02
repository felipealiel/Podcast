const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

/**
 * RF09 - Logs e métricas em tempo real
 * Sistema de logging e métricas
 */

class Logger extends EventEmitter {
  constructor() {
    super();
    this.logsDir = path.join(process.cwd(), 'logs');
    this.metrics = {
      requests: 0,
      errors: 0,
      uploads: 0,
      streams: 0,
      downloads: 0,
      startTime: new Date()
    };
    
    // Garantir que o diretório existe
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }

    // Inicializar arquivo de log diário
    this.logFile = this.getLogFileName();
  }

  getLogFileName() {
    const date = new Date().toISOString().split('T')[0];
    return path.join(this.logsDir, `app-${date}.log`);
  }

  /**
   * Formatar mensagem de log
   */
  formatMessage(level, message, data = {}) {
    const timestamp = new Date().toISOString();
    return {
      timestamp,
      level,
      message,
      ...data
    };
  }

  /**
   * Escrever no arquivo de log
   */
  writeToFile(logEntry) {
    const logLine = JSON.stringify(logEntry) + '\n';
    const logFile = this.getLogFileName();
    
    // Se mudou o dia, usar novo arquivo
    if (logFile !== this.logFile) {
      this.logFile = logFile;
    }

    fs.appendFileSync(this.logFile, logLine, 'utf8');
  }

  /**
   * Log de informação
   */
  info(message, data = {}) {
    const logEntry = this.formatMessage('INFO', message, data);
    console.log(`[INFO] ${message}`, data);
    this.writeToFile(logEntry);
    this.emit('log', logEntry);
  }

  /**
   * Log de erro
   */
  error(message, error = null, data = {}) {
    const logEntry = this.formatMessage('ERROR', message, {
      ...data,
      error: error ? {
        message: error.message,
        stack: error.stack
      } : null
    });
    console.error(`[ERROR] ${message}`, error || data);
    this.writeToFile(logEntry);
    this.metrics.errors++;
    this.emit('error', logEntry);
  }

  /**
   * Log de aviso
   */
  warn(message, data = {}) {
    const logEntry = this.formatMessage('WARN', message, data);
    console.warn(`[WARN] ${message}`, data);
    this.writeToFile(logEntry);
    this.emit('warn', logEntry);
  }

  /**
   * Log de debug
   */
  debug(message, data = {}) {
    if (process.env.NODE_ENV === 'development') {
      const logEntry = this.formatMessage('DEBUG', message, data);
      console.debug(`[DEBUG] ${message}`, data);
      this.writeToFile(logEntry);
      this.emit('debug', logEntry);
    }
  }

  /**
   * Registrar requisição HTTP
   */
  logRequest(req, res, responseTime) {
    const logEntry = this.formatMessage('REQUEST', `${req.method} ${req.path}`, {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
      userId: req.user?._id?.toString()
    });

    this.writeToFile(logEntry);
    this.metrics.requests++;
    this.emit('request', logEntry);
  }

  /**
   * Registrar upload
   */
  logUpload(userId, fileType, fileSize, success = true) {
    const logEntry = this.formatMessage('UPLOAD', `Upload de ${fileType}`, {
      userId,
      fileType,
      fileSize,
      success
    });

    this.writeToFile(logEntry);
    if (success) {
      this.metrics.uploads++;
    }
    this.emit('upload', logEntry);
  }

  /**
   * Registrar stream
   */
  logStream(userId, contentId, contentType) {
    const logEntry = this.formatMessage('STREAM', `Stream de ${contentType}`, {
      userId,
      contentId,
      contentType
    });

    this.writeToFile(logEntry);
    this.metrics.streams++;
    this.emit('stream', logEntry);
  }

  /**
   * Registrar download
   */
  logDownload(userId, contentId, contentType) {
    const logEntry = this.formatMessage('DOWNLOAD', `Download de ${contentType}`, {
      userId,
      contentId,
      contentType
    });

    this.writeToFile(logEntry);
    this.metrics.downloads++;
    this.emit('download', logEntry);
  }

  /**
   * Obter métricas
   */
  getMetrics() {
    const uptime = Date.now() - this.metrics.startTime.getTime();
    return {
      ...this.metrics,
      uptime: Math.floor(uptime / 1000), // em segundos
      requestsPerMinute: this.metrics.requests / (uptime / 60000),
      errorsPerMinute: this.metrics.errors / (uptime / 60000)
    };
  }

  /**
   * Resetar métricas
   */
  resetMetrics() {
    this.metrics = {
      requests: 0,
      errors: 0,
      uploads: 0,
      streams: 0,
      downloads: 0,
      startTime: new Date()
    };
  }
}

// Singleton
const logger = new Logger();

module.exports = logger;

