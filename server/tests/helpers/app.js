'use strict';

/**
 * HTTP test harness built on supertest.
 *
 * Exposes "agents" — cookie-aware supertest clients that behave like a browser tab:
 *  - `anonymousAgent()` POSTs `/auth/session` once and keeps the httpOnly cookies;
 *  - `loginAgent()` / `memberAgent()` / `moderatorAgent()` / `adminAgent()` create a
 *    real User row (password hashed with the production cost) and log in through the
 *    public API, so integration tests exercise the real auth stack;
 *  - every agent exposes `authGet/authPost/authPatch/authDelete` which attach the
 *    double-submit `x-csrf-token` header, exactly like the browser client does.
 *
 * The Express app is created once per test file (`createApp()` is side-effect free:
 * no listen, no DB connection) and reused.
 */
const request = require('supertest');

const createApp = require('../../src/app');
const env = require('../../src/config/env');
const factories = require('./factories');

const API_BASE = env.apiBasePath || '/api/v1';
const CSRF_HEADER = 'x-csrf-token';

/** @type {import('express').Express|null} */
let app = null;

/**
 * Lazily create (and memoise) the Express app for this test file.
 * @returns {import('express').Express}
 */
function getApp() {
  if (!app) app = createApp();
  return app;
}

/**
 * Prefix an endpoint path with the API base path.
 * @param {string} path e.g. '/threads'
 * @returns {string} e.g. '/api/v1/threads'
 */
function apiPath(path) {
  if (typeof path !== 'string' || path.length === 0) throw new TypeError('apiPath requires a path');
  if (path.startsWith(API_BASE)) return path;
  return `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * Unversioned path helper (health checks live outside the API base path).
 * @param {string} path
 * @returns {string}
 */
function rootPath(path) {
  return path.startsWith('/') ? path : `/${path}`;
}

/**
 * Parse `Set-Cookie` headers into `{ [name]: value }`.
 * @param {import('supertest').Response} res
 * @returns {Record<string,string>}
 */
function cookiesFrom(res) {
  const headers = res && res.headers ? res.headers['set-cookie'] : null;
  const list = Array.isArray(headers) ? headers : headers ? [headers] : [];
  /** @type {Record<string,string>} */
  const cookies = {};
  list.forEach((entry) => {
    const pair = String(entry).split(';')[0];
    const separator = pair.indexOf('=');
    if (separator <= 0) return;
    const name = pair.slice(0, separator).trim();
    cookies[name] = decodeURIComponent(pair.slice(separator + 1));
  });
  return cookies;
}

/**
 * Return the raw `Set-Cookie` header for one cookie (or undefined).
 * @param {import('supertest').Response} res
 * @param {string} name
 * @returns {string|undefined}
 */
function rawCookie(res, name) {
  const headers = res && res.headers ? res.headers['set-cookie'] : null;
  const list = Array.isArray(headers) ? headers : headers ? [headers] : [];
  return list.find((entry) => String(entry).startsWith(`${name}=`));
}

/**
 * Parse the attributes of a `Set-Cookie` entry.
 * @param {import('supertest').Response} res
 * @param {string} name
 * @returns {{value:string,httpOnly:boolean,secure:boolean,sameSite:string|null,path:string|null,maxAge:number|null}}
 */
function cookieFlags(res, name) {
  const raw = rawCookie(res, name);
  if (!raw) throw new Error(`Cookie ${name} was not set by the response`);
  const segments = raw.split(';').map((segment) => segment.trim());
  const [pair, ...attributes] = segments;
  const value = pair.slice(pair.indexOf('=') + 1);
  /** @type {Record<string,string|boolean>} */
  const map = {};
  attributes.forEach((attribute) => {
    const separator = attribute.indexOf('=');
    if (separator === -1) map[attribute.toLowerCase()] = true;
    else map[attribute.slice(0, separator).toLowerCase()] = attribute.slice(separator + 1);
  });
  const maxAgeRaw = map['max-age'];
  return {
    value: decodeURIComponent(value),
    httpOnly: Boolean(map.httponly),
    secure: Boolean(map.secure),
    sameSite: typeof map.samesite === 'string' ? map.samesite.toLowerCase() : null,
    path: typeof map.path === 'string' ? map.path : null,
    maxAge: typeof maxAgeRaw === 'string' ? Number.parseInt(maxAgeRaw, 10) : null,
  };
}

/**
 * CSRF token carried by a bootstrap/login response (body or readable cookie).
 * @param {import('supertest').Response} res
 * @returns {string|null}
 */
function csrfFrom(res) {
  const bodyToken = res && res.body && res.body.data ? res.body.data.csrfToken : null;
  if (typeof bodyToken === 'string' && bodyToken) return bodyToken;
  const cookieToken = cookiesFrom(res).ay_csrf;
  return typeof cookieToken === 'string' && cookieToken ? cookieToken : null;
}

/**
 * Attach CSRF-aware helpers and the current token to a supertest agent.
 * @param {import('supertest').SuperAgentTest} agent
 * @param {string|null} csrfToken
 * @returns {import('supertest').SuperAgentTest}
 */
function decorate(agent, csrfToken) {
  agent.csrfToken = csrfToken || null;

  agent.authGet = (path, query) => {
    let call = agent.get(apiPath(path));
    if (query) call = call.query(query);
    return call;
  };
  agent.authPost = (path, body = {}) =>
    agent.post(apiPath(path)).set(CSRF_HEADER, agent.csrfToken || '').send(body);
  agent.authPatch = (path, body = {}) =>
    agent.patch(apiPath(path)).set(CSRF_HEADER, agent.csrfToken || '').send(body);
  agent.authPut = (path, body = {}) =>
    agent.put(apiPath(path)).set(CSRF_HEADER, agent.csrfToken || '').send(body);
  agent.authDelete = (path, body) => {
    let call = agent.delete(apiPath(path)).set(CSRF_HEADER, agent.csrfToken || '');
    if (body !== undefined) call = call.send(body);
    return call;
  };
  /** Raw path prefixing without CSRF (for negative CSRF tests). */
  agent.apiPath = apiPath;
  agent.rootPath = rootPath;
  /** Replace the token after a rotation (csrf endpoint / login / refresh). */
  agent.setCsrfToken = (token) => {
    agent.csrfToken = token || null;
    return agent.csrfToken;
  };
  /** Fetch a fresh CSRF token from the API and adopt it. */
  agent.fetchCsrfToken = async () => {
    const res = await agent.get(apiPath('/auth/csrf')).set('Accept', 'application/json');
    const token = csrfFrom(res) || cookiesFrom(res).ay_csrf;
    if (!token) throw new Error(`GET /auth/csrf did not return a token (status ${res.status})`);
    agent.csrfToken = token;
    return token;
  };

  return agent;
}

/**
 * Assert a response is a success envelope (2xx).
 * @param {import('supertest').Response} res
 * @param {string} label
 * @returns {import('supertest').Response}
 */
function expectOk(res, label = 'request') {
  if (res.status >= 400) {
    const body = JSON.stringify(res.body || {}).slice(0, 800);
    throw new Error(`${label} failed with HTTP ${res.status}: ${body}`);
  }
  return res;
}

/**
 * Start an anonymous session and return both the agent and the raw response (tests
 * that need to inspect `Set-Cookie` flags or replay an old token).
 * @returns {Promise<{agent: import('supertest').SuperAgentTest, response: import('supertest').Response}>}
 */
async function bootstrapAnonymous() {
  const agent = decorate(request.agent(getApp()), null);
  const response = await agent
    .post(apiPath('/auth/session'))
    .set('Accept', 'application/json')
    .send({});
  expectOk(response, 'POST /auth/session');

  let token = csrfFrom(response);
  if (!token) {
    const csrfResponse = await agent.get(apiPath('/auth/csrf')).set('Accept', 'application/json');
    token = csrfFrom(csrfResponse) || cookiesFrom(csrfResponse).ay_csrf;
  }
  decorate(agent, token);
  return { agent, response };
}

/**
 * Create an anonymous browser-like agent: POST /auth/session, keep cookies + CSRF.
 * @returns {Promise<import('supertest').SuperAgentTest>}
 */
async function anonymousAgent() {
  const { agent } = await bootstrapAnonymous();
  return agent;
}

/**
 * Log in an existing account. Starts from a cookie-free agent so the login call is
 * exempt from CSRF (contract §6.3); falls back to a bootstrap+CSRF login if the
 * implementation requires a token.
 * @param {{email:string,password:string}} credentials
 * @returns {Promise<import('supertest').SuperAgentTest>}
 */
async function loginAgent({ email, password }) {
  const agent = decorate(request.agent(getApp()), null);
  let res = await agent.post(apiPath('/auth/login')).set('Accept', 'application/json').send({ email, password });

  if (res.status === 403 && res.body && res.body.error && res.body.error.code === 'CSRF_INVALID') {
    const boot = await agent.post(apiPath('/auth/session')).set('Accept', 'application/json').send({});
    expectOk(boot, 'anonymous bootstrap before login');
    const token = await agent.fetchCsrfToken();
    agent.setCsrfToken(token);
    res = await agent.authPost('/auth/login', { email, password });
  }

  expectOk(res, `POST /auth/login (${email})`);
  const identity = res.body && res.body.data ? res.body.data.identity : null;
  if (!identity) throw new Error('POST /auth/login did not return an identity');

  const token = csrfFrom(res) || (await agent.fetchCsrfToken());
  return decorate(agent, token);
}

/**
 * Create an account row directly and log it in through the public API.
 * @param {{role?:'member'|'moderator'|'admin', email?:string, password?:string, displayName?:string}} [options]
 * @returns {Promise<{agent: import('supertest').SuperAgentTest, user: object, email: string, password: string}>}
 */
async function accountAgent(options = {}) {
  const created = await factories.createUserRecord(options);
  const agent = await loginAgent({ email: created.email, password: created.password });
  return { agent, ...created };
}

/**
 * Moderator browser agent.
 * @returns {Promise<import('supertest').SuperAgentTest>}
 */
async function moderatorAgent() {
  const { agent } = await accountAgent({ role: 'moderator' });
  return agent;
}

/**
 * Admin browser agent.
 * @returns {Promise<import('supertest').SuperAgentTest>}
 */
async function adminAgent() {
  const { agent } = await accountAgent({ role: 'admin' });
  return agent;
}

/**
 * Signed-in member (non-moderator) browser agent.
 * @returns {Promise<import('supertest').SuperAgentTest>}
 */
async function memberAgent() {
  const { agent } = await accountAgent({ role: 'member' });
  return agent;
}

/**
 * Plain supertest request against the app, no cookies (fresh request context).
 * @returns {import('supertest').SuperTest}
 */
function client() {
  return request(getApp());
}

module.exports = {
  API_BASE,
  CSRF_HEADER,
  getApp,
  apiPath,
  rootPath,
  cookiesFrom,
  rawCookie,
  cookieFlags,
  csrfFrom,
  decorate,
  client,
  expectOk,
  bootstrapAnonymous,
  anonymousAgent,
  loginAgent,
  accountAgent,
  moderatorAgent,
  adminAgent,
  memberAgent,
};
