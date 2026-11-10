'use strict';

/**
 * Structured application logger.
 *
 * Privacy rules (enforced by convention + code review):
 *  - never log request/response bodies, chat content, emails, raw IPs or tokens;
 *  - log identifiers only in hashed/truncated form via utils/redact.
 */
const winston = require('winston');
const env = require('./env');

const { combine, timestamp, errors, json, colorize, printf } = winston.format;

const devFormat = printf(({ level, message, timestamp: ts, requestId, ...meta }) => {
  const rid = requestId ? ` [${requestId}]` : '';
  const rest = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  return `${ts} ${level}${rid}: ${message}${rest}`;
});

const logger = winston.createLogger({
  level: env.logLevel,
  defaultMeta: { service: 'adiyogi-api', env: env.nodeEnv },
  format: combine(timestamp(), errors({ stack: true }), json()),
  transports: [new winston.transports.Console({ handleExceptions: false })],
  exitOnError: false,
});

if (env.isDev) {
  logger.clear();
  logger.add(
    new winston.transports.Console({
      format: combine(timestamp({ format: 'HH:mm:ss' }), colorize(), devFormat),
    })
  );
}

if (env.isTest) {
  logger.silent = true;
}

module.exports = logger;
