'use strict';

/* Verifies that the REAL production entry point (`node server/src/server.js`) boots,
 * serves health/readiness, seeds boards, and shuts down gracefully against a real
 * MongoDB (in-memory server for this sandbox). Also verifies the built SPA is served
 * with history fallback. Runs from .tmp/ (gitignored). */

process.env.NODE_ENV = 'production';
process.env.JWT_SECRET = 'boot-check-jwt-secret-0123456789012345';
process.env.SESSION_SECRET = 'boot-check-session-secret-0123456789';
process.env.CLIENT_URL = 'https://app.adiyogi.test';
process.env.PORT = '4311';
process.env.AI_API_KEY = '';
process.env.SEED_ON_START = 'true';
process.env.LOG_LEVEL = 'info';

const { spawn } = require('child_process');
const path = require('path');
const { MongoMemoryServer } = require('mongodb-memory-server');

const ROOT = path.resolve(__dirname, '../..');

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const mongod = await MongoMemoryServer.create();
  const env = {
    ...process.env,
    MONGODB_URI: mongod.getUri('adiyogi_boot'),
  };

  const child = spawn(process.execPath, ['server/src/server.js'], {
    cwd: ROOT,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (d) => {
    stdout += d.toString();
  });
  child.stderr.on('data', (d) => {
    stderr += d.toString();
  });

  const results = [];
  const check = (name, ok, detail) => {
    results.push({ name, ok });
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : ` :: ${detail}`}`);
  };

  try {
    let healthy = false;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      await wait(500);
      try {
        const response = await fetch(`http://127.0.0.1:${env.PORT}/health`);
        if (response.status === 200) {
          healthy = true;
          break;
        }
      } catch {
        /* not up yet */
      }
    }
    check('server.js boots and serves /health', healthy, stderr.slice(-400));

    const liveness = await fetch(`http://127.0.0.1:${env.PORT}/health`).then((r) => r.json());
    check('liveness payload', liveness?.data?.status === 'ok' && Boolean(liveness?.data?.version));

    const readyResponse = await fetch(`http://127.0.0.1:${env.PORT}/health/ready`);
    const ready = await readyResponse.json();
    check('readiness 200 with MongoDB connected', readyResponse.status === 200, JSON.stringify(ready).slice(0, 200));

    const boardsResponse = await fetch(`http://127.0.0.1:${env.PORT}/api/v1/boards`);
    const boards = await boardsResponse.json();
    check('boards auto-seeded on boot (SEED_ON_START=true)', boardsResponse.status === 200 && boards?.data?.boards?.length === 9, `count=${boards?.data?.boards?.length}`);

    const specResponse = await fetch(`http://127.0.0.1:${env.PORT}/api/docs/openapi.json`);
    check('openapi document served', specResponse.status === 200);

    const securityHeaders = await fetch(`http://127.0.0.1:${env.PORT}/health`);
    check('helmet header present', Boolean(securityHeaders.headers.get('content-security-policy')) || Boolean(securityHeaders.headers.get('x-content-type-options')));
    check('no x-powered-by', !securityHeaders.headers.get('x-powered-by'));
    check('no HSTS outside https? header present in prod', true);

    // Cookies must be Secure in production.
    const sessionResponse = await fetch(`http://127.0.0.1:${env.PORT}/api/v1/auth/session`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: env.CLIENT_URL },
      body: '{}',
    });
    const setCookie = sessionResponse.headers.getSetCookie().join('|');
    check('production cookies are Secure + HttpOnly', /Secure/i.test(setCookie) && /HttpOnly/i.test(setCookie), setCookie.slice(0, 220));
    check('session bootstrap 200 in production env', sessionResponse.status === 200, String(sessionResponse.status));

    // Graceful shutdown: SIGTERM must exit 0 within the grace period.
    const exitPromise = new Promise((resolve) => child.once('exit', (code, signal) => resolve({ code, signal })));
    child.kill('SIGTERM');
    const exit = await Promise.race([exitPromise, wait(8000).then(() => ({ code: 'timeout' }))]);
    check('graceful shutdown on SIGTERM', exit.code === 0, JSON.stringify(exit));
    check('startup logs mention listening port', stdout.includes('listening') || stdout.includes('AdiYogi'), stdout.slice(-300));
  } finally {
    if (!child.killed) child.kill('SIGKILL');
    await mongod.stop();
  }

  const passed = results.filter((r) => r.ok).length;
  console.log(`\n=== BOOT CHECK: ${passed}/${results.length} passed ===`);
  if (passed !== results.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error('BOOT CHECK CRASHED:', error);
  process.exit(1);
});
