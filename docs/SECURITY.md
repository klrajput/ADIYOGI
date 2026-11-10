# AdiYogi — Security & Privacy

**Status:** authoritative for the production overhaul (`integration/production-overhaul`).
**Owner:** Security & Privacy (implementation: `server/src/middleware/**`, `server/src/utils/{tokens,cookies,redact}.js`).
**Related contracts:** [`ARCHITECTURE.md`](./ARCHITECTURE.md) §4, §6, §9, §12; audit findings in
[`TECHNICAL_AUDIT.md`](./TECHNICAL_AUDIT.md) §4 (S1–S16).

AdiYogi handles content that may describe suicidal ideation, self-harm, trauma and substance
use. That makes security and privacy product-safety requirements, not compliance paperwork: a
leak can harm a person directly. This document describes what is implemented, why, and what is
explicitly **not** claimed.

---

## 1. Scope and security invariants

In scope: the Express API (`server/`), its session/cookie layer, CSRF, headers, CORS, rate
limits, validation, error envelopes, redaction utilities, and the privacy properties of stored
data. The static React SPA, MongoDB Atlas configuration and the hosting platforms are covered
only where they interact with these controls.

Non-negotiable invariants (all enforced in code):

1. **Identity is server-issued.** No client-supplied id is ever trusted for ownership or role.
   Anonymous identities are opaque `Session` documents, accounts are `User` documents.
2. **Authorization is server-side and role-from-DB.** A JWT claim is never the authority for
   `role`; `middleware/auth.js` reloads the session and the user on every authenticated request.
3. **Every response is JSON with the §4.1 envelope**, including errors — no HTML is ever
   returned from an API route (the Swagger UI under `/api/docs` is the single exception).
4. **No raw IP addresses are stored or logged.** Only `HMAC-SHA256(ip, SESSION_SECRET)`
   truncated to 32 hex chars.
5. **No chat/forum/crisis text in logs.** Logs carry ids, counts, status codes and hashes.
6. **No secret reaches the client bundle.** Provider keys and signing secrets are server-only.
7. **Crisis text is never stored.** `POST /crisis/assess` returns a level and discards the text;
   `CrisisEvent` stores metadata only (`level`, `source`, `triggerCodes`, `country`,
   `resourcesShown`).
8. **No fabricated AI output.** Provider failure returns `503 AI_UNAVAILABLE`, never canned text.

---

## 2. Threat model

### 2.1 Assets

| Asset | Why it matters | Where it lives |
|---|---|---|
| Forum threads/replies (may include crisis disclosure) | Mental-health data; de-anonymisation or public leak causes direct harm | MongoDB `Thread`/`Reply` |
| Chat conversations + messages | Most sensitive free-text; emotional state | MongoDB `Conversation`/`ChatMessage` (TTL) |
| Crisis events | Level/timing of distress; protects against inference | MongoDB `CrisisEvent` metadata only (TTL) |
| Session tokens (`ay_at`, `ay_rt`) | Account/session takeover | httpOnly cookies; refresh only hashed at rest |
| Account credentials | Email + bcrypt hash | MongoDB `User` (`passwordHash` select:false) |
| Email / display name | PII | MongoDB `User` |
| AI provider key | Cost/abuse, data egress | Server environment only |
| Moderation audit trail | Accountability for hiding/removing content | MongoDB `ModerationAction` |

### 2.2 Actors and trust boundaries

| Actor | Capability | Primary defences |
|---|---|---|
| Anonymous internet user | Can read public content, create anonymous sessions, post within limits | Rate limits, CSRF, validation, content limits, moderation, soft delete |
| Malicious authenticated user | Session + cookie; attempts IDOR, privilege escalation, spam | Server-side ownership checks (`req.identity.sessionId` vs `authorId`), role checks, per-session rate limits |
| XSS-injected script in another origin | Cannot read our cookies or CSRF token | httpOnly cookies, strict CORS allow-list, CSP |
| Network attacker | Passive/active MITM on HTTP | HTTPS-only deployment, HSTS in production, Secure cookies |
| Cross-site attacker (CSRF) | Forces a victim's browser to send a state-changing request | Double-submit + HMAC CSRF, SameSite cookies |
| Curious insider / operator with DB access | Can read all stored content | Minimise stored data, TTL retention, hashed IPs, no content in logs; **no E2E encryption** (see §13) |
| Abusive scraper / spammer | Bulk requests, AI cost abuse | Global/auth/write/report/chat/crisis limiters, AI server-only keys, body size limits |
| Compromised dependency | Supply-chain RCE/exfiltration | Lockfile, `npm audit` in CI, minimal runtime dependency surface, no postinstall scripts added |

### 2.3 Trust boundaries

```
Browser (untrusted)                                   API process (trusted)
  ├─ httpOnly cookies ──────────────────────────►  loadIdentity → Session/User (DB, authoritative)
  ├─ x-csrf-token header + readable cookie ─────►  requireCsrf (HMAC + constant-time compare)
  ├─ JSON body/query/params ────────────────────►  validate(zod) + sanitize (plain text)
  └─ TLS ───────────────────────────────────────►  secureHeaders + CORS allow-list

API ↔ MongoDB Atlas (private network / TLS, credentials in env)
API ↔ Gemini (server-side only, key in env, timeouts/retries, no client exposure)
Static SPA (Vercel/Netlify) ──HTTPS──► API (CORS allow-list, credentials)
```

The API assumes TLS is terminated by the hosting platform (Render/Railway/Fly/nginx) and
`app.set('trust proxy', 1)`; see §13 for the associated requirement.

---

## 3. Authentication and session lifecycle

### 3.1 Two identity kinds, both server-issued

| | Anonymous session | Account (user) |
|---|---|---|
| Creation | `POST /api/v1/auth/session` | `POST /auth/register`, `POST /auth/login` |
| Creation credential | none (server generates) | email + password (bcrypt cost 12) |
| Stored as | `Session { kind:'anonymous', alias:'Anonymous' }` — anonymous authors are never given a username | `Session { kind:'user', user: ObjectId }` + `User.displayName` |
| PII | none | email, optional display name |
| Role | always `member`, derived in middleware | `User.role` (`member`/`moderator`/`admin`), read from DB |
| Purpose | forum/chat participation with zero PII | moderator/admin operation, optional member accounts |
| Lifetime | `SESSION_TTL_DAYS` (30) | same, but revocable immediately (DB check per request) |

`POST /auth/session` is reuse-friendly: the client calls it when it has no valid access token;
the server creates (or the client keeps) an anonymous session and sets cookies. Logging in
replaces the anonymous session cookies with account-session cookies.

### 3.2 Tokens

| Token | Format | Cookie | Storage at rest | TTL |
|---|---|---|---|---|
| Access | JWT `HS256`, claims `{sub: sessionId, kind, role, uid?}` + `iss:'adiyogi'`, `aud:'adiyogi-web'`, `exp` | `ay_at` (httpOnly) | not stored (stateless, self-contained) | `ACCESS_TOKEN_TTL_MIN` = 15 min |
| Refresh | opaque `crypto.randomBytes(32).toString('base64url')` | `ay_rt` (httpOnly, path-scoped) | **only** `sha256(token)` in `Session.tokenHash` | `SESSION_TTL_DAYS` = 30 days |
| CSRF | `<raw>.<hmacSha256(raw, SESSION_SECRET)>`, raw is 32 random bytes | `ay_csrf` (readable by JS — required by design) | not stored | `SESSION_TTL_DAYS` |

Verification rules (`utils/tokens.js`):

- `verifyAccessToken` pins the algorithm to `HS256` (no `alg:none`/algorithm-confusion), checks
  `iss` and `aud`, re-validates the claim shape, and throws a **generic** error
  (`Invalid or expired access token`) so callers cannot distinguish expiry from forgery.
- Refresh tokens are compared by `sha256` hash and rotated on `/auth/refresh`: the stored hash is
  replaced **in place** on the same `Session` row, so the previously issued refresh token stops
  working immediately (replay → `401`) and no duplicate session is created. *Implementation note:*
  this deviates from ARCHITECTURE §6.2's "new session + `rotatedFrom` audit" wording — single-use
  refresh semantics are preserved, but there is no `rotatedFrom` chain; rotation is logged as an
  id-only event.
- CSRF verification recomputes the HMAC and compares with `crypto.timingSafeEqual`.

### 3.3 Session lifecycle and revocation

```
create session ──► cookies set ──► access JWT (15m) ──expires──► client calls /auth/refresh
                                        │                            │
                                        │                            ├─ valid ay_rt → rotate refresh,
                                        │                            │  revoke old, issue new JWT
                                        │                            └─ invalid → 401 → client bootstraps
                                        │                               a fresh anonymous session or logs in
                                        └─ logout → Session.revokedAt = now, cookies cleared
```

- **Every authenticated request is a DB read** (`loadIdentity`): revoked (`revokedAt`),
  expired (`expiresAt`) sessions and suspended/deleted users lose access *immediately*, even
  though the JWT is still cryptographically valid.
- `lastSeenAt` is refreshed at most once per 5 minutes and is fire-and-forget: telemetry cannot
  fail a request.
- `Session.expiresAt` has a MongoDB TTL index (`expireAfterSeconds: 0`); expired documents are
  reclaimed automatically. `revokedAt` keeps an audit trail until TTL.
- Failed login attempt counters / temporary lockout (`User.failedLoginAttempts`,
  `User.lockedUntil`) are part of the account model (§5 of ARCHITECTURE) and enforced by the auth
  module; the transport-level defence in this layer is the `authLimiter` (10 failed attempts per
  15 minutes per session/IP hash). See §14 for what is not yet implemented.
- Password hashes: bcrypt cost 12, `select: false` so they never leave the database by
  accident; `passwordChangedAt` allows future token invalidation if needed.

### 3.4 Why JWT + opaque-refresh instead of one long JWT

A long-lived JWT cannot be revoked. Here the JWT is short (15 min) and tied to a `Session`
record that is checked on every request; the only long-lived credential is an opaque random
refresh token that exists in plaintext solely in the httpOnly cookie and can be revoked at any
time. Rotation makes a stolen refresh token single-use: the stored hash changes and the previous
value fails immediately, bounding the replay window. Rotation events are logged with session ids
only (no token material).

---

## 4. Authorization model

Implemented in `middleware/auth.js`:

| Guard | Behaviour |
|---|---|
| `loadIdentity` | Never throws. `req.identity = null` when unauthenticated/invalid/revoked. On success: `{sessionId, kind, userId|null, role, alias, session}` |
| `requireSession` | `401 UNAUTHENTICATED` unless any identity exists (anonymous or user) |
| `requireUser` | `401 UNAUTHENTICATED` unless `kind === 'user'` (anonymous sessions must sign in) |
| `requireRole(...roles)` | `401` when no identity, `403 FORBIDDEN` when the identity's DB role is not listed |

Rules that matter for access control:

- Ownership is always compared against `req.identity.sessionId` (and `userId`), never against a
  client-supplied id — this closes the prototype's client-generated identity risk (audit S2).
- Role is read from the `User` document, not from the JWT claim; a stale claim cannot grant
  elevated rights, and demoting/suspending a moderator takes effect on their next request.
- `authorId` is never serialised to other users (§5 ARCHITECTURE); moderation decisions are
  recorded in `ModerationAction` for accountability (audit S11).
- Unauthenticated destructive surfaces are gone: the prototype `/admin/database` page and
  `window.forumAdmin` console are deleted (audit S1); all moderation routes require
  `moderator`/`admin`.

---

## 5. CSRF design

Implemented in `middleware/csrf.js`; wired once in `app.js`:
`app.use(env.apiBasePath, requireCsrf, apiRouter)` — route modules do not re-declare it.

```
ay_csrf cookie  = <raw>.<HMAC-SHA256(raw, SESSION_SECRET)>     (readable, path=/)
x-csrf-token hdr = exactly the same string as ay_csrf          (for POST/PUT/PATCH/DELETE)
```

`requireCsrf`:

1. Safe methods (`GET`, `HEAD`, `OPTIONS`) pass — they must be side-effect free.
2. **Bootstrap exemption**: a mutating request is exempt only when its path relative to
   `/api/v1` is exactly `/auth/session`, `/auth/login` or `/auth/register` **and** it carries no
   `ay_rt` refresh cookie. This is required to create the very first session; there is no
   exemption once a session cookie exists.
3. Otherwise: header must be present and **byte-equal** to the cookie (constant-time compare),
   and the cookie value must carry a valid HMAC signature. Any failure is
   `403 CSRF_INVALID` with the standard envelope.
4. `issueCsrfToken(req, res)` is a plain synchronous helper (returns the signed token and sets
   the cookie) used by the auth module after session creation/login; `csrfTokenFor(req)`
   returns the current signed token.

Why this is robust:

- Cross-site form/fetch attacks cannot read the `ay_csrf` cookie (same-origin policy) or set the
  custom header, so the double-submit check fails.
- A cross-site attacker who *sets* a cookie cannot forge the HMAC without `SESSION_SECRET`.
- `SameSite=Lax` (`env.cookieSameSite`) is the second layer for cookie transmission; CSRF tokens
  cover the `SameSite=None` cross-site deployment too.
- The CSRF token is not an authentication credential: it is only meaningful alongside the
  session cookie, and stealing it implies the attacker already runs same-origin script.

---

## 6. Cookies and cross-site deployment

Implemented in `utils/cookies.js`.

| Cookie | httpOnly | SameSite | Secure | Path | Max-Age |
|---|---|---|---|---|---|
| `ay_at` | ✅ | `COOKIE_SAMESITE` (`lax` default) | `COOKIE_SECURE` or prod; forced when SameSite=None | `/` | `ACCESS_TOKEN_TTL_MIN` (15 min) |
| `ay_rt` | ✅ | same | same | `<API_BASE_PATH>/auth` (default `/api/v1/auth`) | `SESSION_TTL_DAYS` (30 d) |
| `ay_csrf` | ❌ (must be readable) | same | same | `/` | `SESSION_TTL_DAYS` (30 d) |
| `COOKIE_DOMAIN` | optional shared parent domain (e.g. `.example.com`) | | | | |

`SameSite=None` **implies** `Secure: true` (browsers reject the combination otherwise); it is
valid only over HTTPS.

**Deployment guidance (must match `docs/DEPLOYMENT.md`):**

- **Recommended:** SPA and API on the same registrable domain (`app.example.com`,
  `api.example.com`) with `COOKIE_SAMESITE=lax` (optionally `COOKIE_DOMAIN=.example.com`). SameSite
  cookies work, the refresh cookie is never sent cross-site, and no third-party-cookie
  restrictions apply.
- **Different registrable domains** (e.g. `*.vercel.app` + `*.onrender.com`): set
  `COOKIE_SAMESITE=none` (forces Secure/HTTPS), add the SPA origin to `CLIENT_URLS` so the CORS
  allow-list includes it, and understand the trade-offs: Safari/ITP and some browser settings
  block third-party cookies even with `SameSite=None`, and every request becomes cross-site.
  Prefer a custom domain on both services.
- Cookies are never `Domain`-widened beyond the configured parent domain; `ay_rt` is
  path-scoped to the auth endpoints so it is not exposed to forum/chat/crisis handlers.
- Logout (`POST /auth/logout`) revokes the session and clears all three cookies with the same
  path/domain/flag values used to set them.

---

## 7. HTTP security headers and CSP

Implemented in `middleware/securityHeaders.js` using Helmet. Two profiles are selected by path.

### 7.1 API responses (JSON)

```
Content-Security-Policy: default-src 'none'; base-uri 'none'; connect-src 'none'; font-src 'none';
  form-action 'none'; frame-ancestors 'none'; img-src 'none'; object-src 'none';
  script-src 'none'; style-src 'none'            (+ upgrade-insecure-requests in production)
Referrer-Policy: no-referrer
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-origin
Cross-Origin-Embedder-Policy: disabled (documented: no cross-origin isolation requirement for a JSON API)
X-Permitted-Cross-Domain-Policies: none
X-DNS-Prefetch-Control: off
X-Download-Options: noopen
X-XSS-Protection: 0 (legacy filter disabled per modern guidance)
X-Powered-By: removed
Origin-Agent-Cluster: ?1
Strict-Transport-Security: max-age=15552000; includeSubDomains   (production only)
```

The API CSP is deliberately `default-src 'none'`: an API response should never load or execute
anything, so even a hypothetical content-type confusion cannot execute script.

### 7.2 Swagger UI (`/api/docs`) only

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline';
  style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:;
  connect-src 'self'; worker-src 'self' blob:; base-uri 'self'; form-action 'self';
  frame-ancestors 'none'
```

Swagger UI needs inline script/style; `unsafe-eval` is **never** allowed, framing is denied,
and this relaxed policy applies to `/api/docs*` only (the docs router sets it; the global
middleware also applies a strict-for-content fallback policy on that path). `GET /api/docs`
answers `301` to `/api/docs/` — that redirect is emitted by `serve-static` and carries its own
`default-src 'none'` header, which is harmless; the rendered page at `/api/docs/` has the policy
above. The rest of the origin keeps the strict API policy. If API docs are not desired in a public
production deployment, do not mount the docs router (deployment choice, tracked in
`docs/DEPLOYMENT.md`).

### 7.3 Static SPA CSP (served by Vercel/Netlify/nginx — canonical policy)

The SPA is static and must be served with its own policy. **Canonical same-origin policy** (nginx
and any deployment that proxies `/api` on the same origin):

```
default-src 'self'; base-uri 'self'; object-src 'none'; script-src 'self';
style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self';
connect-src 'self'; form-action 'self'; frame-ancestors 'none'; manifest-src 'self';
worker-src 'self'; media-src 'self'
```

- `style-src 'unsafe-inline'` is required because React inline `style={{…}}` props compile to
  inline styles; it is style-only and does not enable script execution.
- `img-src data: blob:` supports locally generated UI assets (avatars/masks); no third-party
  image origins.
- No `unsafe-eval`, no third-party script/font origins by default (the app self-hosts fonts).

**Cross-site variant** (only when the SPA and API are on different registrable domains and the
static host cannot interpolate the API origin): `connect-src 'self' https:` in `vercel.json`
**only**, documented as weaker (permits any HTTPS origin) and never used by the nginx
same-origin deployment. Recommended instead: set `VITE_API_BASE_URL`/proxy so the SPA talks to
its own origin.

Static hosts should also emit: HSTS (production), `X-Content-Type-Options: nosniff`,
`X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin` (SPA; the API uses
`no-referrer`), `Permissions-Policy: camera=(), microphone=(), geolocation=()`.

---

## 8. CORS

Implemented in `middleware/cors.js`.

- Allow-list from `CLIENT_URL` + `CLIENT_URLS` (normalised, lower-case, trailing slash removed).
- `credentials: true` **only ever with an explicit reflected allow-listed origin**; `origin: true`
  (reflect anything) is never combined with credentials.
- Allowed methods: `GET, POST, PATCH, PUT, DELETE, OPTIONS`.
- Allowed request headers: `Content-Type, x-csrf-token, x-request-id, Accept`.
- Exposed response header: `x-request-id` (so the SPA can show a support id).
- Preflight cache: 600 s.
- Origins with no `Origin` header (server-to-server, curl, same-origin navigations) are not
  blocked — CORS is a browser policy, not an auth boundary.
- **Unknown origin:** no CORS headers are added; a preflight from an unknown origin is rejected
  with `403 FORBIDDEN` + the standard envelope (fail closed); non-preflight requests continue but
  the browser blocks the response. `Vary: Origin` is emitted to keep caches correct.
- CORS is not the CSRF defence: CSRF and SameSite are (a cross-origin request can be *sent*
  without CORS permission; it simply cannot be *read*).

---

## 9. Input validation and output encoding

### 9.1 Validation

- Every route that accepts input uses `middleware/validate.js` with zod schemas:
  `validate({ body, query, params })` parses, coerces, strips unknown keys and **replaces**
  the request sources with parsed values before the controller runs.
- Invalid input → `400 VALIDATION_ERROR` with `error.details = [{path, message}]` (path prefixed
  with `body`/`query`/`params`), capped at 50 entries, no raw values echoed.
- Length limits are enforced by zod per contract: thread title ≤ 160, thread body ≤ 5000, reply
  ≤ 3000, chat message ≤ 2000, report details ≤ 500, tags ≤ 6, page/limit ≤ 50. Body size is
  also capped by `express.json({limit:'100kb'})`.
- Server-side authorization and ownership checks are never replaced by client-side hiding.

### 9.2 Output encoding (XSS)

- The API is **JSON-only**. `res.json` sets `application/json` and JSON-encodes all values; no
  route renders HTML from user input. The only HTML surface (Swagger UI) never echoes user
  content.
- The React client renders all user/provider text as text nodes. **No `dangerouslySetInnerHTML`
  is allowed anywhere in `client/`** — the prototype's `Chatbot.js` innerHTML sink (audit S4) is
  removed; the ad-hoc HTML regex formatter is replaced by text rendering. Links would be rendered
  as text or via a validated allow-list if a rich-text feature is ever added (it is not).
- `middleware/sanitize.js` is defence-in-depth for storage: `stripHtml` removes tags and control
  characters (repeated passes for malformed nesting), `normalizeText` additionally normalises
  Unicode and collapses whitespace for short fields. Stored forum content is therefore plain text
  even before React encodes it again. `containsBlockedTerms` is a **conservative spam denylist**
  (solicitation/scam phrasing, ≥ 4 links, word floods) — it never blocks mental-health
  vocabulary (words like *suicide, self-harm, trauma, abuse, depressed, crisis* are explicitly not
  on the list); harmful-but-ambiguous content goes to the human moderation queue instead of being
  auto-rejected.
- URL safety: the API returns JSON, never redirects, and the contract has no server-side
  `Location` redirect built from user input; the SPA must validate link targets (`https:` only)
  before rendering a clickable link.

### 9.3 Error envelopes

`middleware/errorHandler.js` normalises every failure: `ApiError`, zod, Mongoose
`ValidationError`/`CastError`/duplicate-key `11000` → `409 CONFLICT`, jsonwebtoken errors →
`401 UNAUTHENTICATED`, body-parser oversize → `413 PAYLOAD_TOO_LARGE`, malformed JSON → `400`
and unknown → `500 INTERNAL_ERROR`. Production responses never include stack traces, driver
messages, the offending value, or database field details beyond the field name. 5xx errors are
logged with stack + `requestId`; 4xx are not logged with bodies.

---

## 10. Rate limits and abuse prevention

Implemented in `middleware/rateLimiters.js` (express-rate-limit v7, draft-7 headers,
`legacyHeaders: false`). Key = server-side **session id** when authenticated, otherwise
`hashIp(req.ip)` — never the raw IP. On limit: `429 RATE_LIMITED` with
`error.details.retryAfterSeconds` and a `Retry-After` header.

| Limiter | Applies to | Window | Max | Notes |
|---|---|---|---|---|
| `globalLimiter` | all API requests (health probes skipped) | 15 min | 300 (`RATE_LIMIT_MAX`) | `RATE_LIMIT_WINDOW_MIN` overrides window |
| `authLimiter` | session bootstrap, login, register | 15 min | 10 | `skipSuccessfulRequests: true` — only failures count |
| `writeLimiter` | threads, replies, preferences, deletions | 10 min | 20 | |
| `reportLimiter` | `POST /reports` | 60 min | 10 | one report per target per reporter is also a DB constraint |
| `chatLimiter` | chat message sends | 5 min | 20 (`CHAT_RATE_LIMIT_MAX`) | protects AI spend |
| `crisisAssessLimiter` | `POST /crisis/assess` | 10 min | 30 | assessment text is not stored |

Additional abuse-prevention controls:

- Request body limit 100 kb; per-field zod limits (§9.1); pagination cap (`limit ≤ 50`) prevents
  memory amplification.
- AI provider calls are server-only, timeout-bounded (`AI_TIMEOUT_MS`), retried once, and
  concurrency is naturally bounded by the chat limiter. The browser never holds the provider key
  (audit S6).
- Content spam denylist + reports/moderation workflow + `ModerationAction` audit log.
- Anonymous identities are still rate-limited and revocable: abuse can be cut off per session
  without collecting PII.
- **Limitation:** the default express-rate-limit store is in-memory, i.e. per process. A
  multi-instance deployment must configure a shared store (Redis) — see §14.

---

## 11. Privacy engineering

### 11.1 Data minimisation

- Anonymous participation requires **no PII at all**; email is only collected for accounts
  (moderators/admins and optional members).
- Crisis assessment input (`POST /crisis/assess`) is processed and discarded — never persisted.
- Crisis events store `{level, source, triggerCodes, country, resourcesShown}` and **no text**.
- Chat messages are persisted only to serve conversation history, with a TTL; deletion is hard.
- No analytics by default (`VITE_ENABLE_ANALYTICS=false`); no third-party fonts/scripts in the
  default SPA build; no cookies beyond the three session cookies (no ad/analytics trackers).
- AI disclosure is required in the UI (the assistant is explicitly not a clinician); provider
  failure is surfaced honestly rather than faked.

### 11.2 IP addresses and logs

- `utils/redact.js#hashIp` = `HMAC-SHA256(normalised_ip, SESSION_SECRET)` hex truncated to 32
  chars; normalisation strips `::ffff:` IPv4-mapped prefixes, brackets, incidental ports and IPv6
  zone ids so the same client hashes stably. Missing IP → `'unknown'`.
- Raw IPs are never written to `Session.ipHash`, never logged, and never used as a rate-limit key
  directly.
- `requestLogger` logs only `{requestId, method, path, status, durationMs, ipHash}` — **no query
  string, no body, no cookies, no authorization header, no response body**. Health probes log at
  `debug`. Client aborts are logged without bodies.
- `redactEmail` (`a***@example.com` — local part is **not** partially shown) and `redactToken`
  (first 6 chars + `…` + length, never reusable) are available for operational diagnostics.
- Log destination: stdout JSON (collected by the platform); retention is the platform's log
  retention, so operators must configure a short retention window for API logs.

### 11.3 Retention and deletion

| Data | Retention | Mechanism |
|---|---|---|
| `ChatMessage`, `Conversation` | `CHAT_RETENTION_DAYS` (30) | MongoDB TTL index |
| `CrisisEvent` | `CRISIS_EVENT_RETENTION_DAYS` (90) | MongoDB TTL index |
| `Session` | `expiresAt` (+ TTL) | MongoDB TTL index; `revokedAt` retained for audit until expiry |
| `Notification` | 90 days | MongoDB TTL index |
| Forum content | until user/moderator deletes | soft delete (`status:'deleted'`/`deletedAt`) for moderation integrity |
| Account deletion | immediate hard delete of the requester's content + account | `DELETE /users/me` (cascade conversations/messages) |
| Conversation deletion | immediate hard delete | `DELETE /chat/conversations/:id` |

User-initiated deletion is a first-class endpoint (audit S12), not an email request. Soft deletes
keep `authorId`/moderation links for audit integrity but are excluded from public reads; "delete
my data" performs hard deletes.

### 11.4 Crisis safety vs privacy

- Crisis metadata is aggregate-friendly (e.g. moderation stats use 30-day aggregates); no
  message text is joined to crisis events.
- Resources are served from a single verified source (`server/src/data/crisisResources.js`) with a
  safe international fallback; the UI shows a persistent "Get help now" affordance and never
  labels a user or blocks them in a modal.
- **No automated monitoring/intervention is promised.** The system does not monitor users and
  the UI must not imply it does.

---

## 12. Secret management

- All secrets come from environment variables; `.env` is git-ignored, `.env.example` is
  documented with empty values, and `server/src/config/env.js` **fails fast** outside tests if
  `JWT_SECRET`/`SESSION_SECRET` are missing or shorter than 16 characters.
- Generate with `openssl rand -hex 32` (32 bytes → 64 hex chars); use **different** values for
  `JWT_SECRET` and `SESSION_SECRET` (separate domains: token signing vs IP/CSRF HMAC). Rotating
  `SESSION_SECRET` re-pseudonymises IP hashes and invalidates outstanding CSRF tokens (users
  re-fetch `/auth/csrf`); it does not invalidate JWTs.
- Secrets are configured in the hosting platform's secret store (Render/Railway/Fly/Vercel
  env vars), never in git, Dockerfiles, CI YAML or the client bundle. Only `VITE_*` variables
  reach the client, and only non-secret values are ever set there (API base URL, app name).
- The AI provider key (`AI_API_KEY`) is server-only; `env.ai.isConfigured` gates the feature, and
  missing configuration returns `503 AI_UNAVAILABLE` rather than silently degrading.
- Admin bootstrap (`ADMIN_EMAIL`/`ADMIN_PASSWORD`) is used once by `scripts/createAdmin.js`; the
  password must be changed after first login (account flow) or rotated in the platform secret
  store.
- Logs and error envelopes never contain secrets or tokens (see §11.2); `redactToken` exists for
  the rare case an operator must correlate a token prefix.

---

## 13. Dependencies, supply chain and vulnerability scanning

**Current audit (verified with `npm audit` on this branch, after the integration dependency upgrade):**

- Production tree (`npm audit --omit=dev`): **3 advisories (1 high, 2 moderate)** — `zod` (high)
  and `react-router` / `react-router-dom` (moderate). No critical or high advisories in any other
  production dependency.
- Full tree including dev tooling: **15 advisories (2 critical, 2 high, 5 moderate, 6 low)**, all
  confined to build/test tooling (`jest`/`@jest/core`/`jest-cli`/`jest-config`/`create-jest`,
  `vitest`, `vite`, `vite-node`, `tinypool`, `esbuild`, `@vitest/mocker`, `deepmerge`) plus the two
  client router packages. Dev tooling is **not shipped** in a production image built with
  `npm ci --omit=dev`.
- Resolved during integration: Express upgraded to **4.22.3** and `npm audit fix` applied →
  the former `proxy-addr` **critical**, `body-parser`, `compression`, `path-to-regexp` and `qs`
  advisories are clean (installed: proxy-addr 2.0.8, body-parser 1.20.9, compression 1.8.2,
  qs 6.16.2).
- This is a dramatic improvement over the prototype's **71 vulnerabilities (35 high, 4 critical)**
  from the vendored CRA + Firebase toolchain (audit S14). **We do not claim zero vulnerabilities:**
  the accepted residual risks and their mitigations are listed in §13.1.

### 13.1 Accepted dependency risks (rationale + mitigation + upgrade path)

These are knowingly accepted for this release, with compensating controls. They are re-reviewed at
each release and are tracked follow-ups, not silent omissions.

| Advisory | Severity | Why accepted for this release | Mitigation in place | Upgrade path |
|---|---|---|---|---|
| `zod` — GHSA-mrhx-c7xc-m3w5 (memory exhaustion validating oversized constrained collections) | high | The fix is **zod 4** (semver-major); every validator in the repo is written against zod 3 and the parsers differ. Rewriting the whole validation layer at the end of this overhaul adds more release risk than the mitigated issue. | Hard `express.json({limit:'100kb'})` cap; pagination caps (`limit ≤ 50`); bounded collection schemas (tags ≤ 6, guidelines ≤ 8, report details ≤ 500, error issues capped at 50); global/write/chat/crisis rate limits bound request volume; no attacker-controlled unbounded array reaches a zod collection constraint. | Upgrade to zod 4 in the next dependency cycle and re-run validator + API integration tests. Callers/route wiring keep the same `validate({body,query,params})` contract, so no API change is needed. |
| `react-router` / `react-router-dom` — GHSA-wrjc-x8rr-h8h6 (open redirect via backslash in `<Link>`/`useNavigate`) and GHSA-337j-9hxr-rhxg (SSR-hydration `deserializeErrors()` constructor injection) | moderate | The fix is **react-router 7** (semver-major). This SPA has **no SSR**, so the hydration gadget is not reachable, and it never navigates to attacker-controlled targets: every `to`/`navigate` target is a literal internal path or a server-issued encoded id. | No SSR; literal/internal-only navigation targets (no user-controlled redirect URLs); API never emits redirects built from input; SPA CSP `script-src 'self'` + `frame-ancestors 'none'`. | Upgrade to react-router 7 in the next client dependency cycle (routes are declarative, migration is mechanical); re-run client tests and E2E navigation specs. |
| Dev tooling: `jest` family (low), `vitest`/`vite`/`vite-node`/`tinypool`/`@vitest/mocker`/`esbuild`/`deepmerge` (low–critical, **dev only**) | dev-only | Not part of the production artifact; fixing requires major upgrades of the test/build harness (jest 25↔30, vitest 5, vite 8) that would destabilise the test suite during the overhaul. | Production image is multi-stage and runs `npm ci --omit=dev`; CI installs from the committed lockfile only; no dev server is exposed publicly. | Track and upgrade the test/build toolchain in the next cycle; advisories are re-checked by CI `npm audit`. |

Actions: `npm audit` should run in CI (`.github/workflows/ci.yml`) and a production image must be
built with `npm ci --omit=dev`; Dependabot/`npm audit fix` review at each release; committed
lockfile; no dependency with install scripts added without review; the client bundle is built
from the same pinned lockfile.

**Toolchain risk we accept:** Node 26 is newer than the LTS baseline documented in
ARCHITECTURE (§3 says Node 20+); libraries are pinned with a committed lockfile. The Express 4
line (now 4.22.3) receives security fixes but the Express 5 major migration is out of scope for
this overhaul. The zod 3 → 4 and React Router 7 upgrades are tracked follow-ups; the residual
issues require either oversized inputs (bounded by the 100 kb body cap, pagination caps and rate
limits) or an SSR/navigation surface this SPA does not have.

---

## 14. Known limitations and explicit non-claims

### 14.1 Explicitly NOT claimed

- **Not legal/regulatory compliance.** No HIPAA, GDPR, DPDP Act, SOC 2, ISO 27001 or medical-device
  certification is claimed or implied. Deployers must perform their own legal review (data
  processing agreement, lawful basis, cross-border transfer, age limits, crisis-resource accuracy
  per region).
- **Not a clinical service.** The AI companion is not a therapist, does not diagnose or
  prescribe, does not monitor users, and does not provide emergency response. The UI must say so.
- **Not end-to-end encrypted.** MongoDB data is readable by operators with database credentials
  (encryption at rest depends on Atlas configuration). The anonymity guarantee is "no PII
  collected for anonymous use + server-side pseudonymisation", not "nobody can ever read content".
- **No independent penetration test or security certification** has been performed. This
  document describes controls and their implementation, not an audit attestation.
- No WAF/DDoS protection is provided by the application; use platform/edge protection.

### 14.2 Known functional/security limitations

| Limitation | Impact | Mitigation / plan |
|---|---|---|
| **No email verification and no password reset** | Account email cannot be proven; locked-out users cannot self-recover | Feature is out of scope for this release and must be added before opening self-service accounts broadly; admins can create/reset accounts via the server script. Email is only required for moderator/admin accounts today |
| **No MFA for moderator/admin accounts** | Credential theft = elevated access | Rotate strong unique passwords; admin accounts are few and operator-provisioned; add TOTP MFA next |
| In-memory rate-limit store | Limits are per API instance; horizontal scaling multiplies limits | Configure a shared store (Redis) when running > 1 instance; document in deployment |
| Per-request DB session check | Cost of one indexed read per authenticated request | Acceptable for this scale; cached revocation lists are a future optimisation (must never delay revocation beyond the access-token TTL) |
| Refresh-token reuse detection | Rotation replaces the stored hash in place, so replaying the old refresh token fails; automatic reuse detection (revoke the session family on replay) is not implemented | Add token-family tracking if the threat model requires it; single-use rotation, short access TTL and per-request DB revocation bound exposure |
| CSRF token is not rotated per request | A leaked CSRF token is useful only alongside the session cookie | Token is rotated on session creation/login/refresh and `/auth/csrf` |
| Swagger UI served if mounted | API surface disclosure | Disable the docs mount in public production if not needed (deployment choice) |
| Query strings are not logged | Incident debugging has less context | Intentional privacy trade-off; request ids correlate client reports |
| IP hash keyed by `SESSION_SECRET` | Rotating the secret breaks historical pseudonym linkage | Documented rotation effect; hashes are not reversible anyway |
| Chat/forum content visible to DB operators | Insider access risk | Data minimisation, TTLs, access control on Atlas, audit of operator access, deletion endpoints |
| Rate limits do not guarantee AI cost caps across instances | Spend can exceed expectation under scale-out | Shared store + provider-side quotas/budgets |

### 14.3 Residual risk accepted for this release

- Availability attacks that stay under rate limits are possible; there is no bot detection.
- A compromised hosting platform/DB credential defeats application controls.
- Browser third-party-cookie blocking can break the cross-site (`SameSite=None`) deployment; the
  same-parent-domain topology is strongly recommended.
- Dependency advisories listed in §13 remain until the next dependency cycle; none of them grant
  authentication bypass or data exfiltration in the supported deployment topology, and the input
  size/rate limits bound the DoS surface.

---

## 15. Production security checklist (operators)

Before exposing the API to real users:

**Configuration**

- [ ] `NODE_ENV=production`, `LOG_LEVEL=info`.
- [ ] `JWT_SECRET` and `SESSION_SECRET` set from a secret manager, 32+ random bytes each, distinct.
- [ ] `MONGODB_URI` uses TLS and a least-privilege database user (readWrite on the app DB only).
- [ ] `CLIENT_URL`/`CLIENT_URLS` contain only real HTTPS origins (no localhost), matching CORS.
- [ ] Cookie flags: `COOKIE_SECURE=true` (automatic in production), `COOKIE_SAMESITE=lax` with a
  shared parent domain, or `none` only with HTTPS + custom domains; `COOKIE_DOMAIN` only if needed.
- [ ] `AI_API_KEY` stored server-side only, provider quotas/alerts configured, `AI_FALLBACK_GUIDED`
  chosen deliberately.
- [ ] `SEED_ON_START=false` (or seeding verified idempotent) and admin bootstrap password rotated.
- [ ] `ADMIN_EMAIL`/`ADMIN_PASSWORD` removed from the environment after creating the admin.

**Transport and headers**

- [ ] TLS terminated by the platform; HTTP redirects to HTTPS; HSTS active.
- [ ] `trust proxy` matches the real proxy depth (default 1) — verify client IPs are not spoofable
  (proxy-addr advisory fixed per §13).
- [ ] API responses carry the headers in §7.1; the SPA is served with the CSP in §7.3.
- [ ] Swagger UI disabled if not required publicly.

**Data and access**

- [ ] Atlas: encryption at rest enabled, IP allow-list restricted, backups enabled, TTL indexes
  verified (`Conversation`, `ChatMessage`, `CrisisEvent`, `Notification`, `Session`).
- [ ] `User.passwordHash`/`email` remain `select:false`; no raw IP fields anywhere.
- [ ] Log retention short and access-controlled; verify logs contain no bodies/tokens/IPs.
- [ ] Data-deletion endpoint exercised end-to-end (account + conversations cascade).
- [ ] Crisis resources verified per region and `lastVerified` dates current.

**Operations**

- [ ] `npm ci --omit=dev` production image; the image contains no `.env`; health/readiness
  endpoints monitored; `/health/ready` 503 alerts wired.
- [ ] `npm audit --omit=dev` reviewed at release; CI blocks new critical advisories in runtime deps.
- [ ] Error monitoring captures `requestId` but not bodies; alerting on 5xx rate.
- [ ] Rotation runbook for `SESSION_SECRET`, `JWT_SECRET`, DB credentials and AI key.
- [ ] Backups restore-tested.

---

## 16. Responsible disclosure

- **Do not open public GitHub issues for security problems.** Use GitHub's private
  **Security Advisories** ("Report a vulnerability" on the repository) or contact the maintainers
  privately; include affected endpoint/version, reproduction steps, and impact.
- Please avoid testing against production with real user data. Local reproduction against
  `docker-compose`/`mongodb-memory-server` is preferred.
- We aim to acknowledge within 72 hours, provide a remediation plan within 10 business days, and
  coordinate disclosure after a fix ships. There is no paid bug-bounty program.
- Report categories especially valuable here: authentication/authorization bypass, CSRF bypass,
  XSS in the SPA, rate-limit bypass on chat/crisis endpoints, data-exposure in logs/errors, and
  privacy regressions that store crisis/chat content.
- Out of scope: missing legal certifications, self-XSS, reports requiring a compromised
  client/host, social engineering, or denial of service from a single volumetric source (edge
  protection is the platform's responsibility).

---

## 17. Audit findings → controls (traceability)

| Audit ID | Finding | Control in this overhaul |
|---|---|---|
| S1 | Unauthenticated destructive admin page | Removed; moderation routes require moderator/admin; authz server-side (§4) |
| S2 | Client-generated identity | Server-issued anonymous sessions + JWT + DB session checks (§3) |
| S3 | Crisis telemetry in localStorage | No domain data in localStorage; crisis text never stored, metadata only (§11) |
| S4 | `dangerouslySetInnerHTML` XSS sink | Removed; JSON-only API + React text rendering, no HTML sinks (§9.2) |
| S5 | No server validation/sanitisation | zod validation on every input + plain-text sanitisation + body caps (§9) |
| S6 | Unauthenticated AI endpoint | AI server-only, session + chat rate limits, honest 503 (§10) |
| S7 | Committed Firebase identifiers | Firebase removed; secrets via env only (§12) |
| S8 | No security headers/CSP | Helmet + CSP profiles for API/docs/SPA (§7) |
| S9 | No CSRF strategy | Double-submit + HMAC CSRF, SameSite cookies (§5–6) |
| S10 | No rate limiting | Six limiters across abuse surfaces (§10) |
| S11 | No moderation audit log | `ModerationAction` collection; roles enforced (§4) |
| S12 | No retention/deletion | TTL indexes + user-initiated hard delete (§11.3) |
| S13 | No `.env.example` | `.env.example` + fail-fast env validation (§12) |
| S14 | 71 dependency vulnerabilities | CRA/Firebase toolchain removed; residual advisories documented with rationale + mitigations (§13.1) |
| S15 | No SECURITY.md/disclosure path | This document + §16 |
| S16 | Un-namespaced legacy keys | New `ay_*` cookies / no localStorage persistence (§6) |
