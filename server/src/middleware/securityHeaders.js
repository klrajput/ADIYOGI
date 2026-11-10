'use strict';

/**
 * HTTP security headers (docs/ARCHITECTURE.md §12.1).
 *
 * The API is a JSON service. Its CSP is locked down to `default-src 'none'` because
 * an API response should never load or execute anything. The React SPA is served by a
 * static host (Vercel/Netlify) and gets its own CSP there — see docs/SECURITY.md.
 *
 * The Swagger UI bundle mounted at `/api/docs` is the only HTML surface this server
 * serves, so it receives a separate, slightly relaxed CSP (it needs inline
 * script/style; still no `unsafe-eval`, no framing, same-origin only).
 *
 * HSTS is production-only: in development it would pin `localhost` to HTTPS.
 */
const helmet = require('helmet');
const env = require('../config/env');

const DOCS_PATH_PREFIX = '/api/docs';

/**
 * Shared helmet options for every response.
 * @returns {object}
 */
function baseOptions() {
  return {
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    // The API never needs to be embedded; JSON has no inline content to protect,
    // this mainly blocks accidental <script>/<img> inclusion by other origins.
    crossOriginResourcePolicy: { policy: 'same-origin' },
    originAgentCluster: true,
    referrerPolicy: { policy: 'no-referrer' },
    strictTransportSecurity: env.isProd
      ? { maxAge: 15_552_000, includeSubDomains: true, preload: false }
      : false,
    xContentTypeOptions: true,
    xDnsPrefetchControl: { allow: false },
    xDownloadOptions: true,
    xFrameOptions: { action: 'deny' },
    xPermittedCrossDomainPolicies: { permittedPolicies: 'none' },
    xPoweredBy: false,
    xXssProtection: false,
  };
}

/**
 * CSP for JSON API responses: nothing may be loaded, framed or executed.
 * @returns {object}
 */
function apiCsp() {
  const directives = {
    'default-src': ["'none'"],
    'base-uri': ["'none'"],
    'connect-src': ["'none'"],
    'font-src': ["'none'"],
    'form-action': ["'none'"],
    'frame-ancestors': ["'none'"],
    'img-src': ["'none'"],
    'object-src': ["'none'"],
    'script-src': ["'none'"],
    'style-src': ["'none'"],
  };
  if (env.isProd) directives['upgrade-insecure-requests'] = [];

  return { useDefaults: false, directives };
}

/**
 * CSP for the server-rendered Swagger UI only.
 * @returns {object}
 */
function docsCsp() {
  const directives = {
    'default-src': ["'self'"],
    'base-uri': ["'self'"],
    'connect-src': ["'self'"],
    'font-src': ["'self'", 'data:'],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
    'img-src': ["'self'", 'data:'],
    'object-src': ["'none'"],
    'script-src': ["'self'", "'unsafe-inline'"],
    'style-src': ["'self'", "'unsafe-inline'"],
  };
  if (env.isProd) directives['upgrade-insecure-requests'] = [];

  return { useDefaults: false, directives };
}

const apiHeaders = helmet({ ...baseOptions(), contentSecurityPolicy: apiCsp() });
const docsHeaders = helmet({ ...baseOptions(), contentSecurityPolicy: docsCsp() });

/**
 * Selects the API or docs helmet instance per request.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {void}
 */
function securityHeaders(req, res, next) {
  const path = req.path || '';
  if (path === DOCS_PATH_PREFIX || path.startsWith(`${DOCS_PATH_PREFIX}/`)) {
    return docsHeaders(req, res, next);
  }
  return apiHeaders(req, res, next);
}

module.exports = securityHeaders;
