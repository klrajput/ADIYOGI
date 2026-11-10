'use strict';

/**
 * Health endpoints (docs/ARCHITECTURE.md §4.3, §4.4).
 *
 * - liveness: process-only, never touches the database (safe for container probes);
 * - readiness: pings MongoDB through the Mongoose connection, 503 when unavailable.
 *
 * `app.js` mounts `liveness` at `/health`, `/healthz` and `readiness` at
 * `/health/ready`; `/api/v1/health` reuses `liveness`, so both are exported.
 */
const express = require('express');
const mongoose = require('mongoose');
const env = require('../../config/env');
const ApiError = require('../../utils/ApiError');

const CONNECTION_STATES = Object.freeze({
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
  99: 'uninitialized',
});

/**
 * Current Mongoose connection state label.
 * @returns {string}
 */
function dbState() {
  return CONNECTION_STATES[mongoose.connection.readyState] || 'unknown';
}

/**
 * @returns {{status:string, uptime:number, version:string, env:string}} health payload
 */
function healthData() {
  return {
    status: 'ok',
    uptime: Math.round(process.uptime()),
    version: env.version,
    env: env.nodeEnv,
  };
}

/**
 * GET /health — liveness probe, no DB dependency.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {import('express').Response}
 */
function liveness(req, res) {
  return res.status(200).json({
    success: true,
    message: 'ok',
    data: healthData(),
    meta: {},
  });
}

/**
 * GET /health/ready — readiness probe; 200 when Mongo answers a ping, else 503.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
async function readiness(req, res, next) {
  const state = dbState();
  try {
    if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
      throw ApiError.serviceUnavailable('Database is not connected', { db: state });
    }
    await mongoose.connection.db.admin().ping();
    return res.status(200).json({
      success: true,
      message: 'ready',
      data: { ...healthData(), db: state },
      meta: {},
    });
  } catch (error) {
    if (error instanceof ApiError) return next(error);
    return next(ApiError.serviceUnavailable('Database is unavailable', { db: state }));
  }
}

const router = express.Router();

router.get('/', liveness);
router.get('/ready', readiness);

module.exports = { liveness, readiness, router, dbState };
