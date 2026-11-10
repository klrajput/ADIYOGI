# AdiYogi — Database Schema & Operations

**Status:** authoritative for the MongoDB data layer (implements [ARCHITECTURE §5](./ARCHITECTURE.md) and the
serialization contract in [ARCHITECTURE §12.7](./ARCHITECTURE.md)).

MongoDB is the single source of truth (§1). The browser `localStorage` may only hold UI
preferences such as the theme — never forum, chat, crisis or identity data.

---

## 1. Design principles

1. **One collection per aggregate.** 12 Mongoose models under `server/src/models/`, pluralised
   collections (`users`, `sessions`, …), all with `timestamps: true`.
2. **Anonymous-first identity.** A server-issued `Session` (anonymous or user) owns all content.
   Threads/replies snapshot the author (`authorType`, `authorId`, `authorModel`, `authorAlias`)
   so the API can render an alias without joining an identity collection.
3. **Nothing identifying in JSON.** Every model implements `toPublicJSON(options)` (see §6);
   `toJSON()` is wired to the viewer-less public projection, so an accidental `res.json(doc)`
   cannot leak `authorId`, hashes or `__v`.
4. **Soft delete for moderation, hard delete for privacy.** Forum content is soft-deleted
   (`status: 'deleted'` + `deletedAt`) to preserve audit integrity; account deletion and chat
   deletion are hard deletes and cascade.
5. **Retention is a database feature.** Chat, crisis and notification lifetimes are enforced by
   TTL indexes — no purge cron job to forget.
6. **Validation lives in the schema.** Types, enums, lengths and required fields are enforced by
   Mongoose; zod validates HTTP input first and these rules are the final backstop.

---

## 2. Connection management (`server/src/config/db.js`)

Exports `{ connectDatabase(uri?), disconnectDatabase(), getDbState() }` (§12.3).

| Concern | Implementation |
|---|---|
| Driver | Mongoose 8 / official MongoDB driver |
| Pool | `maxPoolSize: 10`, `minPoolSize: 0` |
| Timeouts | `serverSelectionTimeoutMS: 10s`, `socketTimeoutMS: 45s`, `connectTimeoutMS: 10s` |
| Initial retry | 3 attempts, exponential backoff (`500 ms → 1 s → 2 s`, capped at 4 s, + jitter) |
| Concurrent calls | Share one in-flight connect promise (boot + tests cannot open two pools) |
| Reconnect | Driver-level; lifecycle events logged via `config/logger.js` |
| Logging safety | Only the credential-redacted URI (`***:***@host`) is logged; passwords/query strings never are |
| State | `getDbState()` → `'connected' \| 'connecting' \| 'disconnected'` (used by `GET /health/ready`) |
| Database name | The URI's own database wins; `MONGODB_DB_NAME` fills in only for path-less URIs (mongodb-memory-server) |

Environment (`server/src/config/env.js`): `MONGODB_URI` (required), `MONGODB_DB_NAME`;
retention via `CHAT_RETENTION_DAYS`, `CRISIS_EVENT_RETENTION_DAYS`; bootstrap via
`SEED_ON_START`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`.

Readiness probing pattern:

```js
const { getDbState } = require('./config/db');
if (getDbState() !== 'connected') return res.status(503).json(/* SERVICE_UNAVAILABLE */);
```

---

## 3. Collections

### 3.1 `users` — User

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `_id` | ObjectId | auto | — | exposed as string `id` |
| `email` | String | yes | — | lowercase, trimmed, ≤254, **unique**, `select: false` |
| `passwordHash` | String | yes | — | bcrypt **cost 12**, `select: false`; callers assign the plaintext and the `pre('save')` hook hashes it |
| `role` | String | yes | `member` | enum `member`, `moderator`, `admin` |
| `displayName` | String | yes | — | 2–40 chars, trimmed |
| `status` | String | yes | `active` | enum `active`, `suspended` |
| `lastLoginAt` | Date | no | `null` | |
| `failedLoginAttempts` | Number | yes | `0` | ≥0; reset on successful login |
| `lockedUntil` | Date | no | `null` | account lockout window |
| `passwordChangedAt` | Date | no | `null` | set by the password hook |
| `deletedAt` | Date | no | `null` | soft-delete tombstone |
| `createdAt` / `updatedAt` | Date | auto | — | timestamps |

Indexes: **`email` unique** (login lookup, duplicate prevention), `role` (admin/moderator
listing and authorization queries). `email`/`passwordHash` are excluded from queries unless
explicitly selected (`User.findOne({ email }).select('+email +passwordHash')`).
Helper: `user.comparePassword(candidate)`, `User.findByCredentials(email, password)`.

### 3.2 `sessions` — Session

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `kind` | String | yes | `anonymous` | enum `anonymous`, `user` |
| `tokenHash` | String | yes | — | `sha256(refreshToken)` hex, 64–128 chars, **unique**, `select: false`; the raw token is never stored |
| `user` | ObjectId → User | no | `null` | set for `kind: 'user'` |
| `alias` | String | yes | — | anonymous display alias, 2–40 chars |
| `ipHash` | String | no | `null` | `HMAC-SHA256(ip, SESSION_SECRET)`; a raw IP is never stored or logged |
| `lastSeenAt` | Date | yes | now | |
| `expiresAt` | Date | yes | now + `SESSION_TTL_DAYS` | auto-set by `pre('validate')`; TTL index |
| `revokedAt` | Date | no | `null` | logout/rotation revocation |
| `rotatedFrom` | ObjectId → Session | no | `null` | audit link to the session a rotated token replaced |
| `createdAt` / `updatedAt` | Date | auto | — | |

Indexes: **`tokenHash` unique** (constant-time refresh-token lookup; uniqueness guarantees one
document per token), `user` (list/revoke all sessions of an account), **`expiresAt` TTL
`expireAfterSeconds: 0`** (automatic session cleanup).
Helper: `Session.isUsable(session)` — usable only when not revoked and not expired (TTL
deletion is asynchronous, so expiry is always checked in code).

### 3.3 `userpreferences` — UserPreference

One document per owner. `(ownerType, ownerId)` avoids a polymorphic ref:

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `ownerType` | String | yes | — | enum `session`, `user` |
| `ownerId` | ObjectId | yes | — | Session or User id; never serialized |
| `displayAlias` | String | no | `null` | 2–40 chars |
| `showCrisisBar` | Boolean | yes | `true` | |
| `contentWarningDefault` | Boolean | yes | `false` | |
| `reduceMotion` | Boolean | yes | `false` | |
| `createdAt` / `updatedAt` | Date | auto | — | |

Index: **`{ownerType, ownerId}` unique** — exactly one preference document per identity and
idempotent upserts.

### 3.4 `boards` — Board

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `slug` | String | yes | — | lowercase, `^[a-z0-9-]+$`, **unique** upsert key and URL segment |
| `name` | String | yes | — | 2–80 chars |
| `description` | String | no | `''` | ≤500 chars; admin quick-create may leave it empty, the seed always populates it |
| `icon` | String | no | `''` | one emoji, ≤16 UTF-16 units (admin quick-create may leave it empty) |
| `supportLevel` | String | yes | `general` | enum `general`, `peer`, `crisis` |
| `guidelines` | [String] | no | `[]` | 0–8 entries, each ≤300 chars (seeded boards always carry 3–4) |
| `tags` | [String] | yes | `[]` | ≤12 entries, lowercased |
| `order` | Number | yes | `0` | display order |
| `isActive` | Boolean | yes | `true` | admin soft-deactivation |
| `threadCount` | Number | yes | `0` | live counter — seed never overwrites |
| `replyCount` | Number | yes | `0` | live counter — seed never overwrites |
| `lastActivityAt` | Date | no | `null` | live counter — seed never overwrites |
| `createdAt` / `updatedAt` | Date | auto | — | |

Indexes: **`slug` unique** (upsert key, `GET /boards/:slug`), `order` (ordered list rendering).
Seeded from `server/src/data/boards.seed.js` (9 boards: support, anxiety, depression, trauma,
addiction, relationships, success, crisis, resources) by `seedService.seedBoards()`.

### 3.5 `threads` — Thread

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `board` | ObjectId → Board | yes | — | |
| `boardSlug` | String | yes | — | denormalised slug for list queries/filters |
| `title` | String | yes | — | 3–160 chars |
| `body` | String | yes | — | 1–5000 chars |
| `excerpt` | String | no | derived | ≤300 chars; derived from `body` by `pre('validate')` when omitted/edited |
| `contentWarning` | Boolean | yes | `false` | |
| `tags` | [String] | yes | `[]` | ≤6 entries, lowercased |
| `authorType` | String | yes | `anonymous` | enum `anonymous`, `user` |
| `authorId` | ObjectId | yes | — | Session or User id — **never serialized** |
| `authorModel` | String | yes | — | enum `Session`, `User` — **never serialized** |
| `authorAlias` | String | yes | — | alias snapshot shown to readers, 2–40 chars |
| `status` | String | yes | `published` | enum `published`, `hidden`, `removed`, `deleted` |
| `isPinned` / `isLocked` | Boolean | yes | `false` | moderator-managed |
| `replyCount` / `viewCount` | Number | yes | `0` | counters, ≥0 |
| `lastActivityAt` | Date | yes | now | bumped on new reply/edit |
| `moderatedBy` | ObjectId → User | no | `null` | **never serialized** |
| `moderationReason` | String | no | `null` | ≤500 chars |
| `editedAt` | Date | no | `null` | set on title/body/tags/CW edit |
| `deletedAt` | Date | no | `null` | soft-delete tombstone |
| `createdAt` / `updatedAt` | Date | auto | — | |

Indexes (order is significant for the documented contract):
- `{boardSlug: 1, status: 1, isPinned: -1, lastActivityAt: -1}` — board listing: filter by
  board + visibility, pinned first, most-recent activity last (the hot query of the forum).
- `{authorId: 1}` — "my content" (`GET /users/me/content`) and moderator lookups.
- `{createdAt: -1}` — global "new" sort (`?sort=new`).
- **text** `{title: 'text', body: 'text'}` named `thread_search`, weights `{title: 10, body: 4}`
  — `GET /threads?q=` full-text search; titles rank above bodies.

### 3.6 `replies` — Reply

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `thread` | ObjectId → Thread | yes | — | |
| `authorType` | String | yes | `anonymous` | enum `anonymous`, `user` |
| `authorId` | ObjectId | yes | — | never serialized |
| `authorModel` | String | yes | — | enum `Session`, `User`; never serialized |
| `authorAlias` | String | yes | — | 2–40 chars |
| `body` | String | yes | — | 1–3000 chars |
| `contentWarning` | Boolean | yes | `false` | |
| `status` | String | yes | `published` | enum `published`, `hidden`, `removed`, `deleted` |
| `moderatedBy` | ObjectId → User | no | `null` | never serialized |
| `moderationReason` | String | no | `null` | ≤500 chars |
| `editedAt` | Date | no | `null` | set on body edit |
| `deletedAt` | Date | no | `null` | soft-delete tombstone |
| `createdAt` / `updatedAt` | Date | auto | — | |

Indexes: `{thread: 1, status: 1, createdAt: 1}` — paginate visible replies of one thread in
chronological order (fixes audit D-2: replies are addressable, sortable, moderatable rows);
`{authorId: 1}` — "my replies" and moderator lookups.

### 3.7 `conversations` — Conversation

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `ownerType` | String | yes | — | enum `session`, `user`; never serialized |
| `ownerId` | ObjectId | yes | — | Session/User id; never serialized |
| `title` | String | yes | `New conversation` | ≤120 chars |
| `messageCount` | Number | yes | `0` | |
| `lastMessageAt` | Date | yes | now | |
| `riskLevel` | String | yes | `none` | enum `none`, `low`, `elevated`, `high` |
| `status` | String | yes | `active` | enum `active`, `archived` (deletion is a hard delete, §4.3) |
| `expiresAt` | Date | yes | now + `CHAT_RETENTION_DAYS` | auto-set by `pre('save')`; TTL index |
| `createdAt` / `updatedAt` | Date | auto | — | |

Indexes: `{ownerId: 1, lastMessageAt: -1}` — owner's conversation list; **`expiresAt` TTL
`expireAfterSeconds: 0`**.

### 3.8 `chatmessages` — ChatMessage

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `conversation` | ObjectId → Conversation | yes | — | |
| `role` | String | yes | — | enum `user`, `assistant` |
| `content` | String | yes | — | 1–2000 chars (HTTP limit enforced by zod) |
| `riskLevel` | String | yes | `none` | enum `none`, `low`, `elevated`, `high` |
| `aiProvider` | String | no | `null` | enum `gemini`, `none`; `none` = user turn or guided non-AI fallback |
| `aiModel` | String | no | `null` | ≤80 chars |
| `expiresAt` | Date | yes | now + `CHAT_RETENTION_DAYS` | auto-set by `pre('save')`; TTL index |
| `createdAt` / `updatedAt` | Date | auto | — | |

Indexes: `{conversation: 1, createdAt: 1}` — paginate a conversation; **`expiresAt` TTL
`expireAfterSeconds: 0`**.

### 3.9 `crisevents` — CrisisEvent (metadata only)

> **The `crisevents` collection must never gain a field that can store message or user text.**
> The assessed text is processed in memory and discarded; only the machine-readable assessment
> result is persisted (§7, §8).

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `session` | ObjectId → Session | yes | — | who triggered the event; never serialized |
| `level` | String | yes | — | enum `none`, `low`, `elevated`, `high` |
| `source` | String | yes | — | enum `manual`, `chat`, `content`, `assessment` |
| `triggerCodes` | [String] | yes | `[]` | ≤20 codes, each ≤64 chars; **reason codes only, never text** |
| `resourcesShown` | Boolean | yes | `false` | whether crisis resources were surfaced |
| `country` | String | no | `null` | ISO-3166 alpha-2 used to pick helplines, or `INTL` for the international fallback (user-selected, never geolocated) |
| `expiresAt` | Date | yes | now + `CRISIS_EVENT_RETENTION_DAYS` | auto-set by `pre('save')`; TTL index |
| `createdAt` / `updatedAt` | Date | auto | — | |

Indexes: `{createdAt: -1}` (30-day aggregate stats for moderators), `{level: 1, createdAt: -1}`
(severity over time), **`expiresAt` TTL `expireAfterSeconds: 0`**.

### 3.10 `reports` — Report

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `targetType` | String | yes | — | enum `thread`, `reply` |
| `targetId` | ObjectId | yes | — | reported Thread/Reply id |
| `targetThread` | ObjectId → Thread | no | `null` | owning thread (lets moderators jump from a reply report) |
| `reportedBy` | ObjectId | yes | — | Session/User id; never serialized |
| `reason` | String | yes | — | enum `spam`, `harassment`, `self_harm_risk`, `graphic`, `medical_misinformation`, `other` |
| `details` | String | no | `null` | ≤500 chars |
| `status` | String | yes | `open` | enum `open`, `reviewing`, `resolved`, `dismissed` |
| `reviewedBy` | ObjectId → User | no | `null` | never serialized |
| `reviewedAt` | Date | no | `null` | |
| `resolutionNote` | String | no | `null` | ≤500 chars |
| `createdAt` / `updatedAt` | Date | auto | — | |

Indexes: `{status: 1, createdAt: -1}` — moderator queue (open first, oldest first);
**`{targetType, targetId, reportedBy}` unique** — one report per reporter per target
(duplicate inserts raise `E11000`; controllers map to `409 CONFLICT`).

### 3.11 `moderationactions` — ModerationAction (append-only audit log)

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `moderator` | ObjectId → User | yes | — | audit attribution |
| `action` | String | yes | — | enum `hide`, `unhide`, `delete`, `pin`, `unpin`, `lock`, `unlock`, `report_review`, `report_resolve`, `report_dismiss` |
| `targetType` | String | yes | — | enum `thread`, `reply`, `report` |
| `targetId` | ObjectId | yes | — | |
| `reportId` | ObjectId → Report | no | `null` | set for report-lifecycle actions |
| `reason` | String | yes | — | 1–500 chars, required by §4.3 |
| `metadata` | Mixed | no | `{}` | small operational payload only (e.g. previous status) — **never content** |
| `createdAt` / `updatedAt` | Date | auto | — | |

Indexes: `{createdAt: -1}` — audit log pagination; `{moderator: 1}` — actions per moderator;
`{targetType: 1, targetId: 1}` — full history of one target.

### 3.12 `notifications` — Notification

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `recipientType` | String | yes | — | enum `session`, `user`; never serialized |
| `recipientId` | ObjectId | yes | — | Session/User id; never serialized |
| `type` | String | yes | — | enum `thread_reply`, `moderation`, `system` |
| `thread` | ObjectId → Thread | no | `null` | |
| `reply` | ObjectId → Reply | no | `null` | |
| `read` | Boolean | yes | `false` | |
| `message` | String | yes | — | ≤300 chars, plain text |
| `expiresAt` | Date | yes | now + 90 days | auto-set by `pre('save')`; TTL index |
| `createdAt` / `updatedAt` | Date | auto | — | |

Indexes: `{recipientId: 1, read: 1, createdAt: -1}` — inbox with unread filter, newest first;
**`expiresAt` TTL `expireAfterSeconds: 0`** (90-day retention, §5).

---

## 4. Relationships

```
User 1───* Session(user)          anonymous sessions have user = null
User 1───1 UserPreference(ownerType 'user')     Session 1───1 UserPreference(ownerType 'session')
Board 1───* Thread(board)         Thread 1───* Reply(thread)
Session|User 1───* Thread(authorId, authorModel) / Reply (polymorphic snapshot + alias)
Session|User 1───* Conversation(ownerId, ownerType) ───* ChatMessage(conversation)
Session 1───* CrisisEvent(session)
Report ──> Thread|Reply (targetType,targetId), Thread(targetThread), Session|User(reportedBy),
           User(reviewedBy)
ModerationAction ──> User(moderator), Thread|Reply|Report(targetType,targetId),
                     Report(reportId optional)
Notification ──> Session|User(recipientType,recipientId), Thread(thread), Reply(reply)
```

There are **no `ref`-based joins on hot read paths**: boards denormalise `boardSlug` on threads,
threads keep `authorAlias`/`authorType`/`replyCount`, so listing queries are single-collection.
Cross-collection cleanup is the controller/service's job (there are no Mongo transactions used
by default; operations are ordered so a retry is safe).

---

## 5. Soft delete, hard delete and retention semantics

| Operation | Semantics |
|---|---|
| `DELETE /threads/:id` (owner/mod) | `status: 'deleted'`, `deletedAt: now`; reads return `404 NOT_FOUND`; audit and reports stay intact |
| `DELETE /replies/:id` (owner/mod) | same soft delete on Reply |
| `DELETE /chat/conversations/:id` | **hard delete** conversation + its messages (privacy, §4.3) |
| `DELETE /users/me` | hard delete the requester's conversations/messages and authored content, then tombstone the User (`deletedAt`, anonymised `displayName`); session(s) revoked |
| Admin board delete | `isActive: false` (soft) — never a physical delete |
| Session logout/rotation | `revokedAt` set; TTL eventually removes the row |
| TTL expiry | MongoDB removes chat/crisis/notification/session rows automatically (background, within ~60 s of expiry) |

Rules:
- Every read path must filter `status: { $in: ['published'] }` (and `deletedAt: null` for users)
  unless the caller is a moderator looking at hidden/removed content.
- Soft-deleted content keeps `authorId` until the account-deletion cascade runs.
- TTL indexes only act on documents that **have** `expiresAt`; the pre-save hooks always set it.
  `findOneAndUpdate`/`updateOne` bypass document hooks, so any service that updates such a
  document must set/keep `expiresAt` explicitly (or use `save()`).

### Retention table (TTL, `expireAfterSeconds: 0`)

| Collection | TTL field | Lifetime source | Default |
|---|---|---|---|
| `sessions` | `expiresAt` | `SESSION_TTL_DAYS` | 30 days |
| `conversations` | `expiresAt` | `CHAT_RETENTION_DAYS` | 30 days |
| `chatmessages` | `expiresAt` | `CHAT_RETENTION_DAYS` | 30 days |
| `crisevents` | `expiresAt` | `CRISIS_EVENT_RETENTION_DAYS` | 90 days |
| `notifications` | `expiresAt` | fixed (`helpers.NOTIFICATION_RETENTION_DAYS`) | 90 days |

`expireAfterSeconds: 0` means "delete at the date stored in `expiresAt`". MongoDB's TTL monitor
runs about once per minute, so retention is eventual, not exact-to-the-second.

---

## 6. Serialization contract (`toPublicJSON`)

Every model exposes an instance method `toPublicJSON(options = {})`; the frozen shapes are in
[ARCHITECTURE §12.7](./ARCHITECTURE.md). Implementation notes:

- `options.viewerId` is the caller's ownership id: **`identity.userId` for accounts,
  `identity.sessionId` for anonymous sessions**, always compared with `String(...)`.
- `options.isModerator === true` (or `options.role === 'moderator'|'admin'`) widens
  `canDelete`/`canEdit` for moderators; the controller derives it from the authenticated role.
- `canEdit` = owner **and** `status === 'published'` **and** created within the 15-minute edit
  window (`helpers.EDIT_WINDOW_MS`). `canDelete` = owner or moderator/admin.
- `toJSON()` is wired to `toPublicJSON()` (viewer-less), so `JSON.stringify(doc)` / `res.json(doc)`
  never leak internals. Controllers still pass `viewerId`/`isModerator` explicitly so
  ownership flags are correct.
- Hidden everywhere: `__v`, `passwordHash`, `tokenHash`, `email` (except the frozen User shape),
  `ipHash`, `authorId`, `authorModel`, `moderatedBy`, `ownerId`, `ownerType`, `recipientId`,
  `recipientType`, `reportedBy`, `reviewedBy`, `session`.
- ModerationAction emits `moderator: {id, displayName}`; populate `moderator` in the controller
  for `displayName`, otherwise `displayName` is `null`.
- `Session` and `CrisisEvent` are **never serialized to clients**; their projections exist only
  as a defensive measure. Build the documented `identity` / `{acknowledged, resources}`
  response objects explicitly in the controller.

Serialization options matrix:

| Model | viewerId | isModerator | Extra |
|---|---|---|---|
| Board, User, UserPreference, ChatMessage, Notification, Conversation, CrisisEvent, Session | — | — | — |
| Thread | yes | yes | `boardName` appears when `board` is populated |
| Reply | yes | yes | |
| Report | yes (`isOwner` = reporter) | — | |
| ModerationAction | — | — | populate `moderator` |

---

## 7. Access and ownership rules

| Action | anonymous | member | moderator | admin |
|---|---|---|---|---|
| Read active boards/threads/replies | ✅ | ✅ | ✅ | ✅ |
| Create thread/reply/report/chat/crisis event | ✅ | ✅ | ✅ | ✅ |
| Edit/delete own content | ✅ (15 min) | ✅ (15 min) | ✅ | ✅ |
| Hide/remove content, resolve reports | ❌ | ❌ | ✅ | ✅ |
| Pin/lock threads, audit log/stats | ❌ | ❌ | ✅ | ✅ |
| Manage boards, create moderators, delete accounts | ❌ | ❌ | ❌ | ✅ |

Ownership is always decided **server-side** by comparing the stored ownership id with
`identity.userId ?? identity.sessionId`; client-supplied ids are never trusted. Moderators never
see raw author identity: only aliases and opaque ids needed to apply an action.

Board `supportLevel: 'crisis'` content must have resources surfaced by the service layer; the
database itself stores no content text with crisis events.

---

## 8. Seeding and admin bootstrap

- `server/src/data/boards.seed.js` — the nine boards (content adapted from the prototype; no
  invented statistics).
- `server/src/services/seedService.js` — idempotent `seedBoards()` (upsert by slug; preserves
  `threadCount`/`replyCount`/`lastActivityAt`/`isActive`) and `ensureAdminFromEnv()` (creates the
  admin only when `ADMIN_EMAIL`+`ADMIN_PASSWORD` are set and the email does not exist; password
  ≥10 chars; never logged).
- Run manually: `npm run seed --workspace server` (or `node server/scripts/seedBoards.js`).
- Start-up: `SEED_ON_START=true` → `server.js` calls `seedBoards()`; admin bootstrap is a
  deploy-time action via `npm run create:admin --workspace server` or the env path.
- `server/scripts/createAdmin.js` — creates an admin or promotes an existing account; validates
  password length ≥10, prints only email/role/action. Use `--update-password` to reset a password.

---

## 9. Local development & testing

```bash
# 1. Environment (repo root): required secrets outside NODE_ENV=test
cp .env.example .env
openssl rand -hex 32   # JWT_SECRET
openssl rand -hex 32   # SESSION_SECRET
# MONGODB_URI=mongodb://127.0.0.1:27017/adiyogi

# 2. Local MongoDB (choose one)
docker run -d --name adiyogi-mongo -p 27017:27017 mongo:7
# or a local/Atlas deployment — set MONGODB_URI accordingly

# 3. Seed
npm run seed --workspace server
```

Tests use `mongodb-memory-server` (already a server devDependency); no local `mongod` is
required. Jest setup sets `NODE_ENV=test` and test secrets, and tests call
`connectDatabase(memoryServer.getUri())`, then `disconnectDatabase()` in teardown.

Quick data sanity check:

```bash
node -e "require('./server/src/config/db').connectDatabase().then(async()=>{const {Board}=require('./server/src/models');console.log(await Board.countDocuments(), 'boards');await require('./server/src/config/db').disconnectDatabase();})"
```

---

## 10. MongoDB Atlas setup (production)

1. **Cluster** — create an Atlas project and a cluster (M10+ recommended for production SLAs;
   M0 is fine for staging only). Choose the region closest to the API deployment.
2. **Database user** — Atlas → *Database Access* → *Add New Database User* → password auth →
   role `readWrite` on database `adiyogi` (least privilege; no `dbAdmin`/`atlasAdmin` for the app).
3. **Network access** — *Network Access* → add the API host's egress IP(s) (Render/Railway/Fly
   static egress or NAT gateway). Prefer PrivateLink/VPC peering over `0.0.0.0/0`. Include the
   developer IP for local debugging only, temporarily.
4. **Connection string** — *Connect → Drivers*:
   `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/adiyogi?retryWrites=true&w=majority`
   Set it as `MONGODB_URI` in the API host's secret store (never in git). Atlas enforces TLS by
   default; do not disable certificate validation in production.
5. **Verification** — `curl -s https://<api>/api/v1/health/ready` must return `200` with DB
   `connected`; `/health` stays DB-independent.
6. **Backups** — enable Atlas Cloud Backup (continuous snapshots on M10+); configure alerts for
   connection count, ops/sec and disk usage.

Operational notes: keep the pool ≤ the cluster's connection limit, set `MONGODB_DB_NAME=adiyogi`,
rotate the DB password with the deployment secret store, and never log `MONGODB_URI` with
credentials (db.js redacts it).

---

## 11. Backup and restore

```bash
# Logical backup (works against Atlas and self-hosted; --oplog gives point-in-time consistency)
mongodump --uri="$MONGODB_URI" --gzip --archive="adiyogi-$(date +%F-%H%M).archive"

# Restore into a scratch database first, verify, then replace production
mongorestore --uri="$MONGODB_URI" --gzip --archive="adiyogi-2026-04-01-1200.archive" \
  --nsFrom="adiyogi.*" --nsTo="adiyogi_restore.*"

# Restore users/boards only (small, safe rollback)
mongorestore --uri="$MONGODB_URI" --gzip --archive="backup.archive" \
  --nsInclude="adiyogi.boards" --nsInclude="adiyogi.users"
```

Rules: take a backup before every schema/index migration; test restores quarterly; encrypt
backup archives at rest and restrict access (they contain aliases and moderation history);
`mongodump` is not a substitute for Atlas continuous backup. With TTL collections, restored data
past `expiresAt` will be removed by the TTL monitor — expected behaviour.

---

## 12. Index verification

Indexes are declared in each model file and built automatically by Mongoose when a model is first
used (and by `Model.init()`). Verify in CI or after a deploy:

```bash
node -e "
process.env.NODE_ENV='test'; // or your real env
const { connectDatabase, disconnectDatabase } = require('./server/src/config/db');
const models = require('./server/src/models');
(async () => {
  await connectDatabase();
  for (const Model of Object.values(models)) await Model.init(); // builds declared indexes
  for (const Model of Object.values(models)) {
    const indexes = await Model.collection.indexes();
    console.log(Model.modelName, indexes.map((i) => i.name).join(', '));
  }
  await disconnectDatabase();
})().catch((error) => { console.error(error); process.exit(1); });
"
```

With a live shell:

```bash
mongosh "$MONGODB_URI" --eval 'db.threads.getIndexes()'
mongosh "$MONGODB_URI" --eval 'db.sessions.getIndexes().filter(i => i.expireAfterSeconds === 0)'
mongosh "$MONGODB_URI" --eval 'db.threads.aggregate([{ $indexStats: {} }])'   # index usage
```

`Model.syncIndexes()` drops indexes that are no longer declared — run it deliberately during a
migration window, never on every deploy against a large production collection. Prefer
`Model.init()` (create missing only) for normal operation.

Expected index names: `users: email_1, role_1` · `sessions: tokenHash_1, user_1, expiresAt_1` ·
`userpreferences: ownerType_1_ownerId_1` · `boards: slug_1, order_1` · `threads:
boardSlug_1_status_1_isPinned_-1_lastActivityAt_-1, authorId_1, createdAt_-1, thread_search` ·
`replies: thread_1_status_1_createdAt_1, authorId_1` · `conversations:
ownerId_1_lastMessageAt_-1, expiresAt_1` · `chatmessages: conversation_1_createdAt_1,
expiresAt_1` · `crisevents: createdAt_-1, level_1_createdAt_-1, expiresAt_1` · `reports:
status_1_createdAt_-1, targetType_1_targetId_1_reportedBy_1` · `moderationactions: createdAt_-1,
moderator_1, targetType_1_targetId_1` · `notifications: recipientId_1_read_1_createdAt_-1,
expiresAt_1`.

---

## 13. Migrating from the legacy localStorage prototype (audit D-7)

The prototype stored `mh_chan_threads` (a nested `threads[].posts[]` array), `mh_chan_session`
(browser-generated fake id), `mh_chan_preferences` and `crisis_events` in `localStorage`. There is
no server data to recover, so migration is an **export → transform → validate → insert** flow.

1. **Export** — in the legacy app's browser console:
   ```js
   copy(JSON.stringify({
     threads: JSON.parse(localStorage.getItem('mh_chan_threads') || '[]'),
     preferences: JSON.parse(localStorage.getItem('mh_chan_preferences') || '{}'),
   }));
   ```
   Save as `legacy-export.json`. Treat it as untrusted input (audit D-4: the prototype accepted
   arbitrary JSON). Never import it with `insertMany` bypassing validation.
2. **Transform** — one legacy thread → one `Thread`, each `posts[]` entry → one `Reply`:

   | Legacy field | New field |
   |---|---|
   | `subject` / `content` | `title` / `body` |
   | `boardId` | `boardSlug` (resolve the Board to set `board`) |
   | `hasContentWarning` | `contentWarning` |
   | `tags` | `tags` (lowercase, trim, max 6) |
   | `timestamp` | leave to `createdAt` (timestamps are server-owned) |
   | `anonymous` (always true) | `authorType: 'anonymous'` |
   | — (new) | create one migration `Session` per legacy author/browser and use its `_id` as `authorId`, `authorModel: 'Session'`, `authorAlias` like `Seeker 4F2A` |
   | `replyCount` | **do not import — recompute** after inserting replies |
   | `posts[]` | `Reply` rows with `thread` ref; never nest them in the document |

   Drop every invented statistic (`stats.threads`, `stats.posts`, `stats.active`), the fake
   `mh_chan_session` id (the server issues identities), and all crisis-detection records
   (re-assess server-side; `CrisisEvent` stores metadata only).
3. **Validate + insert** — a one-off Node script (git-ignored or under `server/scripts/`) that
   calls `connectDatabase()`, creates a migration admin/moderator user, loops over the export and
   uses `Model.create(...)` so schema validation rejects malformed rows; collect a
   `{imported, skipped, errors[]}` report and print it. Sanitise text (strip HTML, enforce plain
   text, length limits) before insertion — this closes the D-4 stored-XSS path.
4. **Recompute counters** — after import:
   `Board.updateMany({}, { $set: { threadCount: 0, replyCount: 0 } })` then aggregate per board,
   and set `lastActivityAt` from the newest thread/reply. Never trust legacy counts.
5. **Verify** — counts match the export in dry-run mode, spot-check 20 threads/replies, run
   `db.threads.getIndexes()` in `mongosh`, and confirm no document contains the legacy fake ids
   or HTML.

The import is one-way (no write path exists back to `localStorage`); after cutover the client
must never read forum/chat/crisis data from `localStorage` again (§1).

---

## 14. Known constraints

- Index builds are automatic in development; for large production collections run
  `Model.init()` during a deploy window (or use a migration job) to avoid foreground index builds.
- TTL deletion is eventual (~60 s monitor cadence); authorization must always check
  `expiresAt`/`revokedAt` in code (see `Session.isUsable`).
- Cross-collection referential integrity is application-level (MongoDB has no foreign keys);
  services must cascade on account/conversation deletion.
- No content text may ever be added to `crisevents` or `moderationactions.metadata`.
- Transactions are not used; multi-document writes are ordered so an idempotent retry is safe
  (unique indexes act as the de-duplication guard, e.g. reports).
