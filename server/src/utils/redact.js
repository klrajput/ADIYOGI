'use strict';

/**
 * Privacy-preserving redaction helpers (docs/ARCHITECTURE.md §5, §12.2).
 *
 * The platform never stores or logs raw IP addresses, emails or tokens:
 *  - IPs become a truncated HMAC keyed by SESSION_SECRET (`ipHash`);
 *  - emails are masked for any human-readable diagnostic;
 *  - tokens are shown only as a short prefix plus length (enough to correlate
 *    two log lines, never enough to reuse the credential).
 */
const crypto = require('crypto');
const env = require('../config/env');

const IP_HASH_LENGTH = 32;
const UNKNOWN_IP = 'unknown';

/**
 * @returns {string} validated HMAC key for IP hashing
 */
function sessionSecret() {
  if (!env.sessionSecret) throw new Error('SESSION_SECRET is not configured');
  return env.sessionSecret;
}

/**
 * Normalise an IP address before hashing so equivalent spellings map to the same
 * pseudonym (IPv4-mapped IPv6 `::ffff:1.2.3.4`, bracketed IPv6 `[::1]`, stray ports).
 * @param {string} ip
 * @returns {string} normalised address or '' when unusable
 */
function normaliseIp(ip) {
  if (typeof ip !== 'string') return '';
  let value = ip.trim();
  if (!value) return '';

  // Strip IPv4-mapped IPv6 prefix (`::ffff:127.0.0.1` -> `127.0.0.1`).
  if (value.toLowerCase().startsWith('::ffff:')) value = value.slice(7);

  // Strip brackets around IPv6 literals (`[::1]` -> `::1`).
  if (value.startsWith('[') && value.endsWith(']')) value = value.slice(1, -1);

  // Express `req.ip` does not include a port, but tolerate accidental `host:port`
  // for IPv4 values only (an IPv6 address legitimately contains colons).
  if (value.includes('.') && value.includes(':') && value.split(':').length === 2) {
    const [host, port] = value.split(':');
    if (/^\d{1,5}$/.test(port)) value = host;
  }

  // Drop an IPv6 zone index (`fe80::1%en0`).
  const zoneIndex = value.indexOf('%');
  if (zoneIndex > 0) value = value.slice(0, zoneIndex);

  // Lower-case IPv6 spellings for a stable digest.
  return value.toLowerCase();
}

/**
 * HMAC-SHA256(ip, SESSION_SECRET), hex, truncated to 32 chars.
 * @param {string|undefined|null} ip
 * @returns {string} 32-char hex pseudonym, or 'unknown' when no IP is available
 */
function hashIp(ip) {
  const normalised = normaliseIp(ip);
  if (!normalised) return UNKNOWN_IP;
  const digest = crypto.createHmac('sha256', sessionSecret()).update(normalised).digest('hex');
  return digest.slice(0, IP_HASH_LENGTH);
}

/**
 * Mask an email for diagnostics: `alice@example.com` -> `a***@example.com`.
 * @param {string|undefined|null} email
 * @returns {string}
 */
function redactEmail(email) {
  if (typeof email !== 'string') return '***';
  const trimmed = email.trim();
  if (!trimmed) return '***';

  const at = trimmed.lastIndexOf('@');
  if (at <= 0 || at === trimmed.length - 1) return '***';

  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  const visible = local.slice(0, 1);
  return `${visible}***@${domain}`;
}

/**
 * Mask a token/secret for diagnostics: first 6 chars + `…` + total length.
 * @param {string|undefined|null} token
 * @returns {string}
 */
function redactToken(token) {
  if (typeof token !== 'string' || token.length === 0) return 'none';
  const prefix = token.slice(0, 6);
  return `${prefix}…${token.length}`;
}

module.exports = {
  hashIp,
  redactEmail,
  redactToken,
};
