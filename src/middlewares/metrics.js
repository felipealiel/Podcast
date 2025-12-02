const logger = require('../utils/logger');

/**
 * RF09 - Logs e métricas em tempo real
 * Middleware para coletar métricas de requisições
 */

/**
 * Middleware de métricas
 */
const metricsMiddleware = (req, res, next) => {
  const startTime = Date.now();

  // Interceptar fim da resposta
  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    logger.logRequest(req, res, responseTime);
  });

  next();
};

/**
 * Middleware de erro para métricas
 */
const errorMetricsMiddleware = (err, req, res, next) => {
  logger.error('Erro na requisição', err, {
    method: req.method,
    path: req.path,
    ip: req.ip
  });
  next(err);
};

module.exports = {
  metricsMiddleware,
  errorMetricsMiddleware
};

