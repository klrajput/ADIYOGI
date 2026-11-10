# Migrating from the v1 prototype

This document explains what changed between the original AdiYogi repository (`main` @ `d1036e9`)
and v2, and how to move any real data a deployment of the prototype might still hold.

## What was removed and why

| Removed | Reason | Replacement |
|---|---|---|
| `src/` (React 18 CRA-style app) | Data lived in `localStorage`; identity was fabricated in the browser; the chatbot was a hard-coded reply table | `client/` (React 18 + Vite) talking to the real API |
| `public/`, `config/`, `scripts/` (vendored `react-scripts` 5) | ~2,000 lines of copied CRA tooling, unmaintained, source of 71 dependency vulnerabilities | Vite build (`client/vite.config.js`) |
| `community-forum/` (vanilla JS + Firestore) | Second product with a second backend; committed Firebase project config | Single forum in the main app backed by MongoDB |
| `chatbot/` (MUI client + standalone Express/Gemini service) | Unwired duplicate; in-memory sessions; fabricated fallback answers; missing declared dependencies | `server/src/services/ai/*` + `/api/v1/chat` + `client/src/pages/ChatPage.jsx` |
| `functions/` (Firebase Functions scaffold) | Exported no triggers; `package.json` did not even declare `firebase-functions` | Express API |
| `firebase.json`, `firestore.rules`, `firestore.indexes.json` | Configuration for a backend that is no longer used; two different project ids referenced | MongoDB + Mongoose models and indexes |
| `mythology-app` (gitlink without `.gitmodules`) | Broken submodule — clone produced an empty directory | Nothing to migrate (directory was empty upstream) |
| `docs/database-guide.md`, `docs/sharing-guide.md` | Documented `localStorage` as the database and a hand-off workflow | `docs/DATABASE_SCHEMA.md`, `docs/DEPLOYMENT.md` |

All removed code remains available in git history (`git log --all -- src/`).

## What was preserved

- Brand, tone and visual identity (calm/spiritual but professional) → new design system in
  `client/src/styles/index.css` + `client/tailwind.config.js`.
- Board taxonomy and board guidelines → `server/src/data/boards.seed.js`, served by `/api/v1/boards`.
- Crisis and community-guidelines copy → `client/src/pages/CrisisPage.jsx`,
  `client/src/pages/GuidelinesPage.jsx`, `client/src/pages/ResourcesPage.jsx` (rewritten for accuracy;
  US-only numbers replaced by region-aware, verified helplines).
- The breathing exercise concept → rebuilt accessibly in `client/src/components/crisis/`.
- The "anonymous by default" product principle → first-class server-side anonymous sessions.

## Data migration (if you actually have prototype data)

The v1 prototype stored everything per-browser, so a real migration only matters if you collected
data from users of a deployed prototype. The shape it used:

```js
localStorage['mh_chan_threads'] // [ { id, subject, preview, content, boardId, timestamp,
                                //     replyCount, lastReply, hasContentWarning, anonymous, tags, posts: [...] } ]
```

Mapping to the v2 API:

| v1 field | v2 field |
|---|---|
| `subject` | `Thread.title` (fallback: first 80 chars of `content`) |
| `content` | `Thread.body` |
| `boardId` | `Board.slug` (must exist in the seeded board list) |
| `posts[]` | one `Reply` document each (`thread` ref, `authorType:'anonymous'`, generated alias) |
| `hasContentWarning` | `Thread.contentWarning` / `Reply.contentWarning` |
| `tags` | `Thread.tags` (lowercase, max 6) |
| `anonymous: true` | `authorType:'anonymous'` (author identity is regenerated; original browser ids are not imported) |
| `timestamp` | `createdAt` (import time may be preserved explicitly) |

Because identities in v1 were unverifiable browser-generated ids, they cannot be carried over as
owners. Imported content is attributed to a synthetic migration session with alias `Archive`, and
users must re-claim nothing (there is no account requirement).

Recommended procedure:

1. Export from each browser that holds data:
   `JSON.parse(localStorage.getItem('mh_chan_threads'))` → save as `prototype-threads.json`.
2. Review the file for personal data users may have included. **Delete anything that identifies a
   person** (the v1 guidelines asked users not to post it, but it happened).
3. Write a one-off import script (outside the repo) that inserts `Board`, `Thread` and `Reply`
   documents through the Mongoose models (so validation, sanitisation and indexes apply). Run it
   against a staging database first.
4. Verify counts and spot-check rendering, then run the normal `npm run seed` to ensure boards exist.
5. Do **not** import `crisis_events` from `localStorage`: it contains session ids/URLs and is
   personal telemetry. Delete it rather than migrate it — v2 deliberately stores no crisis content.

## Behaviour changes users will notice

- Forum data is now shared across devices and users (this was the core product bug).
- There is an explicit **AI disclosure** in the chat: an AI companion, not a therapist, and no
  guaranteed monitoring.
- AI failures now surface an error with retry and crisis resources instead of an invented reply.
- Crisis support shows verified helplines for the selected region and is always reachable manually.
- Reporting content, moderation, notifications, search, pagination and preferences now exist.
- A "Delete my account and content" path exists (data deletion was impossible in v1).
- Accounts are optional and only needed for moderation/continuity; anonymous use remains the default.
