process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'reload-check-jwt-secret-0123456789';
process.env.SESSION_SECRET = 'reload-check-session-secret-0123456789';
process.env.AI_API_KEY = '';
process.env.LOG_LEVEL = 'error';
const http = require('http');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { URLSearchParams } = require('url');

function jar() {
  const store = new Map();
  return {
    header: () => [...store.entries()].map(([k, v]) => `${k}=${v}`).join('; '),
    absorb(res) {
      (res.headers.getSetCookie?.() || []).forEach((c) => {
        const [pair] = c.split(';');
        const i = pair.indexOf('=');
        store.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
      });
    },
    get: (n) => store.get(n),
    remove: (n) => store.delete(n),
    names: () => [...store.keys()],
  };
}

(async () => {
  const mongod = await MongoMemoryServer.create();
  const { connectDatabase } = require('../../server/src/config/db');
  await connectDatabase(mongod.getUri());
  const server = http.createServer(require('../../server/src/app')());
  await new Promise((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;

  const call = async (j, method, path, body, withCsrf = true, origin) => {
    const headers = { Accept: 'application/json' };
    if (origin) headers.Origin = origin;
    if (j.header()) headers.Cookie = j.header();
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (withCsrf && j.get('ay_csrf') && method !== 'GET') headers['x-csrf-token'] = j.get('ay_csrf');
    const res = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    j.absorb(res);
    const text = await res.text();
    return { status: res.status, json: text ? JSON.parse(text) : null };
  };

  const results = [];
  const check = (n, ok, d) => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${ok ? '' : ' :: ' + (d || '')}`); };

  const a = jar();
  let r = await call(a, 'GET', '/api/v1/auth/csrf');
  check('GET /auth/csrf without session issues token', r.status === 200 && Boolean(r.json?.data?.csrfToken));
  r = await call(a, 'POST', '/api/v1/auth/session', {});
  check('first visit: session created', r.status === 200 && Boolean(r.json?.data?.identity));

  // Simulate a page reload in a cross-origin deployment: JS forgets everything and can
  // only rely on the httpOnly cookies the browser still sends.
  const reload = jar();
  reload.absorb({ headers: { getSetCookie: () => [`ay_rt=${a.get('ay_rt')}; Path=/api/v1/auth; HttpOnly`] } });
  check('reload jar has refresh cookie but no readable csrf', Boolean(reload.get('ay_rt')) && !reload.get('ay_csrf'));

  // Old (buggy) order: session bootstrap first with an existing refresh cookie.
  const buggy = jar();
  buggy.absorb({ headers: { getSetCookie: () => [`ay_rt=${a.get('ay_rt')}; Path=/api/v1/auth; HttpOnly`] } });
  r = await call(buggy, 'POST', '/api/v1/auth/session', {}, false, 'https://app.adiyogi.test');
  check('PROOF: session-first bootstrap without CSRF is rejected (403)', r.status === 403 && r.json?.error?.code === 'CSRF_INVALID', String(r.status));

  // New order: GET /auth/csrf first, then bootstrap with the token.
  r = await call(reload, 'GET', '/api/v1/auth/csrf', undefined, true, 'https://app.adiyogi.test');
  check('GET /auth/csrf on reload returns token', r.status === 200 && Boolean(r.json?.data?.csrfToken));
  r = await call(reload, 'POST', '/api/v1/auth/session', {}, true, 'https://app.adiyogi.test');
  check('reload bootstrap succeeds with csrf-first order', r.status === 200 && Boolean(r.json?.data?.identity), JSON.stringify(r.json).slice(0, 200));
  check('body carries csrfToken for cross-origin clients', Boolean(r.json?.data?.csrfToken));

  await new Promise((res) => server.close(res));
  await mongod.stop();
  const passed = results.filter(Boolean).length;
  console.log(`\n=== RELOAD CHECK: ${passed}/${results.length} passed ===`);
  if (passed !== results.length) process.exitCode = 1;
  process.exit();
})().catch((e) => { console.error(e); process.exit(1); });
