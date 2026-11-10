# 🕉️ AdiYogi

**A production-grade, anonymous mental-health peer support platform** — community forum, AI
companion, and crisis resources built as one secure full-stack application.

> AdiYogi is peer support and AI-assisted coping support. It is **not** a therapist, does not
> diagnose, and cannot monitor emergencies. If you are in danger, contact your local emergency
> number (see the crisis page for verified helplines by region).

---

## Table of contents

- [What's in the product](#whats-in-the-product)
- [Architecture](#architecture)
- [Technology stack](#technology-stack)
- [Repository structure](#repository-structure)
- [Prerequisites](#prerequisites)
- [Quick start (local)](#quick-start-local)
- [Environment configuration](#environment-configuration)
- [MongoDB setup](#mongodb-setup)
- [Running the app](#running-the-app)
- [Testing](#testing)
- [API documentation](#api-documentation)
- [Deployment](#deployment)
- [Security & privacy](#security--privacy)
- [Troubleshooting](#troubleshooting)
- [Project history](#project-history)
- [License](#license)

---

## What's in the product

Everything below is implemented, wired to the API, persisted in MongoDB, and covered by automated
tests. Nothing here is a mock or a placeholder.

### Anonymous community forum
- **Anonymous-first identity** — the server issues an anonymous session (no email, no name); posts
  are shown simply as **Anonymous** (no username is assigned). No registration required to read,
  post, reply, chat or use crisis tools.
- **Boards** with descriptions, support level (general / peer / crisis), guidelines, tags and live
  thread/reply counters.
- **Threads and replies** with title, body, content warnings, tags, pagination, sort
  (recent activity / newest / most replies), board filtering and full-text search.
- **Ownership and moderation** — you can edit your thread for 15 minutes and delete your own
  content; moderators/admins can hide, remove, pin and lock content.
- **Reports & moderation queue** — report threads/replies with a reason; moderators work a queue,
  take audited actions (`hide`, `unhide`, `delete`, `pin`, `lock`), resolve reports and review the
  moderation audit log.
- **Notifications** — the thread author is notified about replies (no message content in
  notifications), with unread counts and mark-as-read.
- **Preferences** — alias, crisis-bar visibility, content-warning default, reduced motion.
- **Data deletion** — one action removes your session/account, your posts and your conversations.

### AI companion (`/chat`)
- Server-side **Google Gemini** integration (the API key never reaches the browser).
- Persistent conversations with message history, a clear **AI disclosure**, warm/safe system
  prompt (no diagnosis, no therapy claims, no dosage advice, no monitoring promises).
- **Honest failure handling** — if the provider is unavailable the API returns
  `503 AI_UNAVAILABLE`; the UI shows a retry path plus crisis resources (and, when enabled, an
  explicitly-labelled *non-AI* guided exercise). No canned reply is ever presented as AI.
- Conversation deletion, retention limits (TTL), per-session rate limiting.

### Crisis support (`/crisis`)
- **Layered risk assessment** (weighted phrase patterns with negation/third-person handling + an
  optional AI classifier that can only *raise* severity) — never a diagnosis, never a label.
- **Verified, region-aware helplines** for US, IN, GB, CA, AU + an international fallback, served
  from a single server-side data source (the UI never hard-codes numbers).
- **Always-available manual access** — no detection needed to reach help.
- Coping tools: accessible breathing exercise, 5-4-3-2-1 grounding, cold-water technique,
  reach-out checklist; warning-signs and how-to-help sections.
- **Privacy-preserving events** — only metadata (level, source, region, whether resources were
  shown) is stored, never the words a person typed. TTL-retained.

### Platform
- Separate API + web app, MongoDB as the single source of truth (no `localStorage` database).
- Server-side sessions with short-lived JWT access cookies, rotating opaque refresh tokens,
  CSRF double-submit protection, rate limiting, Helmet headers, CORS allow-list, zod validation,
  centralised error handling and structured logging.
- Health/readiness endpoints, OpenAPI documentation, Docker, docker-compose, GitHub Actions CI and
  deployment runbooks.

---

## Design language

AdiYogi is designed as a *digital sanctuary*: calm cream surfaces for reading, deep forest and
cosmic-night surfaces for contemplative moments, and antique gold used sparingly as the divine
accent. No stock photography, no temple imagery and no religious wallpapers are shipped.

| Token | Value | Use |
|---|---|---|
| Soft cream / warm ivory | `#F5F0E6` / `#FFFDF7` | page and card surfaces |
| Deep forest green | `#173F38` | primary actions, headings, trust |
| Antique gold / muted saffron | `#B88A42` / `#D6A35D` | accents, active indicators, sacred highlights |
| Cosmic blue | `#142D46` | hero, meditation and inspiration sections |
| Sage / lavender | `#A8BFA8` / `#D9D5E8` | category atmospheres, quiet secondary surfaces |
| Muted clay | `#A8442C` | crisis surfaces only |

- **Original deity illustrations**: Adiyogi (meditating Shiva), Rama and Vishnu are hand-built
  layered **SVG illustrations** in `client/src/components/deities/` — no photographs, no third-party
  artwork, no image payload. They animate with CSS only (breathing aura, drifting particles, hair
  sway, rotating chakra) rather than WebGL.
- **Motion system**: scroll reveals and gentle parallax via `IntersectionObserver` + rAF
  (`client/src/components/motion/`), CSS keyframes for auras/particles/waves. No animation library,
  no layout thrash; every animation is disabled under `prefers-reduced-motion` and the in-app
  reduced-motion preference.
- **Typography**: self-hosted Playfair Display (headings), Manrope (body) and Noto Sans Devanagari
  (shlokas) in `client/src/assets/fonts/` — **no third-party font requests**, which matters on a
  mental-health platform.
- **Sanskrit wisdom**: five authentic Bhagavad Gita verses (with reference, transliteration,
  meaning and a reflection) in `client/src/data/shlokas.js`, shown as accessible cards and always
  paired with the statement that wisdom is not a substitute for professional care.
- **Category atmospheres**: eight distinct animated scenes (water, sunrise, nature, night, river,
  warm light, mountain, moonlight) so no two wellness spaces look identical.

## Architecture

```
┌──────────────────────────────┐        HTTPS, JSON, httpOnly cookies
│  client/  React 18 + Vite    │ ─────────────────────────────────────┐
│  Tailwind design system      │                                      │
│  api/client.js (one layer)   │                                      ▼
└──────────────────────────────┘                        ┌───────────────────────────────┐
                                                        │  server/  Node + Express      │
                                                        │  /api/v1  routes→controllers  │
                                                        │  →services→models             │
                                                        │  auth · forum · chat · crisis │
                                                        │  moderation · notifications   │
                                                        └───────────────┬───────────────┘
                                                                        │ Mongoose (pooled)
                                                                        ▼
                                                        ┌───────────────────────────────┐
                                                        │ MongoDB (Atlas in production) │
                                                        └───────────────────────────────┘
```

A **modular monolith**: one API deployable, clear internal modules, so individual domains
(chat, crisis, moderation) can be extracted later without redesigning the data model.
See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full design, API/database contracts and
security model.

### Authentication model
| Caller | How it is identified | What it can do |
|---|---|---|
| Anonymous visitor | Server-issued anonymous **session** (256-bit token, hashed at rest, httpOnly cookie) + 15-min JWT access cookie | Read, post, reply, report, chat, crisis tools, preferences, delete own data |
| Account (member) | Email + password (bcrypt, cost 12), server session | Member capabilities + optional continuity across devices |
| Moderator | Account with `role: moderator` | Hide/remove content, pin/lock, manage reports, view audit log/stats |
| Admin | Account with `role: admin` | Moderator capabilities + manage boards |

Role is always read from the database on each request — a token claim is never trusted for
authorization. Full lifecycle details: [`docs/SECURITY.md`](docs/SECURITY.md).

---

## Technology stack

| Layer | Technology |
|---|---|
| Web | React 18, React Router 6, Vite 5, Tailwind CSS 3 (custom design tokens) |
| API | Node.js 20+, Express 4, zod validation, Helmet, express-rate-limit, winston |
| Data | MongoDB 7 (Atlas in production) with Mongoose 8 (schemas, indexes, TTL retention) |
| Auth | bcryptjs, JSON Web Tokens (access), opaque server-side sessions (refresh), CSRF double-submit |
| AI | Google Gemini via `@google/generative-ai` — server-side only, feature-flagged by env |
| Tests | Jest + supertest + mongodb-memory-server (API), Vitest + Testing Library (web), API-level E2E journey |
| Ops | Docker, docker-compose, GitHub Actions, Render/Vercel blueprints, MongoDB Atlas |

---

## Repository structure

```
ADIYOGI/
├── client/                     # React + Vite web application
│   ├── src/
│   │   ├── api/                # single API layer: client.js + endpoints.js
│   │   ├── components/         # ui/ layout/ forum/ chat/ crisis/ moderation/ common/
│   │   ├── context/            # IdentityContext, ToastContext
│   │   ├── hooks/              # useApiResource, useDebouncedValue, ...
│   │   ├── lib/                # formatting, error mapping, constants
│   │   ├── pages/              # landing, community, board, thread, chat, crisis, ...
│   │   ├── styles/             # Tailwind entry + design-system classes
│   │   └── __tests__/          # component tests (Vitest)
│   └── vite.config.js  tailwind.config.js  Dockerfile  nginx.conf
├── server/                     # Express API
│   ├── src/
│   │   ├── config/             # env validation, logger, db connection, swagger
│   │   ├── models/             # Mongoose schemas + indexes + serialization
│   │   ├── middleware/         # auth, csrf, validate, rate limits, errors, headers
│   │   ├── routes/v1/          # auth, users, boards, threads, replies, reports,
│   │   │                       # moderation, chat, crisis, notifications, health, docs
│   │   ├── controllers/ services/ validators/ utils/ data/
│   │   ├── app.js              # express app factory
│   │   └── server.js           # lifecycle: connect, listen, graceful shutdown
│   ├── scripts/                # seed boards, create admin
│   └── tests/                  # unit, integration, e2e
├── docs/                       # audit, architecture, API, DB, security, testing, deployment
├── .github/workflows/ci.yml    # install → lint → test → build → docker
├── docker-compose.yml  Dockerfile  render.yaml  vercel.json
├── .env.example                # every variable, documented
└── package.json                # npm workspaces + orchestration scripts
```

---

## Prerequisites

- **Node.js ≥ 20** and npm ≥ 10
- **MongoDB 7** locally (or a free MongoDB Atlas cluster)
- Optional: Docker + Docker Compose
- Optional: a Google AI Studio API key for the AI companion (the app runs without one — chat
  returns a clear "AI unavailable" state instead of fake replies)

---

## Quick start (local)

```bash
# 1. Clone and install (installs both workspaces)
git clone https://github.com/klrajput/ADIYOGI.git
cd ADIYOGI
npm install

# 2. Configure environment
cp .env.example .env
# edit .env: set JWT_SECRET and SESSION_SECRET (openssl rand -hex 32),
#            MONGODB_URI, and optionally AI_API_KEY

# 3. Start MongoDB (or use Atlas in MONGODB_URI)
#    macOS (Homebrew):
brew services start mongodb-community
#    Docker:
docker run -d --name adiyogi-mongo -p 27017:27017 mongo:7

# 4. Seed boards (idempotent) and start both apps
npm run seed
npm run dev        # API on http://localhost:4000, web on http://localhost:5173
```

Or with Docker Compose (Mongo + API + web):

```bash
cp .env.example .env            # set the two secrets
docker compose up --build       # web on http://localhost:8080, API on http://localhost:4000
```

Verify the API is alive:

```bash
curl http://localhost:4000/health
curl http://localhost:4000/health/ready     # includes MongoDB state
```

---

## Environment configuration

All variables are documented in [`.env.example`](.env.example). The important ones:

| Variable | Required | Purpose |
|---|---|---|
| `MONGODB_URI` | ✅ | MongoDB connection string (local or Atlas) |
| `JWT_SECRET` | ✅ (prod) | Signs 15-minute access tokens; `openssl rand -hex 32` |
| `SESSION_SECRET` | ✅ (prod) | HMAC for CSRF tokens and IP hashing; `openssl rand -hex 32` |
| `CLIENT_URL` / `CLIENT_URLS` | ✅ | CORS allow-list (the web origin) |
| `PORT` | — | API port (default `4000`) |
| `AI_API_KEY` | — | Google Gemini key (**server-only**; chat degrades honestly without it) |
| `AI_MODEL` | — | Gemini model (default `gemini-2.0-flash`) |
| `COOKIE_SAMESITE` | — | `lax` (same parent domain, recommended) or `none` (cross-domain HTTPS) |
| `CHAT_RETENTION_DAYS` | — | TTL for conversations/messages (default 30) |
| `CRISIS_EVENT_RETENTION_DAYS` | — | TTL for crisis metadata (default 90) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | — | Bootstrap an admin account on start (optional) |

**Never commit `.env`.** Only `.env.example` is tracked. The server refuses to start in
production with missing/short secrets.

The web app only uses `VITE_API_BASE_URL` (default `/api/v1`, proxied to the API in development).
Anything prefixed `VITE_` is public by definition — never put secrets there.

---

## MongoDB setup

**Local**: `mongodb://127.0.0.1:27017/adiyogi` — no configuration needed beyond running MongoDB.

**MongoDB Atlas (production)** — step-by-step in [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md):
create an M0+ cluster, a least-privilege database user, allow your API host's egress IPs (or
`0.0.0.0/0` with strong credentials + TLS), then set:

```env
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/adiyogi?retryWrites=true&w=majority
```

Schemas, indexes and TTL retention are created automatically by Mongoose on first use
(`server/src/models/**`, documented in [`docs/DATABASE_SCHEMA.md`](docs/DATABASE_SCHEMA.md)).

Useful commands:

```bash
npm run seed                       # upsert the 9 default boards (idempotent)
npm run create:admin -- --email you@example.com --password '<strong-password>'
```

---

## Running the app

| Command | What it does |
|---|---|
| `npm run dev` | API (`:4000`, nodemon) + web (`:5173`, Vite) together |
| `npm run dev:server` | API only |
| `npm run dev:client` | Web only (proxies `/api` → `:4000`) |
| `npm run build` | Production build of the web app → `client/dist` |
| `npm start` | Production API (`node server/src/server.js`) |
| `npm run lint` | ESLint for both workspaces |
| `npm run seed` | Idempotent board seeding |
| `npm run create:admin` | Create/promote an admin account |

The API exposes:
`/health`, `/healthz`, `/health/ready`, `/api/v1/*`, `/api/docs` (Swagger UI),
`/api/docs/openapi.json`.

---

## Testing

```bash
npm test                 # API unit+integration (Jest) then web components (Vitest)
npm run test:server      # server only — uses mongodb-memory-server, no external DB needed
npm run test:client      # web only
npm run test:coverage    # server coverage report
```

Test suites cover: utilities and the risk scorer, authentication/session/CSRF lifecycle,
authorization matrix, forum CRUD + search/filter/sort/pagination, replies + notifications, reports
and the moderation workflow + audit log, preferences, data deletion, chat (provider configured /
unconfigured / failing), crisis resources and metadata-only events, health/readiness,
validation/error envelopes, rate limits, CORS/security headers, and an API-level end-to-end user
journey. Details and the failure-scenario matrix: [`docs/TESTING.md`](docs/TESTING.md).

`npm test` requires no external services — the API suite starts an in-memory MongoDB.

---

## API documentation

- Human-readable reference with auth flow, every endpoint, error codes and examples:
  [`docs/API_DOCUMENTATION.md`](docs/API_DOCUMENTATION.md)
- Interactive OpenAPI 3 documentation: run the API and open <http://localhost:4000/api/docs>
  (raw spec at `/api/docs/openapi.json`)
- Conventions: success/error envelopes, pagination `meta`, error codes and authorization rules are
  defined in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) §4–§6.

---

## Deployment

Target architecture: **web on Vercel (or Netlify), API on Render/Railway/Fly (Docker), MongoDB
Atlas**. Full runbook — environment matrix, Atlas setup, cookie/CORS caveats for cross-domain
hosting, CI/CD, health checks, rollback and troubleshooting — in
[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

Minimum production checklist:

- `NODE_ENV=production`, strong `JWT_SECRET`/`SESSION_SECRET`, real `MONGODB_URI`
- `CLIENT_URL` set to the deployed web origin and API behind HTTPS
- Cookies: keep web + API on one parent domain (`lax`), or use `COOKIE_SAMESITE=none` +
  `COOKIE_SECURE=true` with HTTPS when they are on different registrable domains
- `npm run seed` once against the production database
- Verify `/health/ready` returns 200 and `/api/docs` loads

---

## Security & privacy

This is a sensitive-data application, so the defaults are deliberately conservative:

- Server-issued sessions only; no client-generated identity. Access tokens live in `httpOnly`
  cookies; refresh tokens are opaque and stored hashed; CSRF double-submit is enforced on all
  state-changing requests.
- Passwords use bcrypt (cost 12) with login lockout; roles are re-checked in the database per request.
- All input is validated with zod; the API returns JSON only and the UI renders all user/AI text as
  plain text (no `dangerouslySetInnerHTML`), which removes the XSS surface.
- Rate limits on authentication, writes, reports, chat and crisis assessments.
- **Privacy engineering**: no raw IPs stored or logged (only a keyed hash), no chat/crisis content in
  logs, crisis events store metadata only, TTL retention for conversations and crisis events,
  user-initiated deletion, no third-party fonts/analytics in the web bundle.
- Security headers (Helmet), CORS allow-list, request-size limits, structured logs with request ids.
- No claim of legal compliance or certification — that requires a real assessment. See
  [`docs/SECURITY.md`](docs/SECURITY.md) for the threat model, controls, and known limitations
  (e.g. no email verification/password reset yet).

---

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `Invalid environment configuration` on start | `JWT_SECRET`/`SESSION_SECRET` missing or < 16 chars. Generate with `openssl rand -hex 32`. |
| `MongooseServerSelectionError` | MongoDB not running / wrong `MONGODB_URI` / Atlas IP allow-list. Check `/health/ready`. |
| `403 CSRF_INVALID` on writes | Stale cookies. Reload the app (it bootstraps a session) or clear cookies for the API origin. |
| `401` on every write | Cookies blocked (cross-site without `COOKIE_SAMESITE=none` + HTTPS) or `CLIENT_URL` mismatch. |
| CORS error in browser | Add the exact web origin to `CLIENT_URL`/`CLIENT_URLS` (scheme + host + port, no trailing slash). |
| Chat always shows "AI unavailable" | `AI_API_KEY` not set (or invalid/quota). This is the honest fallback — the rest of the app works. |
| Boards are empty | Run `npm run seed`. |
| Tests fail to download MongoDB | `mongodb-memory-server` needs network on first run; set `MONGOMS_DOWNLOAD_DIR` to a writable dir. |
| Port 4000/5173 already in use | Change `PORT` / Vite `server.port`; the web proxy target can be set with `VITE_PROXY_TARGET`. |

---

## Project history

v1 was a front-end prototype (React + `localStorage`, a keyword chatbot, Firebase config that was
never used). The complete v2 overhaul — audit, backend, MongoDB, authentication, AI integration,
crisis handling, moderation, redesign, tests and deployment tooling — is documented in
[`docs/TECHNICAL_AUDIT.md`](docs/TECHNICAL_AUDIT.md) (what was broken and why) and
[`docs/MIGRATION_FROM_PROTOTYPE.md`](docs/MIGRATION_FROM_PROTOTYPE.md) (what changed). The legacy
code remains in git history.

## License

MIT — see [LICENSE](LICENSE).
