# AdiYogi API Documentation

**Version:** 2.0.0 · **Base path:** `/api/v1` · **Content type:** `application/json` (UTF-8)
**Machine-readable spec:** `GET /api/docs/openapi.json` (OpenAPI 3.0.3) · **Swagger UI:** `GET /api/docs`

This document is the authoritative human reference for the REST API implemented in `server/src`.
Every success uses one envelope, every error uses one envelope, every mutation is validated and
CSRF-protected, every collection is paginated (max `limit` 50), and every resource access is
authorized server-side against the caller's signed session.

---

## 1. Quick start

Anonymous-first flow: you create a session, receive httpOnly cookies plus a CSRF token, then send
that token in the `x-csrf-token` header on every non-GET request.

```bash
BASE=http://localhost:4000/api/v1
JAR=/tmp/adiyogi-cookies.txt

# 1. Bootstrap an anonymous identity (also sets cookies)
curl -s -c "$JAR" -X POST "$BASE/auth/session"

# 2. Read the CSRF token (also returned by step 1 as data.csrfToken, and stored in ay_csrf)
CSRF=$(curl -s -b "$JAR" -c "$JAR" "$BASE/auth/csrf" | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).data.csrfToken')

# 3. Create a thread (CSRF header required)
curl -s -b "$JAR" -X POST "$BASE/threads" \
  -H "content-type: application/json" \
  -H "x-csrf-token: $CSRF" \
  -d '{"boardSlug":"anxiety","title":"Late-night overthinking","body":"I keep replaying conversations at night and cannot settle. What small things help you sleep?","tags":["sleep"]}'
```

Account flow (moderator/admin use the same endpoints):

```bash
# Register (min 10-char password) -> 201, sets session cookies
curl -s -c "$JAR" -X POST "$BASE/auth/register" \
  -H "content-type: application/json" \
  -d '{"email":"you@example.com","password":"long-enough-password","displayName":"Quiet Maple"}'

# Login -> 200; five consecutive failures lock the account for 15 minutes
curl -s -c "$JAR" -X POST "$BASE/auth/login" \
  -H "content-type: application/json" \
  -d '{"email":"you@example.com","password":"long-enough-password"}'

# Rotate the refresh token / extend the session (requires the CSRF header)
curl -s -b "$JAR" -c "$JAR" -X POST "$BASE/auth/refresh" \
  -H "x-csrf-token: $CSRF"

# Logout -> 204 (session revoked, cookies cleared)
curl -s -b "$JAR" -X POST "$BASE/auth/logout" -H "x-csrf-token: $CSRF"
```

---

## 2. Response envelopes

### 2.1 Success

```json
{
  "success": true,
  "message": "Thread created",
  "data": { "thread": { "id": "665f1c2ab1d4c3e5f6a7b8c9" } },
  "meta": {}
}
```

- `data` is always an **object with named keys** — the canonical keys are listed per endpoint below
  (never a bare array at the top level).
- `meta` is `{}` for single resources. Collections always carry the pagination block:

```json
{ "page": 1, "limit": 20, "total": 137, "totalPages": 7, "hasNext": true, "hasPrev": false }
```

### 2.2 Error

```json
{
  "success": false,
  "message": "Validation failed",
  "error": {
    "code": "VALIDATION_ERROR",
    "details": [{ "path": "body.title", "message": "Required" }]
  },
  "requestId": "01HZX8T7Q2K3M4N5P6R7S8T9V0"
}
```

`requestId` matches the `X-Request-Id` response header and is safe to quote in a support report.
Error `details` never contain secrets, bodies of other users, or raw IP addresses.

### 2.3 Error codes

| Code | HTTP | When |
|---|---|---|
| `VALIDATION_ERROR` | 400 | zod params/query/body failure, semantic rejections (self-report, non-reportable target, action/target mismatch) |
| `UNAUTHENTICATED` | 401 | missing/invalid/expired session or access token |
| `CSRF_INVALID` | 403 | missing, mismatched or forged `x-csrf-token` |
| `FORBIDDEN` | 403 | authenticated but not allowed (role, ownership, locked thread, suspended account, edit window) |
| `NOT_FOUND` | 404 | resource missing or not visible to the caller |
| `CONFLICT` | 409 | duplicate email, duplicate report, duplicate board slug |
| `PAYLOAD_TOO_LARGE` | 413 | request body over 100 kB |
| `RATE_LIMITED` | 429 | limiter tripped or account locked; `error.details.retryAfterSeconds` |
| `CONTENT_BLOCKED` | 422 | conservative spam/solicitation policy violation |
| `AI_UNAVAILABLE` | 503 | AI provider missing/failed (never substituted with fake AI text) |
| `SERVICE_UNAVAILABLE` | 503 | dependency down (database readiness) |
| `INTERNAL_ERROR` | 500 | unexpected error (never includes internals) |

---

## 3. Authentication, cookies and CSRF

### 3.1 Identity model

Two server-issued identity kinds. The browser never mints or supplies an identity id.

| Kind | Created by | Ownership id used server-side |
|---|---|---|
| `anonymous` | `POST /auth/session` | Session id |
| `user` (member/moderator/admin) | `POST /auth/register` / `POST /auth/login` | User id |

`identity` object:

```json
{
  "id": "665f1c2ab1d4c3e5f6a7b8c9",
  "kind": "anonymous",
  "role": "member",
  "alias": "Anonymous",
  "createdAt": "2026-04-20T09:12:33.000Z",
  "isAnonymous": true,
  "preferences": {
    "displayAlias": "Anonymous",
    "showCrisisBar": true,
    "contentWarningDefault": false,
    "reduceMotion": false
  }
}
```

`preferences` also includes `updatedAt`. Aliases are random (`Seeker 4F2A` for anonymous sessions,
the display name for accounts) and can be changed via `PATCH /users/me/preferences`.

### 3.2 Cookies

| Cookie | Content | Flags | TTL |
|---|---|---|---|
| `ay_at` | HS256 access JWT `{sub, kind, role, uid?}` | `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` in production | `ACCESS_TOKEN_TTL_MIN` (15 min) |
| `ay_rt` | opaque 256-bit refresh token (only its SHA-256 is stored) | `HttpOnly`, `SameSite=Lax`, `Path=/api/v1/auth` | `SESSION_TTL_DAYS` (30 days) |
| `ay_csrf` | signed CSRF token `<random>.<hmac>` | readable (not `HttpOnly`), `SameSite=Lax`, `Path=/` | same as session |

The client uses `credentials: 'include'`. **No token is ever returned in a JSON body** — with the
single benign exception of the signed CSRF token (see 3.3).

### 3.3 CSRF

- Every `POST`/`PATCH`/`DELETE` under `/api/v1` must send header `x-csrf-token` equal to the
  `ay_csrf` cookie value; the token must also carry a valid HMAC (`SESSION_SECRET`).
- Missing/invalid → `403 CSRF_INVALID`. CSRF is checked **before** authentication, so an
  unauthenticated write without a token returns `403 CSRF_INVALID`, not `401`.
- Bootstrap exemption: `POST /auth/session`, `POST /auth/login` and `POST /auth/register` are
  exempt **only while the request carries no `ay_rt` cookie**. Once a session exists those routes
  require the header too — there is no session-bearing bypass.
- `GET /auth/csrf` returns `{ csrfToken }` and (re)sets the cookie. For convenience the same
  signed value is also returned as `data.csrfToken` by `POST /auth/session`,
  `/auth/register`, `/auth/login` and `/auth/refresh` (additive; same-origin clients can ignore it
  and read the cookie).

### 3.4 Session lifecycle

- `POST /auth/session` reuses a valid `ay_rt` cookie (refreshing the session when close to expiry)
  or creates an anonymous Session + default preferences. It always sets fresh cookies.
- `POST /auth/refresh` rotates the refresh token **in place** (`Session.tokenHash` is replaced and
  `expiresAt` extended; the previous token stops matching immediately) and keeps the same Session
  row, so an anonymous caller never loses ownership of their content. It issues a new access JWT
  and CSRF cookie. Expired/revoked sessions → `401 UNAUTHENTICATED` and cookies are cleared.
- `POST /auth/logout` revokes the current Session (`revokedAt`) and clears all three cookies → `204`.
- Access tokens are short-lived; when `ay_at` expires the client calls `/auth/refresh` (or
  `/auth/session`) and retries once. Role is always re-read from the database, never trusted from
  the JWT.

### 3.5 Authorization matrix

| Action | anonymous | member | moderator | admin |
|---|---|---|---|---|
| Read boards/threads/replies/notifications | ✅ | ✅ | ✅ | ✅ |
| Create thread/reply/report/chat, update own preferences | ✅ | ✅ | ✅ | ✅ |
| Edit own thread (15-minute window) / delete own content | ✅ | ✅ | ✅ | ✅ |
| Hide/remove any content, resolve reports, queue/stats/audit log | ❌ 403 | ❌ 403 | ✅ | ✅ |
| Pin/lock threads | ❌ 403 | ❌ 403 | ✅ | ✅ |
| Manage boards | ❌ 403 | ❌ 403 | ❌ 403 | ✅ |
| Delete my data | ✅ | ✅ | ✅ | ✅ |

Moderator-only routes are enforced with `requireSession` + `requireRole('moderator','admin')`:
anonymous sessions get `403 FORBIDDEN`, no session gets `401 UNAUTHENTICATED`.
Ownership is always the **server-side** id (`identity.userId` for accounts, `identity.sessionId`
for anonymous) — never a client-supplied id.

---

## 4. Rate limits

Limiter keys are the session id when authenticated, otherwise a truncated HMAC of the client IP
(raw IPs are never stored or logged). Trips return `429 RATE_LIMITED` with `Retry-After` and
`error.details.retryAfterSeconds`.

| Scope | Limit | Applies to |
|---|---|---|
| Global | 300 / 15 min per IP (health probes excluded) | every `/api/v1` request |
| `authLimiter` | 10 / 15 min, failed attempts only | `POST /auth/session`, `/auth/register`, `/auth/login` |
| `writeLimiter` | 20 / 10 min | thread/reply/preference/report/patch/delete writes, `/auth/refresh` |
| `reportLimiter` | 10 / hour | `POST /reports` |
| `chatLimiter` | 20 / 5 min | `POST /chat/conversations/:id/messages` |
| `crisisAssessLimiter` | 30 / 10 min | `POST /crisis/assess`, `POST /crisis/events` |

Login lockout is separate from the limiter: 5 consecutive wrong passwords set
`lockedUntil = now + 15 min`; further attempts return `429 RATE_LIMITED` with the remaining
seconds. Successful login clears the counters.

---

## 5. Conventions

- Every collection is paginated: `?page=1&limit=20` (`limit` max 50; larger values are rejected
  with `400 VALIDATION_ERROR`).
- Ids are 24-hex strings; malformed ids → `400 VALIDATION_ERROR`, unknown ids → `404 NOT_FOUND`.
- Text is stored as plain text (markup is stripped). `contentWarning` is a boolean flag only.
- Tags: ≤ 6 per thread, lowercase `^[a-z0-9-]{2,24}$` (duplicates removed).
- All `DELETE` endpoints return `204` with an empty body.
- Moderators see `hidden` content in listings; the author sees it only via `GET /threads/:id` and
  `/users/me/content`. `deleted`/`removed` content is never listed publicly.
- `GET /threads/:id` counts a view once per viewer per thread per 10 minutes (in-memory throttle).

---

## 6. Endpoints

### 6.1 Auth — `/api/v1/auth`

| Method | Path | Auth | Body | Success | Errors |
|---|---|---|---|---|---|
| POST | `/session` | public (bootstrap-exempt CSRF) | — | `200 {identity, csrfToken}` + cookies | 403 `CSRF_INVALID` (when a session cookie exists), 429 |
| GET | `/me` | session | — | `200 {identity}` | 401 |
| GET | `/csrf` | any | — | `200 {csrfToken}` | — |
| POST | `/register` | public (bootstrap-exempt CSRF) | `{email, password, displayName?}` | `201 {identity, csrfToken}` + cookies | 400, 403, 409 duplicate email, 429 |
| POST | `/login` | public (bootstrap-exempt CSRF) | `{email, password}` | `200 {identity, csrfToken}` + cookies | 400, 401 generic message, 403 suspended, 429 lockout/limit |
| POST | `/logout` | any | — | `204` (session revoked, cookies cleared) | 403 |
| POST | `/refresh` | `ay_rt` cookie + CSRF | — | `200 {identity, csrfToken}` (rotated in place) | 401, 403, 429 |

Notes:
- `email` ≤ 254 chars, lowercase-normalized. `password` 10–128 chars on register; `displayName`
  2–40 chars.
- Wrong credentials always return the same `401` message: `Email or password is incorrect`
  (no account enumeration; failed-login timing is equalized with a dummy bcrypt comparison).

### 6.2 Users — `/api/v1/users`

| Method | Path | Auth | Params/Body | Success | Errors |
|---|---|---|---|---|---|
| GET | `/me/preferences` | session | — | `200 {preferences}` | 401 |
| PATCH | `/me/preferences` | session | `{displayAlias?, showCrisisBar?, contentWarningDefault?, reduceMotion?}` (≥1 key) | `200 {preferences}` | 400, 401, 403, 429 |
| GET | `/me/content` | session | `?type=threads\|replies&page=&limit=` | `200 {threads}` **or** `{replies}` + meta | 400, 401 |
| DELETE | `/me` | session | `{deleteContent?: boolean}` (default `true`) | `204` (data deleted, cookies cleared) | 400, 401, 403, 429 |

`displayAlias`: 3–24 chars, `^[\w .-]+$`. Unknown preference keys are rejected (strict schema).
`/me/content` lists the caller's own content in **any** status (including hidden/deleted) so they
can audit what remains; `meta` is the standard pagination block.
`DELETE /me` hard-deletes, in order: threads authored by the caller (and all replies to them),
the caller's own replies, conversations + messages, notifications, preferences, reports authored by
the caller, crisis metadata for the caller's sessions, then revokes sessions (accounts) or deletes
the Session (anonymous) and deletes the `User` row for accounts. Only a session-id hash is logged.
With `deleteContent: false` authored forum content is retained (account/session/PII removal only).

### 6.3 Boards — `/api/v1/boards`

| Method | Path | Auth | Body | Success | Errors |
|---|---|---|---|---|---|
| GET | `/` | public | `?page=&limit=` | `200 {boards}` + meta | — |
| GET | `/:slug` | public | — | `200 {board}` | 404 (inactive boards are admin-visible only) |
| POST | `/` | admin | `{slug, name, description, icon, guidelines[], supportLevel?, tags?, order?, isActive?}` | `201 {board}` | 400, 401, 403, 409 duplicate slug |
| PATCH | `/:slug` | admin | subset of create fields (≥1) | `200 {board}` | 400, 401, 403, 404 |
| DELETE | `/:slug` | admin | — | `204` (soft delete: `isActive=false`) | 401, 403, 404 |

Boards are returned in `order` then creation order, with live `threadCount`, `replyCount`,
`lastActivityAt` counters maintained atomically by the write services.
`description` 10–500 chars, `icon` ≤ 8 chars, `guidelines` 1–8 entries (≤ 300 chars each),
`tags` ≤ 12, `supportLevel ∈ {general, peer, crisis}`.

### 6.4 Threads — `/api/v1/threads`

| Method | Path | Auth | Params/Body | Success | Errors |
|---|---|---|---|---|---|
| GET | `/` | public | `?board=&q=&tag=&sort=recent\|new\|replies&page=&limit=` | `200 {threads}` + meta | 400 |
| POST | `/` | session | `{boardSlug, title, body, tags?, contentWarning?}` | `201 {thread, support?}` | 400, 401, 403, 404 board, 422, 429 |
| GET | `/:id` | public | — | `200 {thread}` (counts a throttled view) | 400, 404 |
| PATCH | `/:id` | owner (15 min) / moderator | `{title?, body?, tags?, contentWarning?, isPinned?, isLocked?}` (≥1) | `200 {thread}` | 400, 401, 403, 404, 422, 429 |
| DELETE | `/:id` | owner / moderator | — | `204` (`status:'deleted'`) | 401, 403, 404, 429 |
| GET | `/:id/replies` | public | `?sort=old\|new&page=&limit=` | `200 {replies}` + meta | 400, 404 |
| POST | `/:id/replies` | session | `{body, contentWarning?}` | `201 {reply, support?}` | 400, 401, 403 locked, 404, 422, 429 |

Create rules:
- `boardSlug` must exist and be active (else `404`); `title` 3–160; `body` 20–5000; `tags` ≤ 6;
  `contentWarning` boolean.
- Content is sanitized to plain text and screened by the conservative spam filter
  (`422 CONTENT_BLOCKED` for high-confidence spam only — never mental-health vocabulary).
- The server runs a crisis assessment on the submitted text. When the level is `elevated` or
  `high`, the response includes `support: { level, showResources }` and a metadata-only crisis
  event is recorded. `support` is **advice for the UI** and is never persisted on the content or
  labelled on the user. If the crisis service is unavailable, posting still succeeds without
  `support`.
- Replies additionally notify the thread author (generic message only, never content) when the
  author differs from the replier. Locked threads reject replies with `403 FORBIDDEN`.

Thread object (`status ∈ {published, hidden, removed, deleted}`):

```json
{
  "id": "665f...", "boardSlug": "anxiety", "boardName": "Anxiety & Overthinking",
  "title": "...", "body": "...", "excerpt": "...",
  "contentWarning": false, "tags": ["sleep"], "author": { "alias": "Anonymous", "type": "anonymous" },
  "status": "published", "isPinned": false, "isLocked": false, "replyCount": 2, "viewCount": 14,
  "lastActivityAt": "2026-04-20T09:30:00.000Z", "editedAt": null, "createdAt": "2026-04-20T09:12:33.000Z",
  "isOwner": true, "canEdit": true, "canDelete": true
}
```

`boardName` is populated on every thread response (list, detail, create, update).
`canEdit` = owner AND published AND within 15 minutes. `canDelete` = owner OR moderator/admin.
Internal fields (`authorId`, `authorModel`, `moderatedBy`) are never serialized.

### 6.5 Replies — `/api/v1/replies`

| Method | Path | Auth | Success | Errors |
|---|---|---|---|---|
| DELETE | `/:id` | owner / moderator | `204` (`status:'deleted'`, counter decremented) | 401, 403, 404, 429 |

Moderator deletions are audited as a `ModerationAction` (`action:'delete'`, `targetType:'reply'`).

### 6.6 Reports — `/api/v1/reports`

| Method | Path | Auth | Body/Query | Success | Errors |
|---|---|---|---|---|---|
| POST | `/` | session | `{targetType:'thread'\|'reply', targetId, reason, details?}` | `201 {report}` | 400 own/non-reportable content, 401, 404, 409 duplicate |
| GET | `/` | moderator+ | `?status=open\|reviewing\|resolved\|dismissed&targetType=&page=&limit=` | `200 {reports}` + meta | 400, 401, 403 |
| PATCH | `/:id` | moderator+ | `{status:'reviewing'\|'resolved'\|'dismissed', resolutionNote?}` | `200 {report}` | 400, 401, 403, 404, 429 |

- Exactly one report per (target, reporter) — duplicates return `409 CONFLICT`.
- Only `published` content is reportable; reporting your own content → `400 VALIDATION_ERROR`.
- `reason` is frozen to: `spam`, `harassment`, `self_harm_risk`, `graphic`,
  `medical_misinformation`, `other`. `details` ≤ 500 chars.
- Reporter identity is never exposed in any response or in the moderation queue.
- `GET /reports` enriches each report with `targetExcerpt` (200-char preview), `targetStatus`,
  `targetAuthorAlias` and `targetThread {id, title, boardSlug, status}`.
- `PATCH` writes `ModerationAction` `report_review` / `report_resolve` / `report_dismiss` (audit).

### 6.7 Moderation — `/api/v1/moderation` (all moderator+)

| Method | Path | Body/Query | Success | Errors |
|---|---|---|---|---|
| GET | `/queue` | `?page=&limit=` | `200 {reports, hiddenThreads, hiddenReplies}` + nested `meta` per collection | 400, 401, 403 |
| POST | `/actions` | `{action, targetType, targetId, reportId?, reason?}` | `201 {moderationAction, target}` | 400, 401, 403, 404, 429 |
| GET | `/actions` | `?action=&targetType=&page=&limit=` | `200 {actions}` + meta | 400, 401, 403 |
| GET | `/stats` | — | `200 {stats}` | 401, 403 |

`POST /actions` compatibility matrix — incompatible pairs return `400 VALIDATION_ERROR`:

| targetType | allowed actions |
|---|---|
| `thread` | `hide`, `unhide`, `delete`, `pin`, `unpin`, `lock`, `unlock` |
| `reply` | `hide`, `unhide`, `delete` |

- `reason` is **required** for destructive actions (`hide`, `delete`), ≤ 500 chars.
- `hide` sets `status:'hidden'` (removed from public lists/details, still visible to the author and
  moderators and listed in the queue); `unhide` restores `published`; `delete` soft-deletes and
  decrements board counters.
- Supplying `reportId` resolves that report with the action and records the linkage.
- Every action appends a `ModerationAction {action, targetType, targetId, reportId?, reason,
  moderator:{id, displayName}, createdAt}` audit document.
- `GET /stats` returns aggregate integers only: `openReports`, `reportsToday`, `hiddenThreads`,
  `hiddenReplies`, `crisisEvents30d`, `threadsToday`, `repliesToday`. No content and no reporter
  identity.

### 6.8 Notifications — `/api/v1/notifications`

| Method | Path | Auth | Params | Success | Errors |
|---|---|---|---|---|---|
| GET | `/` | session | `?unreadOnly=true\|false&page=&limit=` | `200 {notifications}` + meta (incl. `meta.unreadCount`) | 400, 401 |
| PATCH | `/:id/read` | owner | — | `200 {notification}` | 400, 401, 404 (not the caller's) |
| POST | `/read-all` | session | — | `200 {updated}` (count of changed notifications) | 401, 429 |

Notifications are scoped to the caller's recipient identity; messages are generic (e.g.
`Someone replied to your thread`) and never contain post/reply content. Notifications expire
automatically after 90 days.

### 6.9 Chat (AI companion) — `/api/v1/chat` (all session; owner-scoped)

| Method | Path | Body/Query | Success | Errors |
|---|---|---|---|---|
| GET | `/conversations` | `?page=&limit=` | `200 {conversations}` + meta | 401 |
| POST | `/conversations` | `{title?}` (≤ 120) | `201 {conversation}` | 400, 401, 429 |
| GET | `/conversations/:id` | — | `200 {conversation, messages}` + meta | 400, 401, 404 |
| POST | `/conversations/:id/messages` | `{content}` (1–2000) | `200 {userMessage, assistantMessage, risk, ai, resources?}` | 400, 401, 403, 404, 429, 503 `AI_UNAVAILABLE` |
| DELETE | `/conversations/:id` | — | `204` (hard delete conversation + messages) | 400, 401, 404 |

`ai = { provider: "gemini"|"none", model, degraded }`. When the provider is unavailable the
endpoint returns `503 AI_UNAVAILABLE` with `error.details = { retryAfterSeconds,
canUseGuidedMode }` — **no fabricated AI reply is ever returned**. Chat/user messages expire per
`CHAT_RETENTION_DAYS`.

### 6.10 Crisis support — `/api/v1/crisis`

| Method | Path | Auth | Body/Query | Success | Errors |
|---|---|---|---|---|---|
| GET | `/resources` | public | `?country=IN\|US\|GB\|CA\|AU` (any value; unknown → international) | `200 {resources}` | — |
| POST | `/assess` | session (rate-limited) | `{text (≤ 5000), source?}` | `200 {assessment:{level, showResources, reasons, score}}` | 400, 401, 429 |
| POST | `/events` | session (rate-limited) | `{level:'low'\|'elevated'\|'high', source, country?}` | `200 {acknowledged:true, resources}` | 400, 401, 429 |

Assessed text is **never stored, logged or echoed**; crisis events store metadata only
(`level`, `source`, `triggerCodes`, `country`, `resourcesShown`) and expire per
`CRISIS_EVENT_RETENTION_DAYS`.

### 6.11 Health and docs

| Method | Path | Auth | Success | Notes |
|---|---|---|---|---|
| GET | `/health`, `/healthz`, `/api/v1/health` | public | `200 {status:'ok', uptime, version, env}` | liveness; no DB dependency |
| GET | `/health/ready` | public | `200 {status:'ok', uptime, version, env, db:'connected'}` / `503 SERVICE_UNAVAILABLE` | pings MongoDB |
| GET | `/api/docs` | public | Swagger UI HTML | CSP relaxed for this UI only |
| GET | `/api/docs/openapi.json` | public | OpenAPI 3.0.3 document | machine-readable contract |

---

## 7. Privacy and data lifecycle

- No tokens, emails, raw IPs or message content are logged. IPs are stored only as
  `HMAC-SHA256(ip, SESSION_SECRET)` (`ipHash`); logs use session-id hashes.
- Forum content is plain text; the API never returns HTML.
- `report`, `moderation`, `crisis` payloads never expose reporter identity; crisis events store no
  content.
- `DELETE /users/me` is the complete data-deletion path (see 6.2); soft-deleted content and
  moderation audit records are retained for integrity, while account deletion performs hard
  deletes of the caller's content and chat data.
- Anonymous identities require no PII; an account is only needed for moderator/admin operation.

---

## 8. Contract notes (intentional, approved)

1. **Auth responses also return `csrfToken`** (`data.csrfToken`) in addition to `identity`.
   Frozen §4.4 only names `identity`; the token is a double-submit value, not a credential, and
   cross-origin clients cannot read the cookie. Additive and safe.
2. **Refresh rotation is in place** (`Session.tokenHash` replaced, same Session id). Creating a new
   Session row on every 15-minute access-token refresh would change an anonymous caller's
   ownership id and orphan their threads/replies. The previous refresh token is invalidated
   because its hash no longer matches.
3. **`Report.reportedBy` uses the ownership id** (`identity.userId` for accounts,
   `identity.sessionId` for anonymous sessions) instead of always the session id, so the
   one-report-per-target unique index and the self-report guard work for signed-in accounts.
   The field is never serialized.
4. **`Report.reason`** is the frozen six-value set (`spam`, `harassment`, `self_harm_risk`,
   `graphic`, `medical_misinformation`, `other`).
5. **`DELETE /users/me` accepts `deleteContent`** (default `true`); `false` keeps authored forum
   content while removing the account/session and personal data.

---

## 9. Swagger / OpenAPI

- `GET /api/docs` — interactive Swagger UI (try-it-out enabled, cookie auth documented).
- `GET /api/docs/openapi.json` — OpenAPI 3.0.3 document; contains every path, parameter,
  request body, success/error response envelope, the three cookie security schemes
  (`ay_at`, `ay_rt`, `ay_csrf`) and the `x-csrf-token` header parameter.
- The document is generated from `server/src/config/swagger.js` and is validated in the
  verification suite (structure, path coverage, responses).
