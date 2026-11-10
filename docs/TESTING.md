# AdiYogi — Testing & QA

**Status:** authoritative for the production overhaul.
Owner: QA/testing. Scope: `server/tests/**`, `client/src/__tests__/**`, `e2e/**`, this document.

The prototype had **zero tests for the real application** (`docs/TECHNICAL_AUDIT.md` §1). This
document describes the suite that protects the frozen contracts in `docs/ARCHITECTURE.md`
(§4 envelopes/codes/pagination, §5 models, §6 auth/CSRF/rate limits, §7 AI failure semantics,
§8 crisis behaviour, §12 module interfaces).

---

## 1. Test strategy

| Layer | Runner | What it proves | External services |
|---|---|---|---|
| Server unit | Jest (node) | Pure contract logic: envelopes, error codes, pagination, tokens, CSRF signing, redaction, sanitisation, risk scorer, prompt boundaries, crisis data | none |
| Server integration | Jest + supertest + `mongodb-memory-server` | Real Express app, real middleware, real Mongo, real auth/CSRF/rate limits — endpoint behaviour end-to-end | in-memory MongoDB only |
| Client unit/component | Vitest + Testing Library (jsdom) | API client contract, identity context, design-system accessibility, page loading/error/empty states, no fabricated UI data | `fetch` mocked at the boundary |
| API end-to-end | `node e2e/journey.mjs` | One complete real-HTTP user journey against a real server + real DB | in-memory MongoDB only |
| Browser E2E | Playwright (optional) | Visual/navigation smoke at 390px + 1280px | **not run** — see §8 |

Principles:

- **No implementation mocking.** Unit tests exercise the real module; integration tests run
  supertest against the real app. Only external boundaries are substituted: `fetch` in the
  browser, and the AI provider through the documented seam
  `server/src/services/ai/provider.js → setProviderForTesting(provider | null)`.
- **Contract-first assertions.** When behaviour and `docs/ARCHITECTURE.md` disagreed, the test
  asserts the contract and the product bug was reported (see §7); tests were never weakened to go
  green.
- **No fake success.** No `expect(true).toBe(true)`, no skipped/todo tests, no assertions on mock
  internals where an integration assertion is possible.
- **Privacy assertions are DB-level.** Crisis events, chat messages, sessions and the
  `DELETE /users/me` cascade are verified against raw MongoDB documents, not just JSON responses.

---

## 2. How to run

From the repository root (npm workspaces):

```bash
# everything (server then client)
npm run test

# one workspace
npm run test -w server            # jest --runInBand
npm run test -w client            # vitest run

# focused runs
npx --workspace server jest tests/integration/auth.test.js
npx --workspace client vitest run src/__tests__/pages.test.jsx

# coverage (server works out of the box)
npm run test:coverage -w server

# API end-to-end journey (starts its own in-memory Mongo + HTTP server)
node e2e/journey.mjs

# lint (tests are linted too)
npm run lint
```

In this sandbox every npm/npx command must use the repo-local npm cache:

```bash
npm_config_cache="$PWD/.npm-cache" npm run test -w server
npm_config_cache="$PWD/.npm-cache" npm run test -w client
```

Jest config lives in `server/package.json` (`jest` key): `testEnvironment: node`,
`roots: ["<rootDir>/tests"]`, `setupFilesAfterEnv: ["<rootDir>/tests/setup.js"]`,
`testTimeout: 60000`. Client Vitest config lives in `client/vite.config.js` (jsdom, globals,
`setupFiles: ./src/__tests__/setup.js`).

### MongoDB for integration tests

`mongodb-memory-server` starts one in-memory MongoDB per test file (≈0.5 s once the binary is
cached) and the tests connect through the production `server/src/config/db.js` layer. The binary
is downloaded once and cached; `tests/helpers/db.js` chooses the cache directory in this order:

1. `MONGOMS_DOWNLOAD_DIR` (CI restores its own cache — see `.github/workflows/ci.yml`);
2. `node_modules/.cache/mongodb-memory-server` (warm in this workspace, gitignored);
3. the OS temp directory.

No test ever connects to a real Mongo instance or the internet.

---

## 3. What is covered per layer

### 3.1 Server unit (`server/tests/unit/`, 15 files)

| File | Contract covered |
|---|---|
| `pagination.test.js` | `getPagination` clamping (0/negative/non-numeric/huge), `buildMeta` arithmetic, empty collections, never `NaN` |
| `response.test.js` | success/error envelopes over a real Express app: `{success,message,data,meta}`, 201, 204, `requestId`, no stack leak |
| `apiError.test.js` | every `ApiError` static → frozen (status, code) pair; `expose` rules (500 hidden, 503 AI/DB safe); details omission |
| `tokens.test.js` | access JWT round-trip and claim shape, HS256 iss/aud/exp, tampering, wrong secret, expired, malformed → generic `INVALID_ACCESS_TOKEN`; opaque token entropy; SHA-256 hashing; CSRF HMAC round-trip/tamper/malformed |
| `cookies.test.js` | `ay_at`/`ay_rt`/`ay_csrf` flags (httpOnly, path, SameSite, Max-Age), refresh path scoping, CSRF readable, clearing with matching paths |
| `csrf.test.js` | double-submit enforcement over HTTP: missing header/cookie, mismatch, forged HMAC, valid token, bootstrap exemption only while sessionless, look-alike paths |
| `rateLimiters.test.js` | documented limits/config, `keyFor` (server-side session id / hashed IP, never raw IP), 429 `RATE_LIMITED` envelope + `retryAfterSeconds` + `Retry-After` |
| `middleware.test.js` | request-id UUID header + uniqueness, helmet headers + locked-down JSON CSP, CORS allow-list / disallowed preflight / credentials |
| `redact.test.js` | IP HMAC normalisation (IPv4-mapped, bracketed IPv6, zone ids), email masking, token masking |
| `env.test.js` | frozen config shape, test defaults, CORS list, AI unconfigured state, retention/rate-limit values, fail-fast validation without leaking secrets |
| `sanitize.test.js` | HTML/script stripping, control characters, whitespace normalisation, spam patterns; **crisis vocabulary is never treated as spam** |
| `prompt.test.js` | AI system prompt safety boundaries (no diagnosis/prescribing/monitoring, crisis resources + safety check, injection resistance), 12-message/2000-char context windows, user text stays data |
| `crisisResources.test.js` | US/IN/GB/CA/AU + INTL coverage, helpline entry shape, findahelpline fallback, disclaimer, `normalizeCountry`, `inferCountryFromRequest` (Accept-Language only, never IP) |
| `riskClassifier.test.js` | provider registry + test seam, typed provider errors, defensive JSON parsing, classifier can only raise severity, timeout/abort/failure → rules stand |
| `crisisRisk.test.js` | **≥40-case risk table**: explicit intent, plan/means, overdose/self-harm, farewell, negation ("I'm not suicidal"), third-person disclosures, quoted lyrics/movies, ambiguous single words never `high`, distress-only, empty/whitespace, non-English non-crash; weighted lexicon review; `getResources` fallback |

### 3.2 Server integration (`server/tests/integration/`, 7 files)

| File | Coverage |
|---|---|
| `auth.test.js` | anonymous bootstrap identity/cookies/preference row, session reuse, `/auth/me`, CSRF missing/mismatch/valid, register (weak password, invalid email, duplicate 409), login (wrong password/unknown email 401 parity, 5-failure lockout → 429), logout revokes server-side, refresh rotation (old token replay fails), expired/garbage JWT → 401 not 500 |
| `boards-threads.test.js` | board list/counters/404, admin-only board management (anonymous/member/moderator 403 vs admin), thread validation matrix (title 3, body 20–5000, ≤6 tags, tag chars, unknown board, >5000), create shape + owner flags, pagination meta page 1/2, board filter, search `q` (hit + empty), sort recent/new/replies, viewCount increment + throttle + `isOwner`, 15-min edit, foreign-session edit 403, member vs moderator pin, soft delete + public removal + 404, XSS payload inert JSON, spam 422 |
| `replies-notifications.test.js` | reply validation, unknown thread 404, locked thread 403, reply shape/counters, pagination + old/new sort, soft delete hides + decrements, author-only delete (403), notification created for thread author (not self-reply), unreadOnly filter, mark-read, read-all, ownership 404 |
| `moderation.test.js` | authorization matrix (member/anonymous refused, moderator allowed, board management admin-only), report create/duplicate 409/own content 400/unknown target 404/reason enum, queue contents, hide thread (public gone, moderator visible, queue listed), hide reply, unhide, delete + audit, pin ordering, lock rejects replies + unlock, incompatible action 400, reason required, unknown target 404, report resolution drops it from queue, audit log pagination/filter, stats shape, report listing filters |
| `users-privacy.test.js` | preference defaults/patch/persistence/validation, `/auth/me` reflection, own content threads+replies, `DELETE /users/me` full cascade (threads, replies, conversations, chat messages, notifications, crisis events, sessions) verified with DB counts, session revoked, account deletion (user row removed, sessions revoked), crisis-event document has **no text/content field** |
| `chat-crisis.test.js` | crisis resources all regions + junk fallback; `/crisis/assess` levels + stores nothing + never echoes text + rate limit 429; `/crisis/events` metadata-only + validation; **unconfigured provider → 503 AI_UNAVAILABLE, no persistence**; configured stub → conversation create/list/get, two-message persistence, ownership 404, hard delete, high-risk turn creates metadata-only CrisisEvent + resources + server safety message, provider throw → 503 no partial writes, empty response → 503; message validation; chat rate limit 429 |
| `system.test.js` | `/health`, `/healthz`, `/api/v1/health`, `/health/ready`, 404 envelope (API + non-API), malformed JSON 400, oversized body 413, request-id header on success/error, helmet headers, CORS allow-list/disallowed/preflight, OpenAPI document parses with every documented path, Swagger UI HTML, **every ARCHITECTURE §4.3 endpoint is mounted** |

### 3.3 Client (`client/src/__tests__/`, 5 files)

| File | Coverage |
|---|---|
| `ui.test.jsx` | Button variants/loading/disabled/link modes; Field/Input/Textarea/Select/Checkbox label wiring, `aria-invalid`, `role=alert` errors, required/hints; Modal Escape/backdrop/focus trap/focus restore; EmptyState/ErrorState/Pagination behaviour; Alert/Spinner live-region roles |
| `apiClient.test.js` | envelope unwrapping, pagination meta, query serialisation, CSRF header from cookie on POST/PATCH/DELETE (never GET), `ApiError` fields incl. request id, 204 handling, non-JSON errors, network `ApiError` (status 0) after exactly one GET retry (mutations are not retried), 401 → CSRF-then-session bootstrap → single retry, no bootstrap loop, bootstrap failure resolves null, 403 `CSRF_INVALID` → fresh token + one retry (never loops) |
| `identity.test.jsx` | anonymous bootstrap on 401, existing session, role flags, `updatePreferences` merge, logout → anonymous re-bootstrap, login swaps identity |
| `pages.test.jsx` | LandingPage (single honest hero, no fabricated statistics, AI disclosure), CommunityPage (loading skeleton → boards, error → retry refetch), BoardPage empty state, ThreadPage 404 state without raw errors, NewThreadPage short-body validation blocks submit, ChatPage AI disclosure + 503 AI_UNAVAILABLE retryable error with no fabricated assistant bubble, CrisisPage helplines from API + safe fallback on failure, ModerationPage unauthorised card |
| `a11y.test.jsx` | one `h1` per key screen, labelled form controls, icon-only controls have accessible names, `role=note` AI disclosure, `aria-live` async regions, `role=alert` error states without internals |

### 3.4 API end-to-end (`e2e/journey.mjs`)

One script, **61 assertions**, real HTTP against a real server on an ephemeral port and a real
in-memory MongoDB, with a genuine cookie jar + CSRF double-submit:

anonymous session → `/auth/me` → browse boards → create thread → second anonymous user replies →
author notification + mark read → third member reports the reply (+ duplicate 409) → moderator
login → moderation queue → hide the reply → report resolved + audit entry → verify the reply has
disappeared from the public list → crisis resources for US/IN/GB → `assess` a high-risk message
(stores nothing) → manual crisis event (metadata only) → `DELETE /users/me` → session 401 →
thread/crisis metadata hard-deleted → deleted thread gone from the public list.

```bash
node e2e/journey.mjs
# … E2E journey complete: 61 assertions passed, 0 failed.
```

### 3.5 Current results

| Suite | Command | Result |
|---|---|---|
| Server | `npm run test -w server` | **22 suites, 495 tests — all passing** |
| Client | `npm run test -w client` | **5 files, 75 tests — all passing** |
| API E2E | `node e2e/journey.mjs` | **61 assertions — all passing** |
| Lint | `npm run lint` (both workspaces, tests included) | clean |

Server coverage (`npm run test:coverage -w server`):

```
All files | % Stmts 87.7 | % Branch 67.92 | % Funcs 90.93 | % Lines 91.14
```

---

## 4. Failure-scenario matrix (from the project brief)

Each row is a failure mode from the brief, mapped to the test that proves the API/UI degrades
safely and honestly.

| Failure scenario | Expected behaviour | Test |
|---|---|---|
| Database unavailable | `/health/ready` → 503 `SERVICE_UNAVAILABLE`; no 500 storms | `system.test.js` (connected path); readiness-disconnected path is **not** covered — see §8 |
| Invalid credentials | 401 `UNAUTHENTICATED`, one generic message for unknown email and wrong password (no enumeration), rate-limited after repeated failures | `auth.test.js` (login block) |
| Missing/invalid fields | 400 `VALIDATION_ERROR` with `error.details[].path`, no partial writes | `boards-threads.test.js`, `replies-notifications.test.js`, `users-privacy.test.js`, `chat-crisis.test.js`, `system.test.js` |
| Unauthorized action | 403 `FORBIDDEN` for authenticated-but-not-allowed; 403 `CSRF_INVALID` for missing/mismatched CSRF | `moderation.test.js`, `boards-threads.test.js`, `replies-notifications.test.js`, `auth.test.js` |
| Expired session / JWT | 401 `UNAUTHENTICATED` (never 500); refresh rotation invalidates the old token; revoked session rejected immediately | `auth.test.js` |
| Rate limit | 429 `RATE_LIMITED` with `error.details.retryAfterSeconds` and `Retry-After` | `rateLimiters.test.js`, `auth.test.js` (lockout), `chat-crisis.test.js` (chat + assess) |
| AI unavailable / provider failure | 503 `AI_UNAVAILABLE` with `canUseGuidedMode` (+ non-AI `guidedExercise`), **nothing persisted**, no fabricated reply | `chat-crisis.test.js` (unconfigured, throw, empty text), `pages.test.jsx` (ChatPage 503 UI) |
| Empty search result | 200 with `data.threads: []` and `meta.total: 0` (no error) | `boards-threads.test.js` (search block) |
| Invalid thread ids | unknown-but-valid ObjectId → 404 `NOT_FOUND`; malformed id → 400 `VALIDATION_ERROR` | `boards-threads.test.js`, `replies-notifications.test.js`, `system.test.js` |
| Network interruption | typed `ApiError` (`status: 0`, `NETWORK_ERROR`); idempotent GET retried exactly once; mutations never auto-retried | `apiClient.test.js` |
| Oversized request body | 413 `PAYLOAD_TOO_LARGE` | `system.test.js` |
| Crisis disclosure | layered risk score, resources shown, nothing stored, no diagnosis language | `crisisRisk.test.js`, `chat-crisis.test.js`, `users-privacy.test.js`, `e2e/journey.mjs` |
| Content-policy violation | 422 `CONTENT_BLOCKED`; crisis vocabulary is never mistaken for spam | `boards-threads.test.js`, `sanitize.test.js` |
| Missing/invalid session cookie | public reads keep working; protected routes 401 | `auth.test.js`, `system.test.js` |

---

## 5. Test helpers and seams

- `server/tests/helpers/db.js` — MongoMemoryServer lifecycle, `clearDatabase()`, raw collection
  access (`countDocuments`, `findRaw`, `collectionNames`) for privacy/schema assertions.
- `server/tests/helpers/app.js` — one cached `createApp()`, supertest agents with a real cookie
  jar (`anonymousAgent`, `bootstrapAnonymous`, `loginAgent`, `memberAgent`, `moderatorAgent`,
  `adminAgent`), CSRF-aware `authGet/authPost/authPatch/authDelete`, cookie-flag parsing.
- `server/tests/helpers/factories.js` — valid payload builders (thread/reply/report/board/
  preferences/conversation/message/register) and direct model inserts for privileged accounts
  and fixtures.
- `server/tests/helpers/envelopes.js` — `expectSuccess`, `expectError(status, code)`,
  `expectPaginationMeta`, so every response is checked against §4.
- AI seam: `setProviderForTesting(stub)`; reset with `setProviderForTesting(null)`. Never call a
  real provider in tests (there is no `AI_API_KEY` in this environment, so the unconfigured 503
  path is also exercised for real).
- Client: only `global.fetch` and `client/src/api/endpoints.js` are mocked; the client API layer
  and React components run for real.

---

## 6. CI integration

`.github/workflows/ci.yml` runs, in parallel jobs:

1. **Lint + client + build** — `npm run lint`, `npm run test -w client`, `npm run build -w client`;
2. **Server tests** — restores a `mongodb-memory-server` binary cache, then
   `npm run test -w server`.

Recommended additions (not required for this overhaul):

- add `node e2e/journey.mjs` as a third job/step (it needs no browser, only Node);
- publish server coverage as an artifact with a conservative floor (current: 87.7% statements,
  91.1% lines);
- add the client coverage dependency (`@vitest/coverage-v8`) if client coverage is wanted.

Rules for a PR to be mergeable: both suites green, lint clean, no skipped tests, no `.only`.

---

## 7. Product bugs the suite found (and status)

Reported with file/expectation/actual; all have since been fixed by their owners.

1. **Logout did not revoke the session** (`server/src/services/authService.js`): the auth
   middleware hands controllers a *lean* Session object, so `session.save()` in `revokeSession`
   threw and was swallowed — a logged-out session stayed usable. Fixed with an atomic
   `Session.updateOne(...)` (asserted by `auth.test.js` "revokes the session server-side").
2. **Crisis farewell rule could never reach `high`** (`server/src/services/crisisService.js`):
   `detectSubject()` downgraded the high-tier `farewell` rule to `low` for "this is my last
   message", "goodbye forever"; third-person "my friend wants to die" and "I have written a
   goodbye note" were missed. Fixed in the rule engine; `crisisRisk.test.js` encodes the
   regression table.
3. **`ChatMessage.aiProvider` enum rejected non-Gemini providers** — a provider id such as
   `stub`/future vendors caused a 500 on chat send. Fixed to a trimmed ≤32-char string (surfaced
   by the orchestrator integration check; covered by `chat-crisis.test.js`).
4. **AI route modules booted with wrong relative requires**
   (`server/src/routes/v1/chat.routes.js`, `crisis.routes.js` required `../middleware/*` instead
   of `../../middleware/*`) — the whole app failed to boot. Fixed; `system.test.js` now asserts
   `createApp()` and every documented endpoint.
5. Minor accepted deviation: refresh rotation is performed **in place** (token hash rotated on the
   same Session row) instead of creating a new row with `Session.rotatedFrom` audit metadata.
   Observable behaviour matches §6.2 (old token immediately invalid, new token works, same
   identity); `auth.test.js` asserts that behaviour and documents the deviation here.
6. Minor open inconsistency: `Report.toPublicJSON()` is called without viewer options by
   `reports.controller.js`, so `isOwner` is always `false` in report responses even for the
   reporter. It is a boolean per §12.7 so the shape is valid; `moderation.test.js` asserts the
   shape and this doc records the semantic gap.

---

## 8. What is not tested (honest list)

- **Browser/visual E2E.** Playwright was intentionally skipped: the Chromium download stalls in
  the sandbox. The API-level journey (`e2e/journey.mjs`) covers the whole flow over real HTTP, but
  there is no real-browser check of rendering, layout at 390px/1280px, or navigation.
- **Visual regression / screenshot baselines**, cross-browser rendering, real-device testing.
- **Real AI provider calls.** Covered only through `setProviderForTesting`; Gemini latency,
  quota errors, safety filters and model-specific output are not exercised (no API key here).
- **Readiness failure path.** `/health/ready` is asserted only against a connected database. The
  503 `SERVICE_UNAVAILABLE` branch needs the shared Mongoose connection stopped, which is unsafe
  inside a `--runInBand` file that later tests reuse; it should be a dedicated process-level test.
- **Horizontal scaling caveat.** Rate-limit stores are in-memory per process; multi-instance
  behaviour and shared-store configuration are untested (documented limitation).
- **Email/notification delivery.** There is no email transport in the product; only in-app
  notifications are tested.
- **TTL index expiry timing.** Chat/crisis/notification TTLs are asserted at the configuration
  level (`expiresAt` present, models), not by waiting for MongoDB's background TTL reaper.
- **Load/performance/concurrency.** No k6/autocannon load tests, no race-condition fuzzing beyond
  the idempotency/retry tests.
- **Client coverage numbers.** `vitest --coverage` requires `@vitest/coverage-v8`, which is not a
  dependency; client coverage is therefore not reported.
- **File uploads, email/password reset, OAuth.** Not part of the frozen product surface.
