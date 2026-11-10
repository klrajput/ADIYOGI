# AdiYogi — Target Architecture & Engineering Contracts

**Status:** authoritative for the production overhaul.
Every agent works against the contracts in this document. If an implementation needs to change a
shared contract, it must be reported to the orchestrator **before** merging.

---

## 1. System architecture

**Modular monolith**, not microservices. One API deployable, one static frontend, one database.

```
┌──────────────────────────────────────────────────────────────────┐
│ client/  React 18 + Vite + Tailwind + React Router 6             │
│  pages → features → components/ui                                 │
│  lib/api.js  (single API service layer, credentials: 'include')   │
│  No domain data in localStorage (only UI prefs like theme)        │
└───────────────────────────┬──────────────────────────────────────┘
                            │ HTTPS, JSON, httpOnly cookies
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│ server/  Node 20 + Express 4  →  /api/v1                          │
│  routes → controllers → services → models                        │
│  middleware: requestId, logger, securityHeaders, cors, csrf,      │
│              rateLimit, auth, validate(zod), errorHandler        │
│  modules: auth · users · boards · threads · replies · reports ·   │
│           moderation · chat(AI) · crisis · notifications · health │
└───────────────────────────┬──────────────────────────────────────┘
                            │ Mongoose 8 (pooled)
                            ▼
                    MongoDB (Atlas in prod / local in dev)
```

Design rules:
- Controllers never touch Mongoose directly except through a service or model static.
- Services own business rules and are unit-testable without HTTP.
- Every response uses the envelope in §4. No route returns a bare object.
- No secret ever reaches the client bundle. No AI call from the browser.
- MongoDB is the single source of truth. `localStorage` holds no forum/chat/crisis data.

---

## 2. Repository structure (final)

```
ADIYOGI/
├── package.json                 # npm workspaces root: ["server","client"], orchestration scripts
├── .env.example                 # documented variables (never real secrets)
├── .gitignore  .dockerignore
├── docker-compose.yml           # local dev: mongo + api + web
├── Dockerfile                   # multi-stage: api image (and web via client/Dockerfile)
├── render.yaml                  # backend blueprint (optional deploy target)
├── vercel.json                  # frontend deploy config (SPA rewrites)
├── README.md
├── LICENSE
├── docs/
│   ├── TECHNICAL_AUDIT.md       # Phase-1 audit (done)
│   ├── ARCHITECTURE.md          # this file
│   ├── API_DOCUMENTATION.md
│   ├── DATABASE_SCHEMA.md
│   ├── SECURITY.md
│   ├── TESTING.md
│   ├── DEPLOYMENT.md
│   └── MIGRATION_FROM_PROTOTYPE.md
├── .github/workflows/ci.yml
├── server/
│   ├── package.json  jest.config.js  .env.example
│   ├── scripts/seedBoards.js  scripts/createAdmin.js
│   ├── src/
│   │   ├── app.js  server.js
│   │   ├── config/{env.js,db.js,logger.js,swagger.js}
│   │   ├── models/*.js
│   │   ├── middleware/*.js
│   │   ├── routes/v1/{index.js,auth.routes.js,...}
│   │   ├── controllers/*.js
│   │   ├── services/*.js + services/ai/*.js
│   │   ├── validators/*.js
│   │   ├── data/{boards.seed.js,crisisResources.js}
│   │   └── utils/*.js
│   └── tests/{setup.js,unit/**,integration/**,e2e/**}
└── client/
    ├── package.json  vite.config.js  tailwind.config.js  postcss.config.js  index.html  .env.example
    └── src/
        ├── main.jsx  App.jsx
        ├── api/{client.js,endpoints.js}
        ├── components/{ui,layout,forum,chat,crisis,common}/*.jsx
        ├── context/*.jsx
        ├── hooks/*.js
        ├── lib/*.js
        ├── pages/*.jsx
        ├── styles/index.css
        └── __tests__/**
```

**Deleted at the end of the overhaul (after porting their useful content):**
`config/`, `scripts/` (vendored CRA), `src/` (old app), `public/` (old), `functions/`,
`firebase.json`, `firestore.rules`, `firestore.indexes.json`, `community-forum/`, `chatbot/`,
`mythology-app` gitlink, `setup.sh`, `setup.bat`, `.env`. Git history preserves them.

---

## 3. Technology decisions

| Area | Decision | Rationale |
|---|---|---|
| Backend | Node 20+, Express 4, Mongoose 8, zod, helmet, cors, express-rate-limit, bcryptjs, jsonwebtoken, winston, swagger-ui-express | Modular monolith, minimal infra, well-supported |
| Frontend | React 18, Vite 5, React Router 6, Tailwind 3, plain JS | Existing app is React/JS; Vite removes the vendored-CRA debt; Tailwind enforces one design system |
| DB | MongoDB Atlas (prod) / local Mongo (dev); `mongodb-memory-server` (tests) | Mandated |
| AI | Google Gemini via `@google/generative-ai`, **server only** | It is the provider already referenced by the repo; API key stays server-side |
| Auth | Opaque refresh session (hashed at rest) + 15-min JWT access cookie; CSRF double-submit | Secure cookies, revocable sessions, anonymous-first |
| Tests | Jest + supertest + mongodb-memory-server (server); Vitest + Testing Library (client) | Fast, no external services |
| Deploy | API on Render/Railway/Fly (Docker), web on Vercel/Netlify, DB on Atlas | Lowest operational complexity |

---

## 4. API conventions

Base path: `/api/v1`. All JSON. All non-GET requests require a CSRF header (§6.3).
Versioning: future breaking changes go to `/api/v2`.

### 4.1 Success envelope

```json
{
  "success": true,
  "message": "Thread created",
  "data": { },
  "meta": { }
}
```

- `data` may be an object or array. `meta` is `{}` for single resources and contains pagination
  for collections: `{ "page":1, "limit":20, "total":137, "totalPages":7, "hasNext":true, "hasPrev":false }`.
- Error envelope (any non-2xx):

```json
{
  "success": false,
  "message": "Validation failed",
  "error": { "code": "VALIDATION_ERROR", "details": [{ "path": "body.title", "message": "Required" }] },
  "requestId": "01H..."
}
```

### 4.2 Error codes → HTTP status

| code | status | when |
|---|---|---|
| `VALIDATION_ERROR` | 400 | zod/params/query failure |
| `UNAUTHENTICATED` | 401 | no/invalid/expired session |
| `CSRF_INVALID` | 403 | missing/mismatched CSRF token |
| `FORBIDDEN` | 403 | authenticated but not allowed |
| `NOT_FOUND` | 404 | resource missing or not visible |
| `CONFLICT` | 409 | duplicate (email, report, etc.) |
| `PAYLOAD_TOO_LARGE` | 413 | body over limit |
| `RATE_LIMITED` | 429 | limiter tripped (`error.details.retryAfter` seconds) |
| `CONTENT_BLOCKED` | 422 | content policy violation |
| `AI_UNAVAILABLE` | 503 | provider missing/failed; **never** substituted with fake AI text |
| `SERVICE_UNAVAILABLE` | 503 | dependency down (DB, etc.) |
| `INTERNAL_ERROR` | 500 | unexpected |

### 4.3 Endpoint contract (implemented surface)

**Auth** (`/api/v1/auth`)
| Method | Path | Auth | Body / Query | Returns |
|---|---|---|---|---|
| POST | `/session` | public (rate-limited) | `{}` | `{identity}` — creates/reuses an anonymous session, sets cookies |
| GET | `/me` | any | — | `{identity}` |
| GET | `/csrf` | any | — | `{csrfToken}` (also sets readable cookie) |
| POST | `/register` | public | `{email, password, displayName?}` | `{identity}` role `member` |
| POST | `/login` | public | `{email, password}` | `{identity}` |
| POST | `/logout` | any | — | `{}` — revokes session, clears cookies |
| POST | `/refresh` | session cookie | — | `{identity}` — rotates refresh token |

`identity` object:
```json
{
  "id": "public-anon-id-or-user-id",
  "kind": "anonymous" | "user",
  "role": "member" | "moderator" | "admin",
  "alias": "Seeker 4F2A",
  "createdAt": "ISO",
  "isAnonymous": true,
  "preferences": { "displayAlias": "Seeker 4F2A", "showCrisisBar": true, "contentWarningDefault": false, "reduceMotion": false }
}
```

**Users** (`/api/v1/users`)
| Method | Path | Auth | Body | Returns |
|---|---|---|---|---|
| GET | `/me/preferences` | any | — | `{preferences}` |
| PATCH | `/me/preferences` | any | `{displayAlias?, showCrisisBar?, contentWarningDefault?, reduceMotion?}` | `{preferences}` |
| GET | `/me/content` | any | `?type=threads\|replies` | paginated own content |
| DELETE | `/me` | any | `{deleteContent?: boolean}` | deletes account/session + content; 204 |

**Boards** (`/api/v1/boards`)
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/` | public | list with live `threadCount`, `replyCount`, `lastActivityAt` |
| GET | `/:slug` | public | one board |
| POST | `/` | admin | create board |
| PATCH | `/:slug` | admin | update board |
| DELETE | `/:slug` | admin | deactivate board (soft) |

**Threads** (`/api/v1/threads`)
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/` | public | `?board=&q=&tag=&sort=recent\|new\|replies&page=&limit=` (limit ≤ 50) |
| POST | `/` | any session | `{boardSlug,title,body,tags?,contentWarning?}` → crisis assessment included |
| GET | `/:id` | public | increments viewCount; adds `isOwner` |
| PATCH | `/:id` | owner (15 min) / moderator | title/body/tags/CW; mods may set `isPinned`,`isLocked` |
| DELETE | `/:id` | owner / moderator | soft delete → `status:'deleted'` |
| GET | `/:id/replies` | public | `?page=&limit=&sort=old\|new` |
| POST | `/:id/replies` | any session | `{body,contentWarning?}`; creates notification for thread owner |

**Replies** (`/api/v1/replies`)
| Method | Path | Auth | Notes |
|---|---|---|---|
| DELETE | `/:id` | owner / moderator | soft delete |

**Reports** (`/api/v1/reports`)
| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/` | any session | `{targetType:'thread'\|'reply', targetId, reason, details?}`; 1 per target per reporter |
| GET | `/` | moderator+ | `?status=open\|reviewing\|resolved\|dismissed&page=` |
| PATCH | `/:id` | moderator+ | `{status, resolutionNote?}` |

**Moderation** (`/api/v1/moderation`)
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/queue` | moderator+ | open reports + hidden content |
| POST | `/actions` | moderator+ | `{action:'hide'\|'unhide'\|'delete'\|'pin'\|'unpin'\|'lock'\|'unlock', targetType, targetId, reportId?, reason}` |
| GET | `/actions` | moderator+ | audit log, paginated |
| GET | `/stats` | moderator+ | counts (reports, hidden, crisis events 30d aggregate) |

**Chat** (`/api/v1/chat`)
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/conversations` | any session | own conversations, paginated |
| POST | `/conversations` | any session | `{title?}` → conversation |
| GET | `/conversations/:id` | owner | `{conversation, messages}` |
| POST | `/conversations/:id/messages` | owner | `{content}` (≤ 2000) → `{userMessage, assistantMessage, risk, ai}` — 429/503 handled explicitly |
| DELETE | `/conversations/:id` | owner | hard delete conversation + messages (privacy) |

`assistantMessage.ai` = `{ provider: "gemini"|"none", model, degraded: false }`. When the provider
is unavailable the endpoint returns `503 AI_UNAVAILABLE` with
`error.details = { retryAfterSeconds: 20, canUseGuidedMode: true }` — **no fabricated AI reply**.

**Crisis** (`/api/v1/crisis`)
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/resources` | public | `?country=IN\|US\|GB\|CA\|AU` → verified regional helplines + international fallback + `lastVerified` |
| POST | `/assess` | session (rate-limited) | `{text, source?}` → `{level:'none'\|'low'\|'elevated'\|'high', showResources, reasons:[codes]}`; **text is not stored** |
| POST | `/events` | session (rate-limited) | `{level, source:'manual'\|'chat'\|'content'\|'assessment', country?}` → `{acknowledged:true, resources}`; stores metadata only |

**Notifications** (`/api/v1/notifications`)
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/` | any session | `?unreadOnly=true&page=` |
| PATCH | `/:id/read` | owner | mark read |
| POST | `/read-all` | any session | mark all read |

**Health** (`/api/v1/health`, unversioned aliases `/health`, `/healthz`)
| Method | Path | Notes |
|---|---|---|
| GET | `/health` | liveness: `{status:'ok', uptime, version}` — no DB dependency |
| GET | `/health/ready` | readiness: pings Mongo; 503 when down |

**Docs**: `GET /api/docs` (Swagger UI), `GET /api/docs/openapi.json`.

---

## 5. Database models (contract)

Mongoose pluralised collections. All models `timestamps: true`. All have `toJSON` transforms that
strip internal fields (`__v`, hashes, refs that leak identity). Every document has `_id` but the
API exposes `id` (string).

| Model | Key fields | Indexes |
|---|---|---|
| `User` | `email` (unique, lowercase, select:false), `passwordHash` (bcrypt 12, select:false), `role: 'member'\|'moderator'\|'admin'`, `displayName`, `status:'active'\|'suspended'`, `lastLoginAt`, `failedLoginAttempts`, `lockedUntil`, `passwordChangedAt`, `deletedAt` | `email` unique, `role` |
| `Session` | `kind:'anonymous'\|'user'`, `tokenHash` (unique, sha256), `user` (ref, nullable), `alias`, `ipHash` (HMAC, never raw IP), `lastSeenAt`, `expiresAt` (TTL), `revokedAt`, `rotatedFrom` | `tokenHash` unique, `user`, `expiresAt` TTL 0 |
| `UserPreference` | `ownerType:'session'\|'user'`, `ownerId`, `displayAlias`, `showCrisisBar`, `contentWarningDefault`, `reduceMotion` | `{ownerType,ownerId}` unique |
| `Board` | `slug` unique, `name`, `description`, `icon`, `supportLevel:'general'\|'peer'\|'crisis'`, `guidelines[]`, `tags[]`, `order`, `isActive`, `threadCount`, `replyCount`, `lastActivityAt` | `slug` unique, `order` |
| `Thread` | `board` ref, `boardSlug`, `title` (≤160), `body` (≤5000), `excerpt`, `contentWarning`, `tags[]` (≤6), `authorType`, `authorId`, `authorModel`, `authorAlias`, `status:'published'\|'hidden'\|'removed'\|'deleted'`, `isPinned`, `isLocked`, `replyCount`, `viewCount`, `lastActivityAt`, `moderatedBy`, `moderationReason`, `editedAt`, `deletedAt` | `{boardSlug,status,isPinned,lastActivityAt}`, `{authorId}`, `{createdAt}`, text `{title,body}` |
| `Reply` | `thread` ref, `authorType`, `authorId`, `authorModel`, `authorAlias`, `body` (≤3000), `contentWarning`, `status`, `moderatedBy`, `moderationReason`, `deletedAt` | `{thread,status,createdAt}`, `{authorId}` |
| `Conversation` | `ownerType`, `ownerId`, `title`, `messageCount`, `lastMessageAt`, `riskLevel`, `status`, `expiresAt` (TTL) | `{ownerId,lastMessageAt}`, `expiresAt` TTL |
| `ChatMessage` | `conversation` ref, `role:'user'\|'assistant'`, `content`, `riskLevel`, `aiProvider`, `aiModel`, `expiresAt` (TTL) | `{conversation,createdAt}`, `expiresAt` TTL |
| `CrisisEvent` | `session` ref, `level`, `source`, `triggerCodes[]`, `resourcesShown`, `country`, **no content**, `expiresAt` (TTL) | `{createdAt}`, `{level,createdAt}`, `expiresAt` TTL |
| `Report` | `targetType`, `targetId`, `targetThread`, `reportedBy`, `reason` (enum), `details` (≤500), `status`, `reviewedBy`, `reviewedAt`, `resolutionNote` | `{status,createdAt}`, `{targetType,targetId,reportedBy}` unique |
| `ModerationAction` | `moderator` ref User, `action` enum, `targetType`, `targetId`, `reportId`, `reason`, `metadata`, `createdAt` | `{createdAt}`, `{moderator}`, `{targetType,targetId}` |
| `Notification` | `recipientType`, `recipientId`, `type:'thread_reply'\|'moderation'\|'system'`, `thread`, `reply`, `read`, `message` | `{recipientId,read,createdAt}`, TTL 90d |

Rules:
- `authorId` is **never** serialized to other users (only used server-side for ownership).
- `ipHash = HMAC-SHA256(ip, SESSION_SECRET)`; raw IPs are never stored or logged.
- TTL indexes make chat/crisis retention automatic (no manual purge job needed).
- Soft delete keeps moderation/audit integrity; "delete my data" performs hard deletes of the
  requester's content and cascades conversations/messages.

---

## 6. Authentication & authorization

### 6.1 Identity model
Two identity kinds, both **server-issued**:
1. `anonymous` — created by `POST /auth/session`. No PII. `Session.kind='anonymous'`, role `member`.
   This is the default forum/chat identity. It supports ownership and abuse control without
   collecting personal data.
2. `user` — an account (email+password, bcrypt cost 12) used for moderator/admin (and optional
   member) operation. A user session replaces the anonymous session cookies on login.

### 6.2 Tokens and cookies
- `ay_at` — JWT access token, `HS256`, `JWT_SECRET`, TTL `ACCESS_TOKEN_TTL_MIN` (15 min),
  `httpOnly`, `secure` in production, `sameSite=lax`, `path=/`. Payload:
  `{ sub: sessionId, kind, role, uid? }`.
- `ay_rt` — opaque 32-byte random refresh token, `httpOnly`, `path=/api/v1/auth`, TTL
  `SESSION_TTL_DAYS`. Stored **only** as `sha256(token)` in `Session.tokenHash`. Rotated on
  `/auth/refresh`; old token revoked (`rotatedFrom` audit).
- `ay_csrf` — readable random token (not httpOnly), `path=/`, same TTL.

### 6.3 CSRF
All non-GET/HEAD/OPTIONS requests to `/api/v1` require header `x-csrf-token` equal to the
`ay_csrf` cookie, and the token must carry a valid HMAC (`SESSION_SECRET`) as
`<random>.<hmac>`. Enforced by `middleware/csrf.js`. Missing/invalid → `403 CSRF_INVALID`.
Login/register/session bootstrap are exempt only when no session exists.

### 6.4 Authorization rules
| Action | anonymous | member | moderator | admin |
|---|---|---|---|---|
| Read boards/threads/replies | ✅ | ✅ | ✅ | ✅ |
| Create thread/reply/report/chat | ✅ | ✅ | ✅ | ✅ |
| Edit/delete own content | ✅ (15 min edit) | ✅ | ✅ | ✅ |
| Hide/remove any content, resolve reports | ❌ | ❌ | ✅ | ✅ |
| Pin/lock threads, view audit log/stats | ❌ | ❌ | ✅ | ✅ |
| Manage boards, create moderators, delete any account | ❌ | ❌ | ❌ | ✅ |

Ownership checks always compare the **server-side** session id (`req.identity.sessionId`) with
`authorId`; never trust client-supplied ids.

### 6.5 Abuse prevention
Per-session and per-IP-hash rate limits: auth 10/15min, global 300/15min, writes 20/10min,
reports 10/hour, crisis assess 30/10min, chat 20/5min. Content limits enforced by zod
(title 160, body 5000, reply 3000, chat 2000). All input validated; all output JSON-encoded
(the API never returns HTML).

---

## 7. AI chatbot contract (server module)

Files: `server/src/services/ai/{provider.js,geminiProvider.js,prompt.js,risk.js}`,
`server/src/services/chatService.js`, `server/src/services/crisisService.js`.

- Provider interface: `{ name, model, isConfigured(), async generate({messages, systemPrompt, signal}) → {text, usage} }`.
- System prompt mandates: warm supportive tone; **never** diagnose, prescribe, or claim to be a
  therapist/doctor; encourage professional help; never promise monitoring; on risk signals
  surface crisis resources and end with a safety check; no medical dosage advice; refuse to
  produce harmful content.
- Context: last 12 messages of the conversation, each message truncated to 2000 chars.
- Timeouts (`AI_TIMEOUT_MS`, default 20s) + one retry on 5xx/timeout with jitter; abort signal.
- Failure → `503 AI_UNAVAILABLE` (no fabrication). Optional `AI_FALLBACK_GUIDED=true` adds
  `error.details.guidedExercise` (explicitly labelled non-AI coping exercise) — the client must
  present it as "guided exercise", never as an AI message.
- Risk: layered scorer in `crisisService.assess(text)` returns `{level, score, reasons}`:
  weighted phrase patterns (with negation + first/second-person heuristics), explicit
  self-report, and (when AI is configured) a classifier call that can only *raise* severity,
  never lower the rule-based result. Levels: `none < low < elevated < high`.
- Crisis events store only `{level, source, triggerCodes, country, resourcesShown}`.
- Persistence: user+assistant messages persisted with TTL (`CHAT_RETENTION_DAYS`); `DELETE
  /chat/conversations/:id` hard-deletes. Nothing chat-related is logged beyond ids/counts.

---

## 8. Crisis support contract

`server/src/data/crisisResources.js` is the single source of truth for helplines (the frontend
must fetch it, never hard-code numbers). Regions: `US`, `IN`, `GB`, `CA`, `AU`, plus `INTL`
fallback (`findahelpline.com`). Every entry: `{name, contact, type:'phone'|'text'|'chat'|'web', available, url?, verifiedOn:'2026-04'}`.

Behaviour:
- Always-visible "Get help now" affordance in the UI (not only after detection).
- `assess` on every post/reply/chat draft (debounced client-side, server-authoritative on submit).
- `elevated` → calm inline resource card. `high` → prominent card + one-click call/text;
  never a blocking modal that traps the user, never labelled as a diagnosis.
- Manual: crisis page + global button + `POST /crisis/events`.
- Location: country inferred from `Accept-Language`/explicit selector (client stores choice in
  preferences, not geolocation/IP), with safe fallback.

---

## 9. Environment variables

Root `.env.example` (documented; real values only in local `.env`, never committed):

```
# --- runtime ---
NODE_ENV=development
PORT=4000
API_BASE_PATH=/api/v1
LOG_LEVEL=info

# --- database ---
MONGODB_URI=mongodb://127.0.0.1:27017/adiyogi
MONGODB_DB_NAME=adiyogi

# --- client ---
CLIENT_URL=http://localhost:5173
CLIENT_URLS=

# --- auth / crypto (generate: openssl rand -hex 32) ---
JWT_SECRET=
SESSION_SECRET=
ACCESS_TOKEN_TTL_MIN=15
SESSION_TTL_DAYS=30
COOKIE_DOMAIN=
COOKIE_SECURE=false
COOKIE_SAMESITE=lax

# --- AI (server only; never expose to the browser build) ---
AI_PROVIDER=gemini
AI_API_KEY=
AI_MODEL=gemini-2.0-flash
AI_TIMEOUT_MS=20000
AI_FALLBACK_GUIDED=true

# --- privacy / retention ---
CHAT_RETENTION_DAYS=30
CRISIS_EVENT_RETENTION_DAYS=90

# --- rates (optional overrides) ---
RATE_LIMIT_WINDOW_MIN=15
RATE_LIMIT_MAX=300
CHAT_RATE_LIMIT_MAX=20

# --- seed/admin bootstrap ---
SEED_ON_START=true
ADMIN_EMAIL=
ADMIN_PASSWORD=
```

Client `.env.example`: `VITE_API_BASE_URL=http://localhost:4000/api/v1`,
`VITE_APP_NAME=AdiYogi`, `VITE_ENABLE_ANALYTICS=false` (no analytics in the default build).

`server/src/config/env.js` validates required variables at boot (fails fast with a clear message,
except in `NODE_ENV=test`), derives `isProd`, `cookieSecure`, `corsOrigins`.

---

## 10. Multi-agent work division (write scopes)

The team shares one filesystem and one git history. To avoid corruption and file conflicts:

- **Only the orchestrator runs git commands** (branch/commit/push/merge). Agents never switch
  branches, commit, or push; they report changed files and the orchestrator serialises git work
  into the per-agent feature branches required by the plan.
- Agents write only inside their scope. Read anything. Never edit another agent's scope; report
  a required cross-scope change to the orchestrator instead.
- Shared interfaces in §4–§9 are frozen. Additive changes only.

| Agent | Branch | Write scope |
|---|---|---|
| **Database** | `feature/mongodb-database` | `server/src/models/**`, `server/src/config/db.js`, `server/src/data/boards.seed.js`, `server/scripts/**`, `docs/DATABASE_SCHEMA.md` |
| **Security** | `feature/security-privacy` | `server/src/middleware/**`, `server/src/utils/{tokens,cookies,csrf,redact}.js`, `docs/SECURITY.md` |
| **Backend** | `feature/backend-api` | `server/src/routes/**`, `server/src/controllers/**`, `server/src/services/**` (except `services/ai/**`, `services/chatService.js`, `services/crisisService.js`), `server/src/validators/**`, `server/src/utils/{ApiError,asyncHandler,response,pagination}.js`, `server/src/config/swagger.js`, `docs/API_DOCUMENTATION.md` |
| **AI** | `feature/ai-chatbot` | `server/src/services/ai/**`, `server/src/services/chatService.js`, `server/src/services/crisisService.js`, `server/src/data/crisisResources.js`, `server/src/routes/v1/{chat,crisis}.routes.js`, `server/src/controllers/{chat,crisis}.controller.js`, `server/src/validators/{chat,crisis}.validator.js` |
| **Frontend A** | `feature/frontend-redesign` | `client/**` (design system, shell, landing, community, boards, threads, forms, preferences, auth pages, 404/error) |
| **Frontend B** | `feature/frontend-experience` | `client/src/pages/{ChatPage,CrisisPage,ResourcesPage,ModerationPage}`, `client/src/components/{chat,crisis,moderation}/**`, `client/src/api/endpoints.chat.js` *(coordinated: Frontend A owns shell/router/design tokens)* |
| **QA** | `feature/testing-qa` | `server/tests/**`, `client/src/__tests__/**`, `server/jest.config.js`, `client/vitest.setup.js`, `docs/TESTING.md`, `e2e/**` |
| **DevOps** | `feature/devops-deployment` | `Dockerfile`, `.dockerignore`, `docker-compose.yml`, `.github/workflows/**`, `render.yaml`, `vercel.json`, `docs/DEPLOYMENT.md`, `server/.env.example`, `client/.env.example` |
| **Lead/orchestrator** | `integration/production-overhaul` | root `package.json`, `.gitignore`, `.env.example`, `README.md`, `docs/{TECHNICAL_AUDIT,ARCHITECTURE,MIGRATION_FROM_PROTOTYPE}.md`, `server/src/app.js`, `server/src/server.js`, `server/src/routes/v1/index.js`, `server/src/config/{env,logger}.js`, integration fixes |

---

## 11. Definition of done (per agent)

1. Code implements the contract exactly (paths, envelopes, codes, field names).
2. `npm run lint` clean for touched files; no `console.log` in server/client runtime code
   (use the logger / UI states).
3. Tests exist for the agent's own module and pass locally (`npm test -w server|client`).
4. No secrets, no TODO/FIXME placeholders, no fabricated data in runtime paths.
5. Report: changed files, contract deviations (should be none), commands run + results, risks.

The orchestrator then reviews the diff, runs the full suite and prod builds, and only merges when
everything is green.

---

## 12. Shared module interfaces (frozen — additive changes only)

These are the exact exports other modules import. Implement them with these signatures.

### 12.1 Middleware (`server/src/middleware/`)

| File | Exports |
|---|---|
| `requestId.js` | `module.exports = (req,res,next)` → sets `req.id` (also `X-Request-Id` response header) |
| `requestLogger.js` | `module.exports = (req,res,next)` → structured log on finish: `{requestId, method, path, status, ms, ipHash}`; never logs bodies |
| `securityHeaders.js` | `module.exports = securityHeaders` (helmet, CSP configured for the SPA, no `unsafe-eval` in prod) |
| `cors.js` | `module.exports = corsMiddleware` (allow-list from `env.corsOrigins`, `credentials:true`) |
| `rateLimiters.js` | `{ globalLimiter, authLimiter, writeLimiter, reportLimiter, chatLimiter, crisisAssessLimiter }` — all reply `429 RATE_LIMITED` via the error envelope |
| `csrf.js` | `{ issueCsrfToken(req,res,next), requireCsrf(req,res,next), csrfTokenFor(req) }` |
| `auth.js` | `{ loadIdentity, requireSession, requireUser, requireRole(...roles) }` — sets `req.identity = { sessionId, kind:'anonymous'\|'user', userId\|null, role:'member'\|'moderator'\|'admin', alias, session }` |
| `validate.js` | `module.exports = ({ params?, query?, body? }) => middleware` — zod schemas, replaces `req.params/query/body` with parsed values, throws `VALIDATION_ERROR` |
| `errorHandler.js` | `{ errorHandler, notFound }` — final middleware pair |
| `sanitize.js` | `module.exports = { stripHtml(text), normalizeText(text), containsBlockedTerms(text) }` (plain-text enforcement; the API never returns HTML) |

### 12.2 Utils (`server/src/utils/`)

| File | Exports |
|---|---|
| `ApiError.js` | `class ApiError extends Error { constructor(status, code, message, details?) }` + statics `badRequest(code?, msg?, details?)`, `unauthorized`, `forbidden`, `notFound`, `conflict`, `unprocessable`, `tooMany`, `aiUnavailable`, `serviceUnavailable`, `internal` |
| `asyncHandler.js` | `(fn) => (req,res,next) => Promise.resolve(fn(req,res,next)).catch(next)` |
| `response.js` | `{ ok(res,data,{message,meta,status}), created(res,data,{message,meta}), noContent(res), fail(res,error) }` |
| `pagination.js` | `{ getPagination(query,{defaultLimit=20,maxLimit=50}), buildMeta({page,limit,total}) }` |
| `tokens.js` | `{ signAccessToken(payload), verifyAccessToken(token), generateOpaqueToken(bytes=32), hashToken(token), signCsrfToken(raw), verifyCsrfToken(signed) }` |
| `cookies.js` | `{ COOKIE_NAMES:{access,refresh,csrf}, setSessionCookies(res,{accessToken,refreshToken,csrfToken,maxAgeMs}), setCsrfCookie(res,token,maxAgeMs), clearSessionCookies(res) }` |
| `redact.js` | `{ hashIp(ip), redactEmail(email), redactToken(token) }` |

### 12.3 Config (`server/src/config/`)

| File | Exports |
|---|---|
| `env.js` | `{ NODE_ENV, isProd, isTest, port, apiBasePath, mongoUri, mongoDbName, clientUrl, corsOrigins:[…], jwtSecret, sessionSecret, accessTokenTtlMin, sessionTtlDays, cookieDomain, cookieSecure, ai:{provider,apiKey,model,timeoutMs,fallbackGuided,isConfigured}, retention:{chatDays,crisisDays}, rateLimits:{…}, seedOnStart, adminEmail, adminPassword }` — throws on missing required vars outside test |
| `logger.js` | winston logger: `logger.info/warn/error/debug(msg, meta?)`, JSON in prod, pretty in dev, **never** logs content/IP/tokens |
| `db.js` | `{ connectDatabase(), disconnectDatabase(), getDbState() }` — pooling, retry with backoff, graceful shutdown support (`getDbState()` → `'connected'\|'disconnected'\|'connecting'`) |

### 12.4 Services used across scopes

```js
// crisisService (AI agent) — used by threads/replies controllers
crisisService.assess(text, { source }) -> Promise<{ level:'none'|'low'|'elevated'|'high', score:number, reasons:string[], showResources:boolean }>
crisisService.getResources({ country }) -> { region, primary, text, emergency, local:[], international:{…}, lastVerified }
crisisService.recordEvent({ sessionId, level, source, triggerCodes, country, resourcesShown }) -> Promise<void>

// chatService (AI agent)
chatService.createConversation(identity, { title }) -> Conversation
chatService.sendMessage(identity, conversationId, content) -> { userMessage, assistantMessage, risk, ai }

// notificationService (backend agent) — used by replies controller
notificationService.notifyThreadReply({ thread, reply, actor }) -> Promise<void>
```

### 12.5 Route modules (`server/src/routes/v1/`)

Each file default-exports an `express.Router`; the orchestrator mounts them in `index.js`:
`auth, users, boards, threads, replies, reports, moderation, chat, crisis, notifications, health, docs`.
`health` also mounted at `/health` and `/healthz` (unversioned). `docs` mounted at `/api/docs`.

### 12.6 Client interfaces (`client/src/api/`)

- `client.js` — `apiFetch(path, {method, body, query, signal})`: prefixes `VITE_API_BASE_URL`,
  `credentials:'include'`, sets `x-csrf-token` from `adiyogi_csrf` cookie for non-GET,
  parses the envelope, throws `ApiError {status, code, message, details, requestId}`,
  retries GET once on network failure, handles 401 by calling `/auth/session` then retrying once.
- `endpoints.js` — one function per endpoint group: `auth`, `boards`, `threads`, `replies`,
  `reports`, `moderation`, `notifications`, `users`, `chat`, `crisis`. No component calls
  `fetch` directly.

### 12.7 Model serialization contract (frozen)

Every model exposes an instance method `toPublicJSON(options = {})` that returns a plain object
safe to send to a browser. `options.viewerId` is the caller's ownership id:
**`identity.userId` for accounts, `identity.sessionId` for anonymous sessions** (always a string;
compare with `String(doc.authorId) === String(viewerId)`). Internal fields (`__v`, `authorId`,
`authorModel`, `moderatedBy`, `tokenHash`, `passwordHash`, `email`, `ipHash`) must never appear.

| Model | `toPublicJSON()` shape |
|---|---|
| `Board` | `{id, slug, name, description, icon, supportLevel, guidelines, tags, order, threadCount, replyCount, lastActivityAt, createdAt}` |
| `Thread` | `{id, boardSlug, boardName?, title, body, excerpt, contentWarning, tags, author:{alias, type}, status, isPinned, isLocked, replyCount, viewCount, lastActivityAt, editedAt, createdAt, isOwner, canEdit, canDelete}` |
| `Reply` | `{id, thread, body, contentWarning, author:{alias, type}, status, createdAt, editedAt, isOwner, canDelete}` |
| `Conversation` | `{id, title, messageCount, lastMessageAt, riskLevel, status, createdAt}` |
| `ChatMessage` | `{id, conversation, role, content, riskLevel, aiProvider, aiModel, createdAt}` |
| `Report` | `{id, targetType, targetId, targetThread, reason, details, status, createdAt, isOwner}` |
| `Notification` | `{id, type, message, thread, reply, read, createdAt}` |
| `User` | `{id, email, role, displayName, status, createdAt}` |
| `UserPreference` | `{displayAlias, showCrisisBar, contentWarningDefault, reduceMotion, updatedAt}` |
| `ModerationAction` | `{id, action, targetType, targetId, reportId, reason, moderator:{id, displayName}, createdAt}` |
| `CrisisEvent`, `Session` | never serialized to clients |

`canEdit` = owner AND thread status `published` AND `createdAt` within 15 minutes.
`canDelete` = owner OR moderator/admin (the controller decides by role).
`author.alias` is the anonymous display alias stored on the document at creation time
(`authorAlias`); `author.type` is `authorType`.

### 4.4 Canonical `data` keys (frozen)

Response payloads are wrapped in **named keys** so clients never guess. `DELETE` endpoints return
`204` with no body. Collections always add the pagination `meta` block from §4.1.

| Endpoint | `data` |
|---|---|
| `POST /auth/session` `GET /auth/me` `POST /auth/register` `POST /auth/login` `POST /auth/refresh` | `{ identity }` |
| `GET /auth/csrf` | `{ csrfToken }` |
| `GET/PATCH /users/me/preferences` | `{ preferences }` |
| `GET /users/me/content` | `{ threads }` or `{ replies }` + meta |
| `GET /boards` | `{ boards }`; `GET /boards/:slug` → `{ board }`; `POST/PATCH` → `{ board }` |
| `GET /threads` | `{ threads }` + meta; `POST /threads` → `201 { thread, support? }` |
| `GET/PATCH /threads/:id` | `{ thread }` |
| `GET /threads/:id/replies` | `{ replies }` + meta; `POST` → `201 { reply, support? }` |
| `POST /reports` | `201 { report }`; `GET /reports` → `{ reports }` + meta; `PATCH /reports/:id` → `{ report }` |
| `GET /moderation/queue` | `{ reports, hiddenThreads, hiddenReplies }` + meta |
| `POST /moderation/actions` | `{ moderationAction, target? }`; `GET /moderation/actions` → `{ actions }` + meta |
| `GET /moderation/stats` | `{ stats }` |
| `GET /chat/conversations` | `{ conversations }` + meta; `POST` → `201 { conversation }` |
| `GET /chat/conversations/:id` | `{ conversation, messages }` + meta |
| `POST /chat/conversations/:id/messages` | `{ userMessage, assistantMessage, risk, ai, resources? }` |
| `GET /crisis/resources` | `{ resources }` |
| `POST /crisis/assess` | `{ assessment: { level, showResources, reasons, score } }` |
| `POST /crisis/events` | `{ acknowledged, resources }` |
| `GET /notifications` | `{ notifications }` + meta; `meta.unreadCount` MUST respect the filter |
| `PATCH /notifications/:id/read` | `{ notification }`; `POST /notifications/read-all` → `{ updated }` |
| `GET /health`, `/healthz`, `/health/ready` | `{ status, uptime, version, env }` |

`support` (thread/reply creation only) = `{ level, showResources }` when the server-side assessment
is `elevated` or `high`; it is advice for the UI (show a support card), never a label on the user
and never persisted on the content document.

### 4.5 Frozen enum decisions (orchestrator)

- `Report.reason` = **exactly** `spam | harassment | self_harm_risk | graphic | medical_misinformation | other`
  (6 values; no synonyms). `medical_misinformation` covers health misinformation, "privacy" and
  hate speech are reported under `harassment`/`other` for now — extend later if moderation needs it.
- `ModerationAction.action` = content actions `hide | unhide | delete | pin | unpin | lock | unlock`
  **plus** report-lifecycle actions `report_review | report_resolve | report_dismiss`
  (required because `PATCH /reports/:id` must be audited).
- `ModerationAction.targetType` allows `thread | reply | report`.
- `Notification.recipientType` = `session | user`; `Notification.type` = `thread_reply | moderation | system`.
- Thread/Reply `authorType` = `anonymous | user` (anonymous authors store the Session id in
  `authorId` with `authorModel: 'Session'`; accounts store the User id with `authorModel: 'User'`).
- `Thread.status` / `Reply.status` = `published | hidden | removed | deleted`;
  `Report.status` = `open | reviewing | resolved | dismissed`;
  `Conversation.status` = `active | archived`.

---

## 13. Integration amendments (recorded during the final integration pass)

These are deliberate, reviewed deviations from the contracts above. All are additive; nothing
frozen was removed.

1. **`issueCsrfToken(req, res)` is a plain synchronous helper** returning the signed token and
   setting the `ay_csrf` cookie (not Express middleware). `requireCsrf` remains middleware.
   Reason: the auth controllers need the token value synchronously to return it in the response
   body for cross-origin clients.
2. **Auth responses include `csrfToken`.** `POST /auth/session`, `/auth/register`, `/auth/login`
   and `/auth/refresh` return `data: { identity, csrfToken }` (additive). Required because a SPA on
   a different registrable domain than the API cannot read the API's `ay_csrf` cookie from JS.
3. **`Report.reportedBy` uses the ownership id** (User id for accounts, Session id for anonymous)
   rather than always the Session id — required for a meaningful unique-report constraint, a
   correct self-report guard and `isOwner` for account reporters. Never serialized.
4. **Refresh tokens rotate in place** on the same `Session` row (token hash replaced) instead of
   creating a new Session. Reason: an anonymous caller's ownership id is its Session id; creating a
   new Session every 15 minutes would orphan the caller's threads and replies. Replay of the old
   token is impossible because its hash no longer matches. `rotatedFrom` is consequently unused.
5. **`ChatMessage.aiProvider` is a bounded string (≤32 chars), not an enum.** The provider id is
   configuration (`AI_PROVIDER`); an enum rejected any non-Gemini provider and turned every chat
   turn into a 500. `gemini` is recorded for real AI turns, `none` for user turns and the
   server-generated crisis safety message.
6. **High-risk chat turns add a separate persisted `safetyMessage`** (deterministic,
   server-generated resources, `aiProvider: 'none'`); the AI `assistantMessage` stays pure provider
   output. The 503 `AI_UNAVAILABLE` details may also carry `resources` and `cause`.
7. **Report responses now pass `viewerId`** so `isOwner` is meaningful (previously always false).
8. **`limit > 50` returns `400 VALIDATION_ERROR`** rather than silently clamping, so clients notice
   the mistake; defaults page at 20.
9. **Crisis data**: the verified AASRA helpline is the official 24-hour line `+91-22-27546669`
   (the number in the original brief is a contact-person mobile). `verifiedOn` is `2026-04` per the
   contract; numbers were re-checked against official sources during integration.
