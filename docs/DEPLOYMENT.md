# AdiYogi — Deployment Runbook

**Status:** this document describes configuration that exists in the repository. **Nothing in this
repository has been deployed to a real environment by the overhaul team** — there are no live
URLs, no provisioned databases and no stored secrets. Treat this as the runbook for the person who
performs the first deploy.

Companion documents: [`ARCHITECTURE.md`](./ARCHITECTURE.md) (system contracts, §9 environment
variables), [`SECURITY.md`](./SECURITY.md) (threat model, CSP, cookie policy),
[`TESTING.md`](./TESTING.md) (how to run the suites), [`DATABASE_SCHEMA.md`](./DATABASE_SCHEMA.md)
(collections + indexes).

---

## 0. Current live deployment (this repository)

| Piece | Where | URL |
|---|---|---|
| Web app | Vercel (project root: `client/`) | https://adiyogi-ngeq.vercel.app |
| API | Render (Docker, `render.yaml`) | https://adiyogi-api-0z0y.onrender.com |
| Database | MongoDB Atlas | configured via Render `MONGODB_URI` |

The web app reaches the API through a **same-origin proxy** declared in `vercel.json` /
`client/vercel.json` (`/api/:path*` → `https://adiyogi-api-0z0y.onrender.com/api/:path*`).
This keeps the session cookies first-party (Safari ITP blocks cross-site `SameSite=None`
cookies), needs no CORS, and requires no build-time dashboard variables.

- To point at a different API: update the rewrite destination in both `vercel.json` files, or set
  `VITE_API_BASE_URL` (absolute) in the Vercel project environment. `client/.env.production`
  intentionally leaves it unset so the proxy is used; if a deployed host has no working proxy the
  client automatically retries once against the absolute API origin.
- Both Vercel project-root layouts are supported: repository root (`vercel.json`) and
  `client/` (`client/vercel.json` — SPA rewrites, proxy and security headers included, so deep
  links like `/community` no longer 404).
- Render free instances sleep after idle; the first request can take 30–60 s. The app shows a
  retryable "server can’t be reached" banner and the client budget is 45–60 s for that reason.
  Use a paid always-on instance for production.
- The Render API must list the web origin in `CLIENT_URL`/`CLIENT_URLS` for direct (non-proxy)
  access; it currently allows `https://adiyogi-ngeq.vercel.app`.
- Health checks: `https://adiyogi-api-0z0y.onrender.com/health` and `/health/ready` (returns
  `db: connected`).

## 1. Target topology

```
                        ┌────────────────────────────────────────────┐
  Browser ──HTTPS──▶    │  Web (static SPA)                          │
                        │  Vercel · `vercel.json` · client/dist      │
                        │  React 18 + Vite build, SPA rewrites, CSP  │
                        └───────────────┬────────────────────────────┘
                                        │ HTTPS + JSON + httpOnly cookies
                                        │ (same-origin proxy OR CORS with credentials)
                                        ▼
                        ┌────────────────────────────────────────────┐
                        │  API (Docker container)                    │
                        │  Render Web Service · `render.yaml`        │
                        │  Dockerfile (root) · node:20-alpine        │
                        │  Express 4 · /api/v1 · /health · /api/docs │
                        └───────────────┬────────────────────────────┘
                                        │ Mongoose 8, TLS (mongodb+srv)
                                        ▼
                        ┌────────────────────────────────────────────┐
                        │  MongoDB Atlas (M0 dev/first launch → M10+ │
                        │  for backups) · same region as the API     │
                        └────────────────────────────────────────────┘
```

Why these targets: a static SPA is cheapest/fastest on a CDN (Vercel), the Express + Mongoose
monolith is a single stateless container (Render Docker runtime), and Atlas removes database
operations (backups, upgrades, TLS, monitoring). Exact versions of alternative targets
(Railway/Fly/Netlify) would keep the same artifacts.

### 1.1 Repository artifacts

| File | Purpose | Verified locally? |
|---|---|---|
| `Dockerfile` | API image: multi-stage, node:20-alpine, non-root, node-as-PID-1 graceful shutdown, `/health` HEALTHCHECK | install strategy + healthcheck command verified; image build only in CI (no Docker daemon here) |
| `client/Dockerfile` | SPA image: Vite build → `nginx:alpine` | install strategy verified; build + nginx smoke test in CI |
| `client/nginx.conf` | SPA fallback, `/api/` proxy (envsubst), gzip, cache headers, security headers, `/healthz` | YAML/JSON/structure checked; nginx not installed locally, CI smoke test |
| `.dockerignore` | shared build context filter for both images | pattern audit (§16) |
| `docker-compose.yml` | local stack: `mongo` + `api` + `web` | YAML parses; not started (no daemon) |
| `.github/workflows/ci.yml` | lint, client tests/build, server tests, audit, Docker builds | YAML parses; runs on GitHub Actions |
| `vercel.json` | SPA build from the npm-workspaces root, SPA rewrites, headers/CSP | JSON parses; Vercel validates on deploy |
| `render.yaml` | API blueprint (Docker runtime, `/health`, env vars, 1 instance) | YAML parses; Render validates on sync |
| `server/.env.example` | every server variable from ARCHITECTURE §9 | compared 1:1 against root `.env.example` |
| `client/.env.example` | `VITE_*` configuration (all public) | — |
| `docs/DEPLOYMENT.md` | this runbook | — |

---

## 2. Prerequisites

- GitHub repository with `main` protected and CI (`.github/workflows/ci.yml`) required to pass.
- Free/team accounts: **Vercel** (web), **Render** (API), **MongoDB Atlas** (database),
  **Google AI Studio** (Gemini key for the AI companion — optional; without it the chat endpoint
  returns an honest `503 AI_UNAVAILABLE` rather than fabricated text).
- A domain, ideally split as `app.example.com` (Vercel) + `api.example.com` (Render). This is the
  recommended layout because cookies and CSRF behave correctly across a shared parent domain — see
  §5.
- Node.js 20+ and Docker Desktop/Engine for local work (`npm ci`, `npm run dev`, `docker compose`).

---

## 3. MongoDB Atlas setup

### 3.1 Cluster

1. Create an Atlas **Project** (e.g. `adiyogi-prod`) and a cluster.
2. Tier: **M0** is fine for development and a first launch (shared vCPU, ~500 connections, no
   managed backups). For production with real user data, plan **M10+**, which includes continuous
   backups and dedicated resources.
3. **Region:** pick the Atlas region closest to the Render region. `render.yaml` uses
   `region: oregon`; the matching Atlas region is **AWS `us-west-2` (Oregon)**. Co-locating the API
   and database avoids 60–150 ms per query.
4. Cluster name: anything, e.g. `adiyogi-prod`. Database name: **`adiyogi`** (must match
   `MONGODB_DB_NAME`, and normally the path in the connection string).

### 3.2 Database user (least privilege)

Create a dedicated *database* user — never use your Atlas organisation/API credentials:

- Username: `adiyogi-api`
- Authentication: password (generated, 32+ random chars) or SCRAM-SHA-256.
- **Built-in role: `readWrite` on database `adiyogi` only.**
  Do **not** grant `atlasAdmin`, `admin`, `dbAdmin` or `clusterMonitor`. `readWrite` is enough for
  the application, including creating the indexes Mongoose declares (Mongoose issues
  `createIndexes`) and the TTL indexes used for chat/crisis retention.
- Store the password in a password manager and in Render's environment (never in the repo).

### 3.3 Network access

Atlas only accepts connections from IP access-list entries:

- **Preferred:** add Render's **static outbound IP addresses** for the service. Render exposes these
  in the dashboard (Service → *Connect* → outbound IPs, if your plan provides static IPs); add each
  as a `/32` entry in Atlas → *Network Access*.
- Render's default egress IPs are dynamic. If static outbound IPs are unavailable on your plan, add
  `0.0.0.0/0` (allow from anywhere) **and** compensate with: a unique 32+ char DB password, TLS
  (implied by `mongodb+srv://`), Atlas database auditing/alerting, and least-privilege users.
  This is acceptable but strictly weaker than an allow-list; review it as your first hardening item.
- Development machines: add your current IP (Atlas can add "My Current IP Address").
- Never add `0.0.0.0/0` for a database that holds crisis-event or chat metadata unless the password
  and user privileges are hardened.

### 3.4 Connection string

Atlas → Cluster → *Connect* → *Drivers* → Node.js. It looks like:

```
mongodb+srv://adiyogi-api:<password>@<cluster>.xxxxx.mongodb.net/adiyogi?retryWrites=true&w=majority&appName=adiyogi-api
```

- Put the **database name in the path** (`/adiyogi`). `server/src/config/db.js` gives the URI's
  database name precedence; `MONGODB_DB_NAME=adiyogi` fills the gap only when the URI has no path.
- Keep `retryWrites=true&w=majority`.
- URL-encode special characters in the password (`@` → `%40`, `:` → `%3A`, `/` → `%2F`,
  `?` → `%3F`, `#` → `%23`).
- Set it as the **`MONGODB_URI`** secret in Render (never in `render.yaml`, never in the image).

### 3.5 Indexes

There is no migration tool in this project. Indexes are declared on the Mongoose models
(`server/src/models/**`) and Mongoose's default auto-indexing creates them on the first
connection/model compilation after startup. That includes:

- unique indexes (`User.email`, `Session.tokenHash`, `Board.slug`, report uniqueness),
- query/compound indexes (thread lists, replies, notifications),
- **TTL indexes** for `Session.expiresAt`, `Conversation.expiresAt`, `ChatMessage.expiresAt`,
  `CrisisEvent.expiresAt`, and the 90-day `Notification` cleanup — the TTL indexes are what enforce
  retention; do not delete them.

After the first successful deploy, confirm in Atlas → *Indexes* that each collection has its
indexes. If a collection grows large before indexes exist, consider creating them out-of-band
(Atlas UI or `mongosh`) before loading data.

### 3.6 Backups and restore

- **M0** has **no** managed backup. Decide explicitly: (a) upgrade to M10+ for continuous backups +
  point-in-time restore (recommended before real users), or (b) run a scheduled `mongodump` from a
  trusted machine to encrypted object storage and test a restore.
- Restore: Atlas *Backup → Restore* (M10+) or `mongorestore --uri "<uri>" --archive=backup.gz
  --gzip` into a fresh cluster, then repoint `MONGODB_URI`.
- The API stores no user passwords in plaintext and no crisis *content*; chat/crisis metadata is
  TTL-expired. A database dump still contains forum content and email addresses — treat backups as
  sensitive personal data.

### 3.7 Verify the connection

```bash
# from your machine, with the same URI Render will use
mongosh "mongodb+srv://adiyogi-api:<password>@<cluster>.xxxxx.mongodb.net/adiyogi?retryWrites=true&w=majority&appName=adiyogi-api" \
  --eval "db.runCommand({ ping: 1 }).ok"
# → 1
```

---

## 4. Environment variables

Authoritative list: ARCHITECTURE §9. The API validates the environment at boot
(`server/src/config/env.js`) and **exits with a clear message** when required values are missing —
a deployment that boots with defaults is a misconfiguration, not a convenience.

### 4.1 Server (Render / docker compose / local)

| Variable | Required | Local dev | docker compose | Production (Render) | Secret? |
|---|---|---|---|---|---|
| `NODE_ENV` | yes | `development` | `development` (compose default) | `production` | no |
| `PORT` | no (default 4000) | `4000` | `4000` (mapped) | injected by Render; do not set | no |
| `API_BASE_PATH` | no (default `/api/v1`) | `/api/v1` | `/api/v1` | `/api/v1` | no |
| `LOG_LEVEL` | no (default `info`) | `info` | `info` | `info` (use `warn` only to cut volume) | no |
| `MONGODB_URI` | **yes** | `mongodb://127.0.0.1:27017/adiyogi` | overridden to `mongodb://mongo:27017/adiyogi` | Atlas `mongodb+srv://…` | **yes** |
| `MONGODB_DB_NAME` | no (default `adiyogi`) | `adiyogi` | `adiyogi` | `adiyogi` | no |
| `CLIENT_URL` | yes in practice | `http://localhost:5173` | `http://localhost:8080` | `https://app.example.com` (SPA origin; must not contain localhost in prod) | no |
| `CLIENT_URLS` | no | empty | empty | extra origins, comma separated (preview URLs) | no |
| `JWT_SECRET` | **yes** (≥16 chars) | generate | from `.env` | `openssl rand -hex 32` | **yes** |
| `SESSION_SECRET` | **yes** (≥16 chars) | generate | from `.env` | `openssl rand -hex 32` | **yes** |
| `ACCESS_TOKEN_TTL_MIN` | no (15) | `15` | `15` | `15` | no |
| `SESSION_TTL_DAYS` | no (30) | `30` | `30` | `30` | no |
| `COOKIE_DOMAIN` | no | empty | empty | `.example.com` **only** for the shared-parent-domain layout (§5.2) | no |
| `COOKIE_SECURE` | no (auto in prod) | `false` | `false` | `true` | no |
| `COOKIE_SAMESITE` | no (`lax`) | `lax` | `lax` | `lax` for layout A/C, `none` for layout B (§5.2) | no |
| `AI_PROVIDER` | no (`gemini`) | `gemini` | `gemini` | `gemini` | no |
| `AI_API_KEY` | optional | empty (chat returns 503) | empty | Gemini key | **yes** |
| `AI_MODEL` | no | `gemini-2.0-flash` | same | same | no |
| `AI_TIMEOUT_MS` | no (20000) | `20000` | `20000` | `20000` | no |
| `AI_FALLBACK_GUIDED` | no (`true`) | `true` | `true` | `true` | no |
| `CHAT_RETENTION_DAYS` | no (30) | `30` | `30` | `30` | no |
| `CRISIS_EVENT_RETENTION_DAYS` | no (90) | `90` | `90` | `90` | no |
| `RATE_LIMIT_WINDOW_MIN` | no (15) | `15` | `15` | `15` | no |
| `RATE_LIMIT_MAX` | no (300) | `300` | `300` | `300` | no |
| `CHAT_RATE_LIMIT_MAX` | no (20) | `20` | `20` | `20` | no |
| `SEED_ON_START` | no (`true`) | `true` | `true` | `true` (idempotent) | no |
| `ADMIN_EMAIL` | optional | empty | empty | set once, then remove | **yes** |
| `ADMIN_PASSWORD` | optional | empty | empty | set once, then remove | **yes** |

Secret generation:

```bash
openssl rand -hex 32   # JWT_SECRET (run twice: once for SESSION_SECRET)
```

Rotating `JWT_SECRET` invalidates every access token (users are transparently re-sessioned on the
next request); rotating `SESSION_SECRET` invalidates CSRF tokens and changes IP hashes (existing
sessions keep working, because the refresh cookies are opaque tokens hashed per-session). Rotate
both together, off-peak, and expect a burst of re-authentications.

Boot-time validation rules (`server/src/config/env.js`):

- `JWT_SECRET` and `SESSION_SECRET` are required outside tests, minimum 16 characters.
- `MONGODB_URI` is required.
- With `NODE_ENV=production`, `CLIENT_URL`/`CLIENT_URLS` must not contain `localhost`.
- `SameSite=None` automatically forces `secure: true` on the session cookies.

### 4.2 Client (Vercel project / docker build arg / local)

All `VITE_*` values are **inlined into the public JS bundle at build time**. Never put a secret in
one. There is no API key in the browser build by design — the AI call is server-side only.

| Variable | Where | Local dev | Docker (compose) | Vercel |
|---|---|---|---|---|
| `VITE_API_BASE_URL` | build-time | unset → `/api/v1`, proxied by Vite | unset → `/api/v1`, proxied by nginx | layouts A/B: absolute API origin (e.g. `https://api.example.com/api/v1`); layout C: unset (`/api/v1`, proxied by a Vercel rewrite) — see §5.2 |
| `VITE_APP_NAME` | build-time, optional | `AdiYogi` | `AdiYogi` | `AdiYogi` |
| `VITE_PROXY_TARGET` | Vite dev server only | `http://localhost:4000` | n/a | n/a |

Anything prefixed `VITE_` is public. Use the Vercel dashboard (*Project → Settings → Environment
Variables*) and remember that a change requires a **new deployment** (Vite bakes values into the
build; there is no runtime config).

---

## 5. Cookies, CORS and the SameSite caveat (read before deploying)

### 5.1 Cookie inventory and CSRF delivery

| Cookie | httpOnly | Path | Lifetime | Purpose |
|---|---|---|---|---|
| `ay_at` | yes | `/` | `ACCESS_TOKEN_TTL_MIN` (15 min) | signed access JWT |
| `ay_rt` | yes | `/api/v1/auth` | `SESSION_TTL_DAYS` (30 days) | opaque refresh token, rotated on `/auth/refresh` |
| `ay_csrf` | **no** (documented for the SPA to read) | `/` | `SESSION_TTL_DAYS` | double-submit CSRF token (`<random>.<hmac>`) |

The SPA sends every unsafe request with `x-csrf-token`. It obtains the token from
**either** of two places (`client/src/api/client.js`):

1. the readable `ay_csrf` cookie (`document.cookie`) — the canonical double-submit delivery; or
2. the in-memory token cache populated from the `{data:{csrfToken}}` field that session-mutating
   auth endpoints return (`POST /auth/session`, `/auth/login`, `/auth/register`, `/auth/refresh`,
   `/auth/logout`).

That fallback is what makes a **cross-origin** deployment viable: on `app.example.com` +
`api.example.com` the cookie is visible only if `COOKIE_DOMAIN` covers both, and on the default
`*.vercel.app` + `*.onrender.com` domains the cookie can never be shared — there the cached token
from the auth response is used instead. `SameSite=None` always forces `Secure` in
`server/src/utils/cookies.js`.

### 5.2 Topology matrix — choose one before deploying

| | **A. Same parent domain (RECOMMENDED)** | **B. Default platform domains** | **C. Single-origin reverse proxy (optional)** |
|---|---|---|---|
| Web origin | `https://app.example.com` (Vercel) | `https://<project>.vercel.app` | `https://<project>.vercel.app` or `https://app.example.com` |
| API origin | `https://api.example.com` (Render) | `https://<api>.onrender.com` | proxied behind the web origin (`/api/*`) |
| `VITE_API_BASE_URL` | `https://api.example.com/api/v1` | `https://<api>.onrender.com/api/v1` (absolute) | unset → `/api/v1` (relative) |
| `COOKIE_SAMESITE` | `lax` | `none` | `lax` |
| `COOKIE_SECURE` | `true` | `true` | `true` |
| `COOKIE_DOMAIN` | `.example.com` (so JS can read `ay_csrf`) | empty | empty |
| `CLIENT_URL` (Render) | `https://app.example.com` | `https://<project>.vercel.app` | `https://<project>.vercel.app` |
| CSRF token source | cookie (or cached auth-response token) | cached auth-response token | cookie |
| CORS | allow-list + `credentials: true` | allow-list + `credentials: true` | not exercised by the browser |
| Browser cookie risk | none (same-site) | third-party cookie blocking (Safari/ITP, Chrome partitioning) may break sessions | none (first-party) |
| CSP `connect-src` | `'self' https://api.example.com` | `'self' https://<api>.onrender.com` | `'self'` |

**Recommendation:** A. It keeps cookies same-site (no third-party blocking), lets the readable
`ay_csrf` cookie work with `SameSite=Lax`, and needs only DNS + two custom domains. B works and is
fully supported by the client, but is fragile in browsers that block third-party cookies. C is the
most robust "no custom domain" option and is a small `vercel.json` edit once the API host is known.

### 5.3 Layout A — same registrable parent domain (recommended)

`app.example.com` (Vercel) + `api.example.com` (Render), both under `example.com`:

| Setting | Value |
|---|---|
| Vercel domain | `app.example.com` |
| Render custom domain | `api.example.com` |
| `CLIENT_URL` | `https://app.example.com` |
| `COOKIE_DOMAIN` | `.example.com` |
| `COOKIE_SAMESITE` | `lax` |
| `COOKIE_SECURE` | `true` |
| `VITE_API_BASE_URL` | `https://api.example.com/api/v1` |
| SPA CSP `connect-src` | must include `https://api.example.com` (tighten `vercel.json` once the domain is final) |

Why this works: `app.example.com` and `api.example.com` are **same-site** (same registrable domain),
so `SameSite=Lax` cookies are sent on the credentialed cross-origin requests; because
`COOKIE_DOMAIN=.example.com`, the `ay_csrf` cookie is also visible to `document.cookie` on
`app.example.com`, so double-submit CSRF works without relying on the in-memory fallback. Verified
against the current client: an absolute `VITE_API_BASE_URL` produces absolute request URLs
(§16).

### 5.4 Layout B — default platform domains (`*.vercel.app` + `*.onrender.com`)

There is **no shared registrable domain** between `vercel.app` and `onrender.com` (both are public
suffixes), so `COOKIE_DOMAIN` cannot be used and the `ay_csrf` cookie is not readable by the SPA.
The client handles this by caching the CSRF token returned by the auth endpoints (§5.1). Configure:

| Setting | Value |
|---|---|
| `VITE_API_BASE_URL` | `https://<api>.onrender.com/api/v1` (absolute — required) |
| `COOKIE_SAMESITE` | `none` (the committed `render.yaml` default, correct for this layout) |
| `COOKIE_SECURE` | `true` (mandatory with `SameSite=None`) |
| `COOKIE_DOMAIN` | empty |
| `CLIENT_URL` | `https://<project>.vercel.app` |
| `CLIENT_URLS` | any additional Vercel preview origins (exact origins, comma separated) |

Caveats to accept knowingly: the session cookies are **third-party** cookies in this layout, so
browsers that block third-party cookies (Safari/ITP by default; Chrome partitions/blocks them in
some configurations) will fail to persist a session. Same-user flows can work in Chrome while
breaking in Safari. This is the reason A is recommended for anything beyond an internal demo. If you
want A's reliability without owning a custom domain, use layout C.

### 5.5 Layout C — single-origin reverse proxy (optional, no custom domain)

Make the API same-origin from the browser's point of view so all cookies are first-party, the
`ay_csrf` cookie is readable, and `SameSite=Lax` is sufficient.

**Vercel rewrite proxy** — after the API hostname is known, add this rule **before** the SPA fallback
in `vercel.json` (replace the host; no other change is needed):

```json
"rewrites": [
  { "source": "/api/:path*", "destination": "https://<api-host>/api/:path*" },
  { "source": "/(.*)", "destination": "/index.html" }
]
```

Keep `VITE_API_BASE_URL` **unset** (the client defaults to the relative `/api/v1`), set
`COOKIE_SAMESITE=lax` and `CLIENT_URL=https://<project>.vercel.app` on Render. Verify after the
first deploy that `Set-Cookie` and the `x-csrf-token` round-trip survive the proxy; if your
project's proxy configuration strips them, use layout A or B.

**Self-hosted**: the Docker path is already same-origin — `client/nginx.conf` proxies `/api/` to the
`api` service, so the browser only ever talks to the web origin (see §6).

### 5.6 CORS allow-list

The API reflects only exact origins from `CLIENT_URL` + `CLIENT_URLS`
(`server/src/middleware/cors.js`), with `credentials: true`, and rejects unknown-origin preflights
with `403 FORBIDDEN`. Consequences:

- Use **origins only** (`https://app.example.com`), no trailing slash and no path.
- Add every browser origin that will call the API directly (layouts A and B): the production custom
  domain and, if previews should work, each `*.vercel.app` preview origin via `CLIENT_URLS`.
  Wildcards are not supported.
- In layout C the browser never makes a cross-origin request, so CORS is not exercised, but
  `CLIENT_URL` should still match the SPA origin for the forwarded `Origin` header.
- Requests without an `Origin` header (curl, server-to-server) pass through; CORS is a browser
  policy, not an auth boundary.

## 6. Docker: local development and production images

There are **two images** and they are independent:

| Image | Dockerfile | Base | Listens on | Contains |
|---|---|---|---|---|
| API | `Dockerfile` (repo root) | `node:20-alpine` | `4000` | compiled JS + production `node_modules` only |
| Web | `client/Dockerfile` | build `node:20-alpine` → `nginx:alpine` | `80` | static `client/dist` + nginx config |

Both are built with the **repository root as build context** because npm workspaces need the root
`package.json` + `package-lock.json`. The shared `.dockerignore` keeps the context small and keeps
secrets/legacy v1 sources out of the images.

### 6.1 Local stack (`docker-compose.yml`)

```bash
cp .env.example .env                       # then fill JWT_SECRET / SESSION_SECRET
# generate the two required secrets:
openssl rand -hex 32                        # JWT_SECRET
openssl rand -hex 32                        # SESSION_SECRET

docker compose up --build
# web: http://localhost:8080   (nginx, SPA + /api proxy)
# api: http://localhost:4000   (/health, /api/v1, /api/docs)
# mongo: 127.0.0.1:27017 (loopback only, data in the named volume mongo-data)
```

Notes:

- The API container gets `MONGODB_URI=mongodb://mongo:27017/adiyogi` (compose overrides the
  host-oriented value from `.env`) and `CLIENT_URL=http://localhost:8080`.
- `NODE_ENV` defaults to `development` in compose on purpose: with `NODE_ENV=production` the server
  refuses to boot when `CLIENT_URL` contains localhost, and cookies become `Secure`-only.
- The browser only ever talks to `http://localhost:8080`; nginx proxies `/api/` to `api:4000`, so
  the session cookies are first-party and `SameSite=Lax` works.
- Health: `curl -s localhost:4000/health`, `curl -s localhost:8080/healthz`.
- Inspect MongoDB: `docker compose exec mongo mongosh adiyogi`.
- Wipe local data: `docker compose down -v` (deletes the `mongo-data` volume).

### 6.2 Host-tooling workflow (`npm run dev`) still works

The compose file does not replace the host workflow; it can just provide the database:

```bash
docker compose up -d mongo     # MongoDB on 127.0.0.1:27017
cp .env.example .env           # MONGODB_URI=mongodb://127.0.0.1:27017/adiyogi, CLIENT_URL=http://localhost:5173
npm ci
npm run dev                    # nodemon API :4000 + Vite :5173 (Vite proxies /api to :4000)
```

This is the fast inner loop (no image rebuilds). Use compose when you want to exercise the real
nginx + production API image.

### 6.3 Production-like local run

```bash
# API image with production env (custom secrets; HTTPS is not required locally for Secure
# cookies because browsers treat http://localhost as a secure context)
docker build -t adiyogi-api:local .
docker run --rm -p 4000:4000 \
  -e NODE_ENV=production \
  -e MONGODB_URI="mongodb://host.docker.internal:27017/adiyogi" \
  -e CLIENT_URL="http://localhost:8080" \
  -e JWT_SECRET="$(openssl rand -hex 32)" \
  -e SESSION_SECRET="$(openssl rand -hex 32)" \
  adiyogi-api:local

# Web image (relative API base; nginx proxies /api/ to http://api:4000 by default)
docker build -f client/Dockerfile -t adiyogi-web:local .
docker run --rm -p 8080:80 -e API_UPSTREAM=http://host.docker.internal:4000 adiyogi-web:local
```

`API_UPSTREAM` must be the **full API origin including scheme** (`http://api:4000`,
`https://api.example.com`). It is substituted into `client/nginx.conf` by the nginx image's
envsubst entrypoint.

### 6.4 What the images do (and do not do)

API image:

- Stage 1 installs **only** the API workspace's production dependencies:
  `npm ci --omit=dev --workspace server --include-workspace-root`. Verified locally: 154 packages,
  all Express/Mongoose runtime deps present, jest/eslint/nodemon/supertest/mongodb-memory-server and
  all client packages absent (evidence in §16). The client manifest is only copied because npm
  workspaces require every workspace manifest to exist.
- Stage 2 runs as the unprivileged **`node`** user (uid 1000), has no build toolchain, no dev
  dependencies, no `.env` (secrets are injected at runtime), and no client code.
- **PID 1:** node runs as PID 1 and `server/src/server.js` installs the `SIGTERM`/`SIGINT`
  handlers that perform the graceful shutdown (`server.close()` then Mongoose disconnect, force-exit
  after 15 s). The app spawns no child processes, so no zombie reaping is required. `docker run
  --init` / compose `init: true` (set in `docker-compose.yml`) adds Docker's built-in init when
  wanted; a bundled `tini` (`apk add --no-cache tini`, Alpine *community* repo, plus
  `ENTRYPOINT ["/sbin/tini","--"]`) is a drop-in alternative that is deliberately not a build
  dependency here. Compose sets `stop_grace_period: 20s` so the 15 s shutdown budget completes.
- `HEALTHCHECK` uses Node's built-in `fetch` against `http://127.0.0.1:${PORT}/health` (no curl in
  Alpine).
- `NODE_ENV=production`, `PORT=4000`, `EXPOSE 4000`.

Web image:

- Builds the SPA with `npm ci --workspace client` + `npm run build --workspace client`, then serves
  `client/dist` from `nginx:alpine`.
- Vite build is inlined with `VITE_API_BASE_URL` = empty by default → the SPA calls the relative
  `/api/v1`, which nginx proxies (see `client/nginx.conf`).
- `HEALTHCHECK` uses busybox `wget` against `/healthz`; `/healthz` always returns `200 ok`.
- gzip for text/JS/CSS/JSON/SVG, `Cache-Control: public, max-age=31536000, immutable` for hashed
  `/assets/*`, `no-cache` for `index.html`, SPA deep-link fallback via
  `try_files $uri $uri/ /index.html`.
- Security headers: CSP (static-SPA policy, `connect-src 'self'`, `style-src 'self'
  'unsafe-inline'` for React inline styles), `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`,
  `Permissions-Policy: camera=(), microphone=(), geolocation=()`. HSTS is deliberately left to the
  TLS-terminating edge because this container also serves plain-HTTP local development.
- `client/nginx.conf` is an **envsubst template**: only variables present in the container
  environment are substituted, so `${API_UPSTREAM}` is replaced while nginx runtime variables
  (`$uri`, `$host`, …) are untouched.

---

## 7. Deploying the API to Render

1. Push `main` (CI must be green).
2. Render Dashboard → **New → Blueprint** → select this repository. Render reads `render.yaml`.
3. Fill in the `sync: false` variables (§4.1): `MONGODB_URI`, `JWT_SECRET`, `SESSION_SECRET`,
   `CLIENT_URL`, `AI_API_KEY` (optional), `CLIENT_URLS` (optional), and one-time `ADMIN_EMAIL` /
   `ADMIN_PASSWORD` if you want an initial admin.
4. Confirm the service settings from `render.yaml`:
   - Runtime **Docker**, Dockerfile `./Dockerfile`, context `.`
   - Health check path **`/health`** (liveness; it must not depend on MongoDB so an Atlas blip does
     not restart-loop the service)
   - `NODE_ENV=production`, `COOKIE_SECURE=true`, `COOKIE_SAMESITE=none` (layout B default in
     `render.yaml` — change to `lax` and add `COOKIE_DOMAIN=.example.com` for layout A/C),
     `autoDeploy: true`, `numInstances: 1`
5. Deploy. Watch the build log: `npm ci --omit=dev --workspace server …` then image start.
6. Smoke-check the deployed API:

```bash
curl -sS https://<service>.onrender.com/health
# {"success":true,...,"data":{"status":"ok","uptime":…,"version":"2.0.0"}}
curl -sS https://<service>.onrender.com/health/ready    # pings MongoDB; 503 when down
curl -sS -i https://<service>.onrender.com/healthz | head -n 1
curl -sS https://<service>.onrender.com/api/docs -o /dev/null -w '%{http_code}\n'   # 200 Swagger UI
```

7. Attach the custom domain `api.example.com` (Render → Settings → Custom Domains) and switch
   `CLIENT_URL`/`VITE_API_BASE_URL` to the final HTTPS origin. Render provisions the TLS cert.
8. **Bootstrap the admin, then remove the bootstrap secrets.** With `ADMIN_EMAIL`/`ADMIN_PASSWORD`
   set for one deploy, the account is created if it does not exist. Alternatively run the CLI once:
   `npm run create:admin` (locally against the Atlas URI, or via a Render shell/job) — the scripts
   live in `server/scripts/` and are idempotent. Remove `ADMIN_PASSWORD` from Render afterwards.
9. Board seeding: `SEED_ON_START=true` seeds the taxonomy on boot (idempotent). Manual:
   `npm run seed` against `MONGODB_URI`.
10. Keep `numInstances: 1` until §13 (rate limiting is per-process).

Render injects `PORT`; the container reads `process.env.PORT` and listens on it, so no `PORT`
setting is needed. The Docker `HEALTHCHECK` and Render's own health check both hit `/health`.

---

## 8. Deploying the SPA to Vercel

`vercel.json` uses a **root-directory-less monorepo configuration** (build from the repository
root):

| Setting | Value |
|---|---|
| Install command | `npm ci --include=dev` (both workspaces from the lockfile; `--include=dev` keeps the Vite/Tailwind build toolchain even if the platform exports `NODE_ENV=production`) |
| Build command | `npm run build -w client` |
| Output directory | `client/dist` |
| Framework preset | disabled (`"framework": null`) — Vite is built through the workspace script |
| Rewrites | `/(.*) → /index.html` (SPA deep links; real files are served first) |
| Headers | HSTS, CSP (cross-origin variant, see below), `nosniff`, `DENY` framing, referrer, permissions; long-lived cache for `/assets/*`; `no-cache` for `/index.html` |

Steps:

1. Vercel → **Add New → Project** → import the repository. **Do not set a Root Directory** — keep
   it at the repository root so `installCommand`/`buildCommand`/`outputDirectory` resolve as above.
2. Environment variable: `VITE_API_BASE_URL` — layout A/B: the absolute API origin
   (`https://api.example.com/api/v1` or `https://<api>.onrender.com/api/v1`); layout C: leave it
   unset so the SPA uses the relative `/api/v1`. Optionally `VITE_APP_NAME`. Remember: changing it
   requires a redeploy.
3. Deploy. Check that:
   - `/` returns the app, deep links (e.g. `/boards/anxiety`, `/threads/<id>`, `/chat`) return the
     app shell with HTTP 200,
   - `/assets/index-<hash>.js` returns `Cache-Control: public, max-age=31536000, immutable`,
   - the response carries `Content-Security-Policy` and `Strict-Transport-Security`,
   - `/api/*` reaches the API: layout A/B via CORS to the API origin, layout C via the Vercel
     rewrite proxy.
4. Add the custom domain `app.example.com`.
5. **CSP:** `vercel.json` ships
   `connect-src 'self' https:` for the **cross-origin** layouts A and B. That is the deliberately
   weaker variant (it permits any HTTPS origin) because the API origin is deployment-specific and
   `vercel.json` cannot interpolate environment variables. Once the final API domain is known,
   tighten it to `connect-src 'self' https://api.example.com` (layout A) or
   `connect-src 'self' https://<api>.onrender.com` (layout B). Layout C is same-origin, so it can
   use the strict policy: `connect-src 'self'` exactly as in `client/nginx.conf`. The nginx/static-SPA
   policy in `docs/SECURITY.md` remains the canonical strict policy; do not copy the `https:`
   relaxation into any same-origin deployment.
6. Preview deployments: each preview gets a unique origin. If you want previews to call the
   production API, add the preview origins to Render's `CLIENT_URLS` (no wildcards).
7. Rollback: Vercel → Deployments → previous deployment → **Promote to Production** (instant).

---

## 9. CI/CD flow

### 9.1 Pull requests and `main`

`.github/workflows/ci.yml` runs on every push and pull request targeting `main`:

| Job | What it proves | Notes |
|---|---|---|
| `quality` | `npm ci`, `npm run lint` (server + client), `npm run test -w client`, `npm run build -w client`, uploads `client/dist` artifact | fail-fast order lint → tests → build |
| `api-tests` | `npm ci`, `npm run test -w server` (Jest + supertest + mongodb-memory-server) | caches `~/.cache/mongodb-binaries` keyed by the lockfile so the MongoDB binary is not re-downloaded every run |
| `security-audit` | `npm audit --omit=dev --audit-level=high` | **non-blocking** (`continue-on-error: true`): the advisory database changes independently of the repo, blocking merges on unfixed transitive advisories would freeze development; the printed report must be reviewed before a release |
| `docker-build` | builds the API and web images with `docker/build-push-action` (`push: false`) after `quality` + `api-tests` pass; smoke-tests the web image (`/healthz`, SPA fallback, CSP header) | this is the gate that proves the Dockerfiles work — local environments may have no Docker daemon |

Least privilege: top-level `permissions: contents: read`; the workflow never writes to the repo,
never pushes images and never deploys. One run per branch via `concurrency` with
`cancel-in-progress: true`.

### 9.2 Deploys

Deployment is **pulled by the platforms**, not pushed by CI:

- **Render** (`autoDeploy: true`) redeploys the API on every push to the connected branch (expected:
  `main`). If you want deploys gated on CI, disable autoDeploy and trigger a Render deploy hook from
  a CI job after the required checks (not configured in this repository).
- **Vercel** Git integration builds every push/PR by default; production follows the production
  branch (`main`).
- Images are **not published** to a registry by CI. `docker-build` only proves they build. To deploy
  a pre-built image, add a registry push step (GHCR) and point Render/Vercel at the image (out of
  scope here).

Branch flow used during the overhaul: feature branches → `integration/production-overhaul` → `main`.
Only `main` is wired to the CI triggers and platform auto-deploy.

---

## 10. First-deploy checklist

Order matters: database → API → SPA → verification.

1. [ ] Atlas cluster created, database `adiyogi`, region matches the API region.
2. [ ] Atlas DB user `adiyogi-api` with `readWrite` on `adiyogi` only.
3. [ ] Atlas network access contains Render's egress IPs (or documented `0.0.0.0/0` decision).
4. [ ] `mongosh "<atlas-uri>" --eval "db.runCommand({ping:1}).ok"` → `1` from your machine.
5. [ ] `openssl rand -hex 32` twice → `JWT_SECRET`, `SESSION_SECRET` stored in a password manager.
6. [ ] Render blueprint synced; all `sync: false` vars filled; `CLIENT_URL` = final SPA origin.
7. [ ] Deploy log clean; `GET /health` → 200; `GET /health/ready` → 200 (Mongo connected).
8. [ ] Logs show `AdiYogi API listening` with `env: "production"`, and no credential leakage.
9. [ ] `GET /api/v1/boards` returns the seeded taxonomy (`SEED_ON_START`).
10. [ ] `/api/docs` (Swagger UI) loads.
11. [ ] `POST /api/v1/auth/session` sets `ay_at`, `ay_rt`, `ay_csrf` with `Secure` + correct
        `SameSite`; `GET /api/v1/auth/csrf` returns a token; a POST with `x-csrf-token` succeeds
        (200/201) and one without returns `403 CSRF_INVALID`.
12. [ ] Vercel project created from the repo root with the `vercel.json` config; build succeeds;
        `VITE_API_BASE_URL` set for the chosen layout (absolute for A/B, unset for C).
13. [ ] SPA loads over HTTPS; deep link reload works; browser network tab shows API calls reaching
        the API origin (or `/api` proxy) and returning 200.
14. [ ] Cookie smoke test in the browser: session created, a forum read works, a write
        (post/reply) works — proving CORS + cookies + CSRF together.
15. [ ] AI chat: with `AI_API_KEY` set, a message returns a governed reply; with the key absent it
        returns `503 AI_UNAVAILABLE` (never fabricated text).
16. [ ] Crisis resources page loads; `POST /crisis/assess` returns a level and resources.
17. [ ] Custom domains attached (layout A) and `COOKIE_SAMESITE=lax` + `COOKIE_DOMAIN=.example.com`
        set; re-run steps 11–14.
18. [ ] Admin bootstrap done (`ADMIN_EMAIL`/`ADMIN_PASSWORD` deploy or `npm run create:admin`),
        then the bootstrap password removed from Render.
19. [ ] Backups decision made (M10+ continuous backup or scheduled `mongodump`) and a restore has
        been tested at least once.
20. [ ] Uptime check configured against the API `/health` and the web origin (external monitor),
        alert routing tested.
21. [ ] HSTS/edge headers reviewed for the custom domain; CSP tightened from `https:` to the exact
        API origin (layouts A/B) or `'self'` (layout C).

---

## 11. Health checks, logs and monitoring

### 11.1 Endpoints

| Endpoint | Meaning | Used by |
|---|---|---|
| `GET /health` | liveness — no DB dependency (`{status:"ok", uptime, version}`) | Docker `HEALTHCHECK`, Render health check, uptime monitors |
| `GET /health/ready` | readiness — pings MongoDB, `503` when down | load balancer / manual check / pre-deploy gate |
| `GET /healthz` | unversioned liveness alias | legacy/compat probes |
| `GET /healthz` (web nginx) | static `200 ok` | compose healthcheck, container platforms, CI smoke test |

`/health` is intentionally DB-independent: restarting a container because Atlas is briefly
unreachable would not fix anything and would drop in-flight requests.

### 11.2 Logs

The API logs structured JSON in production (winston) with a per-request `requestId`; log lines never
contain request bodies, tokens, raw IPs or content.

```bash
# local compose
docker compose logs -f api
docker compose logs -f web
docker compose logs -f mongo

# single container
docker logs -f <container>

# Render: Dashboard -> service -> Logs (or `render logs` via the CLI)
# Vercel: Dashboard -> Deployment -> Functions/Logs (static site build logs only; runtime logs are
#         browser-side and, by design, no third-party analytics/telemetry is loaded)
```

Signals worth watching: `AI_UNAVAILABLE` rate (provider/key problem), `SERVICE_UNAVAILABLE` /
readiness failures (Atlas), `429 RATE_LIMITED` spikes (abuse or too-tight limits), 5xx rate,
container restarts, Render deploy failures.

### 11.3 External monitoring

Register two probes: `https://api.example.com/health` (expect 200, body `"status":"ok"`) and
`https://app.example.com/` (expect 200 + app shell). Alert on 2–3 consecutive failures to avoid
waking people for single blips. Add `/health/ready` as a separate, lower-urgency signal.

---

## 12. Rollback

| Layer | How |
|---|---|
| SPA | Vercel → Deployments → pick the last good deployment → **Promote to Production** (instant, no rebuild). `git revert` on `main` also works. |
| API | Render → service → **Deploys** → last good deploy → **Roll back** (or **Redeploy**). Because images are built from git, a rollback redeploys the prior commit. |
| Docker/self-hosted | Deploy by immutable tag, e.g. `adiyogi-api:2.0.0-<git-sha>`; roll back by re-running the previous tag. Never deploy `:latest` only. |
| Database | There are **no migrations** (Mongoose models + auto-indexes). Code rollbacks are safe for additive schema changes; a destructive change (dropped field/collection) needs the Atlas backup restore path (§3.6). Take a manual snapshot before any destructive model change. |
| Config/secrets | Revert the Render env var to its previous value and redeploy; rotate compromised secrets immediately (all sessions/CSRF tokens invalidate). |

Rollback order for a bad release: **API first if the contract changed, SPA first otherwise** — the
contract is additive and the SPA tolerates the API being one version behind.

---

## 13. Scaling notes

- The API is **stateless** (sessions live in MongoDB, cookies client-side), so it can run multiple
  instances behind Render's load balancer. Raise `numInstances` in `render.yaml` when CPU/latency
  requires it.
- **Before raising `numInstances` above 1:** the rate limiters use `express-rate-limit`'s default
  **in-memory store**, i.e. per-process limits. Two instances double the effective global/auth/write
  budgets and make limits inconsistent. Move to a shared store (Redis) first — tracked in
  `docs/SECURITY.md` as a known limitation. This is why `render.yaml` pins `numInstances: 1`.
- `SEED_ON_START=true` on every instance is idempotent, but concurrent first boots can race on the
  seed's upserts; either accept it (upserts are safe) or seed once manually and set
  `SEED_ON_START=false` for multi-instance deployments.
- Mongoose pool is 10 connections per instance (`server/src/config/db.js`); size the Atlas tier for
  `instances × 10` plus headroom (M0's ~500 connection limit is plenty for a handful of instances).
- AI calls dominate worst-case latency: `AI_TIMEOUT_MS` (20 s) + one retry. nginx's
  `proxy_read_timeout` is 75 s for that reason; Render's proxy timeout is higher still. Do not lower
  the server timeout without lowering the provider budget.
- Static assets are served by Vercel's CDN (or nginx) with immutable caching; scale by CDN, not by
  app instances.
- Chat/crisis data is TTL-expired (30/90 days by default), so storage growth is bounded; forum
  content grows monotonically — revisit Atlas tier and text indexes as the dataset grows.

---

## 14. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Browser console: "blocked by CORS policy" / preflight 403 | SPA origin missing from `CLIENT_URL`/`CLIENT_URLS`, trailing slash, or scheme mismatch | Add the **exact** origin (`https://app.example.com`), redeploy the API. In layout C the browser never does CORS — if you see CORS errors there, the API base is absolute when it should be relative. |
| `403 CSRF_INVALID` on every POST/PATCH/DELETE | No CSRF token sent: the `ay_csrf` cookie was not set, the SPA never called a session/auth endpoint that returns `csrfToken`, or `COOKIE_SAMESITE`/domain settings prevent the cookie from being stored | Confirm `POST /api/v1/auth/session` returns `{data:{csrfToken}}` and the SPA caches it; confirm `GET /api/v1/auth/csrf` returns a token; confirm the client sends `x-csrf-token`. In layout B the in-memory fallback is the expected source (the cookie is not JS-readable). |
| Cookies "not set" / login appears to succeed then 401s | `Secure` cookie over plain HTTP, `SameSite=None` without `Secure`, wrong `COOKIE_DOMAIN`, or a cross-site third-party cookie block | Local: use `http://localhost` (secure context). Prod: HTTPS only; `COOKIE_SECURE=true`; layout A/C use `COOKIE_SAMESITE=lax` on a shared parent domain; layout B uses `none` and is subject to third-party-cookie blocking (Safari) — move to layout A/C if sessions drop. |
| Every API call 401s immediately | `ay_at` expired and `/auth/refresh` failing (refresh cookie path is `/api/v1/auth` — a proxy that rewrites the prefix breaks it), or `JWT_SECRET` changed between deploys | Check the request path under `/api/v1/auth`, check refresh response, keep `JWT_SECRET` stable across instances/deploys. |
| `SERVICE_UNAVAILABLE` / readiness 503, API boots then errors | Atlas unreachable: wrong URI/password, IP access list missing Render egress, SRV/TLS blocked, password not URL-encoded | Fix `MONGODB_URI`, add the egress IPs, re-test with `mongosh` (§3.7). Container restart-loops if the initial connection cannot be established — expected fail-fast. |
| Container exits immediately with `Invalid environment configuration` | Missing `JWT_SECRET`/`SESSION_SECRET`/`MONGODB_URI`, a secret shorter than 16 chars, or `CLIENT_URL` containing `localhost` under `NODE_ENV=production` | Fill the Render env vars; don't reuse the local `.env` for production. |
| `503 AI_UNAVAILABLE` in chat | `AI_API_KEY` missing/invalid, quota exceeded, provider outage | This is the honest, intended failure (no fabricated reply). Set/rotate the key, check Gemini quota; clients receive `retryAfterSeconds` + an explicitly-labelled guided exercise when `AI_FALLBACK_GUIDED=true`. |
| nginx returns `502 Bad Gateway` for `/api/*` | `API_UPSTREAM` wrong (missing scheme / wrong host:port) or the API container is down | `docker compose logs api`; set `API_UPSTREAM=http://api:4000` (compose) or the full external origin. |
| nginx container exits at start with a template/config error | `client/nginx.conf` edited with an unset `${VAR}` or invalid directive | Only `${API_UPSTREAM}` is substituted; nginx runtime variables must stay `$var`. Run `docker compose logs web`. |
| `/healthz` on web returns the SPA HTML | nginx `location = /healthz` missing/overridden | Keep the `location = /healthz` block ahead of the SPA fallback. |
| Deep links 404 on the static host | SPA rewrite missing/ordered after the API rewrite | Vercel: `/(.*)` → `/index.html` must be present; nginx: `try_files $uri $uri/ /index.html`. |
| `429 RATE_LIMITED` for legitimate users | Shared NAT/IP, or limits too tight | Tune `RATE_LIMIT_MAX`/`CHAT_RATE_LIMIT_MAX`; remember limits are per-instance/per-session. |
| Render service restarts every deploy start | Health check path wrong or too slow | `/health` is DB-free; if it still restarts, check container port (`PORT` must be respected — it is) and start time. |
| Vercel build fails on `npm run build -w client` | Root Directory accidentally set to `client`, or Node version mismatch | Clear Root Directory; `package.json` engines require Node ≥20 (set Node 20.x in Vercel project settings). |
| Mixed-content warnings | SPA on HTTPS calling an HTTP API | Always `https://` API origins; localhost-only for local development. |

---

## 15. What is NOT automated

Being explicit so nobody assumes more than the repo provides:

- **No deployment has been performed.** No live environment, no DNS, no TLS, no secrets exist yet.
- **No database migrations.** Schema/index changes ride on Mongoose's auto-indexing; destructive
  changes require backups and a manual plan.
- **No automated secret provisioning/rotation.** Render/Vercel dashboard values are managed by hand;
  there is no Vault/SOPS/Doppler integration.
- **No image publishing.** CI builds the images (`push: false`) but nothing is pushed to a registry.
- **No CI-triggered deploys.** Render/Vercel deploy from their own Git integrations; gating deploys on
  CI requires adding deploy hooks (not configured).
- **No automated backups.** M0 has none by default; M10+ continuous backup or scheduled `mongodump`
  must be enabled in Atlas/elsewhere.
- **No alerting/observability stack.** No Sentry/OpenTelemetry/Prometheus; logs only. An external
  uptime monitor must be configured manually.
- **No horizontal autoscaling.** `numInstances: 1` is deliberate (in-memory rate limiter); scaling
  needs a shared limiter store first.
- **No domain/DNS automation**, no CDN rules beyond `vercel.json`/nginx headers.
- **No load/performance testing, no disaster-recovery drill, no penetration test.**
- **No backup restore verification** — that must be executed and recorded by the deployer.
- `CORS_ALLOW_NULL_ORIGIN` appears in ARCHITECTURE §9 but is not consumed by the current
  `server/src/config/env.js`; origin-less requests are treated as non-browser traffic. Do not set it
  expecting behaviour.

---

## 16. Verification performed for this configuration

Everything below was executed in the implementation environment. **There is no Docker CLI or daemon in that
environment**, so no image was built or run there; the YAML/JSON/config parsing and the npm install
strategy were verified with real commands, and the image build + web-image smoke test are executed by
CI (`docker-build` job).

| Check | Command | Result |
|---|---|---|
| Lockfile/workflow sync (CI `npm ci`) | `npm_config_cache="$PWD/.npm-cache" npm ci --dry-run` | exit 0 — lockfile in sync with all workspace manifests |
| API image install strategy | `npm ci --omit=dev --workspace server --include-workspace-root --dry-run` (then a real install in a temp dir with only the 4 manifests) | 154 packages; all runtime deps present; jest/eslint/nodemon/supertest/mongodb-memory-server/vite/react absent |
| Web image install strategy | `npm ci --workspace client --dry-run` (real install in a temp dir) | 430 packages; vite/tailwind/react/router/testing-library present; root `concurrently` absent; `vite` binary linked |
| `Dockerfile` HEALTHCHECK | node one-liner against a local HTTP server (200 and 500 cases) | exit 0 on 200, exit 1 on failure |
| `docker-compose.yml` | `python3 -c "import yaml; yaml.safe_load(...)"` | valid YAML; services `mongo`, `api`, `web`; volume `mongo-data` |
| `.github/workflows/ci.yml` | same PyYAML parse + job/step inspection | valid YAML; 4 jobs; triggers push/PR on `main`; `permissions: contents: read`; `docker-build` needs `quality` + `api-tests` |
| `render.yaml` | PyYAML parse | valid YAML; `runtime: docker`, `/health`, 1 instance, 8 `sync: false` vars |
| `vercel.json` | `python3 -c "import json; json.load(...)"` | valid JSON; monorepo build/output paths; rewrites + headers |
| `.dockerignore` | pattern audit against files each image needs | `client/src`, `server/src`, manifests, `client/index.html`, `vite.config.js` are **not** excluded; `node_modules`, `dist`, `.env*`, tests, docs, legacy v1 tree are excluded |
| `client/nginx.conf` | envsubst emulation (render with `API_UPSTREAM=http://api:4000`) + structural lint + CSP parity check against `vercel.json` | all `${...}` placeholders resolved; braces balanced; SPA fallback/proxy/gzip/cache/healthz/security headers present; identical CSP directives to the Vercel variant except the documented `connect-src https:` relaxation. No local nginx binary to run `nginx -t` — covered by the CI smoke test |
| Client production build (what Vercel + CI run) | `npm run build -w client` | success — `client/dist/` with `index.html` (`<div id="root">`), hashed `assets/**`, `favicon.svg`, `robots.txt`; confirms the `buildCommand`/`outputDirectory` pair in `vercel.json` |
| Container base images | Docker Hub registry API + Alpine package index | `node:20-alpine`, `nginx:alpine`, `mongo:7` tags exist and are active; `tini` exists only in Alpine *community* (why the image uses node-as-PID-1 plus compose `init: true` instead) |
| `server/.env.example` | compared with root `.env.example` and ARCHITECTURE §9 | 28/28 implemented variables, identical names, no drift |
| `client/.env.example` | compared with `import.meta.env` usage in `client/src` | `VITE_API_BASE_URL` (the only var read by the app code) + `VITE_APP_NAME` + dev-only `VITE_PROXY_TARGET` |
| Patched `client/src/api/client.js` base handling | re-implemented its `buildUrl()` in Node: relative base `/api/v1` → `/api/v1/auth/session`; absolute base `https://api.example.com/api/v1` → `https://api.example.com/api/v1/auth/session`; absolute Render URL likewise | both topologies behave as documented (absolute base honoured, same-origin stays relative) |

What still must be verified by CI or the first real deploy (not possible locally):

1. `docker build` of both images (`docker-build` CI job).
2. nginx config renders and serves: CI smoke test asserts `/healthz` → 200, SPA deep-link fallback,
   and a `Content-Security-Policy` header on the web image.
3. Render blueprint sync and env-var validation (Render's own validation + first boot logs).
4. Vercel monorepo build with the specific project settings (`npm run build -w client`,
   `client/dist`).
5. The full browser flow (cookies + CORS + CSRF) in the chosen layout — checklist §10 step 14.
