'use strict';

const express = require('express');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const env = require('./config/env');
const logger = require('./config/logger');
const requestId = require('./middleware/requestId');
const requestLogger = require('./middleware/requestLogger');
const securityHeaders = require('./middleware/securityHeaders');
const corsMiddleware = require('./middleware/cors');
const { globalLimiter } = require('./middleware/rateLimiters');
const { requireCsrf } = require('./middleware/csrf');
const { loadIdentity } = require('./middleware/auth');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const apiRouter = require('./routes/v1');
const healthRoutes = require('./routes/v1/health.routes');
const docsRouter = require('./routes/v1/docs.routes');

/**
 * Build the Express application.
 * Kept free of side effects (no DB connection, no listen) so tests can import it.
 * @returns {import('express').Express}
 */
function createApp() {
  const app = express();

  app.disable('x-powered-by');
  // Render/Railway/Vercel terminate TLS in front of the app.
  app.set('trust proxy', 1);

  app.use(requestId);
  app.use(requestLogger);
  app.use(securityHeaders);
  app.use(corsMiddleware);
  app.use(globalLimiter);

  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));
  app.use(cookieParser());
  app.use(compression());

  // Resolve the caller's identity from signed cookies (never throws).
  app.use(loadIdentity);

  // Health checks stay unversioned and are never rate-limited per-session.
  app.get('/health', healthRoutes.liveness);
  app.get('/healthz', healthRoutes.liveness);
  app.get('/health/ready', healthRoutes.readiness);

  // API surface: CSRF is enforced for every state-changing request.
  app.use(env.apiBasePath, requireCsrf, apiRouter);

  // OpenAPI documentation.
  app.use('/api/docs', docsRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
module.exports.createApp = createApp;
module.exports.logger = logger;
