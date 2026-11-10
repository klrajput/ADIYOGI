'use strict';

/**
 * API documentation routes (mounted by app.js at `/api/docs`).
 *
 * - `GET /api/docs/openapi.json` — the OpenAPI 3.0.3 document (config/swagger.js);
 * - `GET /api/docs` — Swagger UI rendering that document.
 *
 * Swagger UI needs inline initialisation script/style, so this router — and only this
 * router — relaxes the global CSP to allow inline scripts/styles. No API route ever
 * returns HTML and no user content is rendered here.
 */
const express = require('express');
const swaggerUi = require('swagger-ui-express');
const spec = require('../../config/swagger');

const DOCS_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const SWAGGER_OPTIONS = {
  customSiteTitle: 'AdiYogi API Reference',
  customCss: '.swagger-ui .topbar { display: none }',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    docExpansion: 'list',
    filter: true,
    tryItOutEnabled: true,
  },
};

const router = express.Router();

router.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', DOCS_CSP);
  next();
});

router.get('/openapi.json', (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.json(spec);
});

router.use('/', swaggerUi.serve, swaggerUi.setup(spec, SWAGGER_OPTIONS));

module.exports = router;
