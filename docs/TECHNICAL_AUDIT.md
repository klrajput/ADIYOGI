# AdiYogi — Technical Audit

**Audit date:** 2026-04-?? (repository snapshot: `main` @ `d1036e9`)
**Auditor:** Principal Engineer (orchestrator)
**Scope:** every tracked file in `klrajput/ADIYOGI` (`git ls-files` → 116 files), plus `package.json`, `.env`, `.gitignore`, and the built `node_modules` state.

> This document describes what the repository **actually contains**, verified by reading the
> source and by running the production build and dependency audit. It intentionally does not
> repeat the README's claims, which disagree with the code in several important places.

---

## 1. Executive summary

AdiYogi is currently **a front-end prototype with three unrelated, partially-wired sub-projects
attached to it**. There is no backend of record: the "community forum" persists to
`localStorage`, the "AI chatbot" is a hard-coded keyword-reply table that never calls any AI
provider, and the "crisis detection" is a client-side keyword matcher that writes crisis
metadata into `localStorage`.

| Dimension | Claimed (README) | Actual |
|---|---|---|
| Backend | "Firebase backend — real-time DB, auth, cloud functions" | Firebase SDK initialised with **placeholder credentials**; never used by the app. `functions/` contains only the untouched Firebase scaffold and its `package.json` is a copy of a React app manifest (no `firebase-functions` dependency). |
| Database | "Firebase Backend / Firestore" | Forum data lives in `localStorage` (`mh_chan_threads`). No Firestore call exists anywhere in `src/`. |
| Authentication | "Secure authentication" | `useAuth()` generates `'anon_' + Date.now() + '_' + Math.random()` **in the browser**, stores it in `localStorage`. No server, no signing, no verification, no ownership enforcement. |
| AI chatbot | "Context-aware mental health support powered by NLP" | `src/components/Common/Chatbot.js`: a `responses` object of regex/keyword matches with randomised canned replies. `setTimeout(900–1500ms)` fakes "thinking". **Zero network calls.** |
| Crisis detection | "Automated flagging of distress signals" | `src/utils/crisisDetection.js`: substring matching over 3 word lists, writes `{sessionId, level, url}` to `localStorage.crisis_events`. Fires on every keystroke (debounced) with no negation/context handling. |
| Chatbot service | Present in repo | `chatbot/packages/phase1-chatbot-service` **does** have a real Gemini integration, but it is a **standalone, unwired package**: the React app never calls it, it has no persistence (in-memory `Map`), two of its service files are **empty**, and it depends on packages that are not declared (`mongoose`, `winston`, `redis`, `axios`). |
| Tests | present | Only `chatbot/packages/client/src/App.test.js` (CRA boilerplate) and unused CRA `scripts/test.js` exist. **There are zero tests for the actual application.** |
| Deployment | "Firebase deploy" | `firebase.json` + `firestore.rules` exist, but the app cannot work when deployed because it needs no backend — and the Firebase project referenced in `community-forum/firebase-config.js` is a **different** project (`adiyogi-4ffe4`). No CI, no Docker, no `.env.example`. |

**Verdict:** not production-ready in any dimension. The UI and the crisis/guidelines content
are worth preserving; the data layer, auth, chatbot and crisis engine must be rebuilt.

---

## 2. Existing architecture (as found)

```
ADIYOGI/
├── package.json              # CRA-style app, but react-scripts is VENDORED (config/ + scripts/)
├── src/                      # React 18 SPA (the only real application)
│   ├── App.js                # Router, crisis monitor boot, ErrorBoundary, Chatbot
│   ├── components/           # Board/, Thread/, Layout/, Common/
│   ├── pages/                # Home, Board, Thread, Crisis, Guidelines, Database, NotFound
│   ├── utils/
│   │   ├── forumStore.js     # localStorage "database" + 2 hard-coded threads
│   │   ├── forumAdmin.js     # localStorage admin console (window.forumAdmin)
│   │   └── crisisDetection.js# keyword matcher + DOM-injected modal
│   ├── hooks/useAuth.js      # fake anonymous session (localStorage)
│   ├── firebase/config.js    # initialised with placeholders, imported nowhere
│   └── styles/               # 6 CSS files, ~2,860 lines, 2 competing themes
├── config/, scripts/         # vendored copy of react-scripts 5 (webpack dev server, build, test)
├── public/                   # index.html, crisis-resources.json, manifest
├── community-forum/          # SEPARATE vanilla-JS Firebase forum (own index.html/app.js/styles.css)
├── chatbot/                  # SEPARATE npm workspace: MUI client + Express/Gemini service
├── functions/                # Firebase Functions scaffold (empty, mis-declared package.json)
├── firebase.json, firestore.rules, firestore.indexes.json
├── mythology-app             # gitlink (mode 160000) to a submodule with NO .gitmodules → broken clone
└── docs/                     # 2 guides describing localStorage/Firebase usage
```

### 2.1 Technology stack actually present

| Layer | Technology | Version | Notes |
|---|---|---|---|
| UI | React | 18.2.0 | JS (not TS), no state library |
| Routing | react-router-dom | 6.3.0 | 7 routes |
| Styling | hand-written CSS | — | 6 global files, CSS variables, no Tailwind despite dependency |
| Build | vendored react-scripts 5 | webpack 5 | `scripts/` + `config/` copied; `react-scripts` **not** in deps |
| Persistence | `localStorage` | — | `mh_chan_threads`, `mh_chan_session`, `crisis_events` |
| Firebase | firebase 9.9.0 | — | placeholder config, unused |
| Chatbot service | Express 4 + `@google/generative-ai` | 0.17.1 | separate package, unwired, no persistence |
| Serverless | firebase-functions (none declared) | — | scaffold only |
| Tooling | playwright? no · eslint (CRA config) | — | no prettier, no CI |

### 2.2 Current feature inventory and status

| # | Feature | Exists | Works | Connected to backend | Persists | Production-ready |
|---|---|---|---|---|---|---|
| F1 | Landing page / hero / stats | ✅ | ✅ | n/a | n/a | ❌ (fake stats, fake "live activity") |
| F2 | Board list & board pages | ✅ | ✅ | ❌ | ❌ | ❌ |
| F3 | Create thread | ✅ (UI) | ⚠️ client-only | ❌ | `localStorage` only | ❌ |
| F4 | View thread | ✅ | ⚠️ only own browser | ❌ | `localStorage` only | ❌ |
| F5 | Reply to thread | ✅ (UI) | ⚠️ client-only | ❌ | `localStorage` only | ❌ |
| F6 | Search | ⚠️ only in `/admin/database` console | ⚠️ | ❌ | ❌ | ❌ |
| F7 | Filtering / sorting | ⚠️ sort only (Recent/New/Most replies), client array sort | ⚠️ | ❌ | ❌ | ❌ |
| F8 | Pagination | ❌ | ❌ | ❌ | ❌ | ❌ |
| F9 | Tags | ⚠️ rendered, never assigned by users | ❌ | ❌ | ❌ | ❌ |
| F10 | Content warnings | ⚠️ toggle exists, only shown in thread list | ⚠️ | ❌ | ❌ | ❌ |
| F11 | Report content | ❌ button is a no-op (`onClick` absent) | ❌ | ❌ | ❌ | ❌ |
| F12 | Moderation | ❌ (`window.forumAdmin` console hacks only) | ❌ | ❌ | ❌ | ❌ |
| F13 | Anonymous identity | ⚠️ browser-generated id, never displayed | ⚠️ | ❌ | localStorage | ❌ |
| F14 | AI chatbot | ⚠️ rule-based mock only | ⚠️ | ❌ | ❌ | ❌ |
| F15 | Conversation persistence | ❌ | ❌ | ❌ | ❌ | ❌ |
| F16 | Crisis keyword detection | ⚠️ naive substring | ⚠️ | ❌ | localStorage | ❌ |
| F17 | Crisis resources page | ✅ content is genuinely useful | ✅ | n/a | n/a | ⚠️ US-only numbers, but hard-coded copy-paste in 4 places |
| F18 | Location-aware helplines | ❌ | ❌ | ❌ | ❌ | ❌ |
| F19 | Breathing exercise | ✅ | ✅ (interval chain leaks timers) | n/a | n/a | ⚠️ |
| F20 | Wellness resources | ⚠️ links only, no content pages | ⚠️ | ❌ | ❌ | ❌ |
| F21 | User preferences | ⚠️ `mh_chan_preferences` written, **never read by any UI** | ❌ | ❌ | localStorage | ❌ |
| F22 | Auth (register/login/logout) | ❌ | ❌ | ❌ | ❌ | ❌ |
| F23 | Notifications | ❌ | ❌ | ❌ | ❌ | ❌ |
| F24 | Admin DB dashboard | ⚠️ `/admin/database` is unauthenticated and edits localStorage | ✅ locally | ❌ | localStorage | ❌ (security) |
| F25 | Standalone `community-forum/` | ✅ separate app | ⚠️ needs a real Firebase project | Firebase (other project) | Firestore | ❌ duplicate product |
| F26 | `chatbot/` service | ✅ separate service | ⚠️ needs `GEMINI_API_KEY`; missing deps → won't boot | n/a | in-memory | ❌ unwired |
| F27 | Firebase Cloud Functions | ❌ scaffold only | ❌ | ❌ | ❌ | ❌ |
| F28 | `mythology-app/` | ❌ **empty/broken submodule** | ❌ | ❌ | ❌ | ❌ |

---

## 3. Critical bugs (verified)

1. **The app has no multi-user data layer.** Threads and replies written by one visitor are
   invisible to every other visitor and to every other browser/device. This defeats the entire
   product premise ("community forum"). Root cause: `src/utils/forumStore.js`.
2. **`/admin/database` executes destructive data operations from an unauthenticated route.**
   Any visitor can open `/admin/database` and clear/import/overwrite the "database"
   (`forumAdmin.clearAll`, `importData`) — and because it is global, it also overwrites data
   created by *other tabs* of the same browser. In a real multi-user system the equivalent
   endpoint would be a P0 broken-access-control incident.
3. **`src/components/Common/Chatbot.js` does not call an AI provider at all.** README, landing
   page and guidelines all promise AI support. It is a keyword table. It also claims
   "AI-Moderated Safety" which does not exist.
4. **`useAuth` fabricates identity.** `Math.random()` + `Date.now()` is not a credential; there
   is no server-side session, so any "ownership" check would be trivially forgeable. Cannot be
   extended into real moderation/authorization.
5. **XSS sink:** `Chatbot.js` renders bot text with `dangerouslySetInnerHTML` after an ad-hoc
   regex "formatter" (`formatMessage`). Content currently comes from a local constant, so the
   exposure is latent — but the pattern is one provider/echo change away from stored XSS.
6. **Crisis modal is injected via `document.createElement` + `innerHTML`** from
   `crisisDetection.js`, outside React, with an inline `onclick` handler. It can stack multiple
   modals (no singleton guard), and `crisisCallback(true, level)` re-renders `CrisisAlert` on
   every keystroke containing a keyword (e.g. typing "anxious" in any textarea).
7. **Crisis events leak into `localStorage`** including `sessionId` and the page URL, with no
   user control or deletion path. Sensitive mental-health telemetry stored in a browser
   datastore is a privacy defect.
8. **Keyword matcher has false positives/negatives by construction.** `'alone'` and `'anxiety
   attack'` are "warning", `'depressed'` triggers level 2, `"I'm not suicidal"` triggers level 3.
   This is presented to the user as detection.
9. **`firebase/config.js` calls `initializeApp` at import time with `undefined` credentials**
   (the `.env` contains literal `your_...` placeholders). It survives only because nothing
   imports it; the moment a component imports it, Firebase throws
   `auth/invalid-api-key`.
10. **`functions/package.json` declares React/MUI deps and `react-scripts` scripts but not
    `firebase-functions`**, so `firebase deploy` fails. `functions/src/index.ts` compiles to an
    empty module (no exported trigger).
11. **`mythology-app` is a gitlink without `.gitmodules`** → `git clone` leaves an empty
    directory; `git submodule update --init` fails. README documents a rich app under
    `mythology-app/src/` and `mythology-app/server/` that does not exist in the repository.
12. **`chatbot/packages/phase1-chatbot-service` cannot boot from a clean clone.**
    `src/config/database.js` requires `mongoose`, `src/utils/logger.js` requires `winston`,
    `src/services/reddit.service.js` requires `axios`, `src/config/redis.js` requires `redis`
    — none are in that package's `package.json` (and the declared deps include
    `express-rate-limit@^8` which needs Node ≥ 16; the package also has **no test despite
    `"test": "jest"`**).
13. **Two empty files presented as services:** `chatbot/.../services/chatbot-orchestrator.service.js`
    and `alternative-chatbot.service.js` are 0 bytes.
14. **`server.js` graceful shutdown calls `process.exit(0)` immediately** without closing the
    HTTP server, DB or Redis — it is not graceful.
15. **In-memory conversation store** in `chat.routes.js` (`Map`): lost on restart, unbounded
    until trimmed to 20 messages, shared-process, no per-user isolation beyond a client-supplied
    `sessionId` (IDOR: any client can read another's history by guessing/replaying a sessionId
    — the id is only required to be truthy).
16. **`community-forum/firebase-config.js` commits project credentials** (`apiKey`,
    `messagingSenderId`, `appId`, project `adiyogi-4ffe4`) to a public repository. Firebase web
    API keys are not secrets by themselves, but committing them is a hygiene failure and the
    key should be rotated/restricted; it also proves the single-project claim is false.
17. **`postinstall`-free but vendored CRA:** `config/` + `scripts/` are ~2,000 lines of copied
    `react-scripts` that will silently drift from the webpack plugins in `package.json`.
18. **`crisisDetection` debounces with `target.crisisTimeout`** (expando on DOM node) and
    re-registers a `document` `input` listener on every `initialize` call; `isInitialized` is
    module-global so hot reload in dev leaves stale listeners.
19. **The same crisis copy is duplicated in ≥6 places** (`Header`, `Footer`, `CrisisAlert`,
    `CrisisPage`, `GuidelinesPage`, `NotFoundPage`, `PostForm`, `BoardHeader`) — every content
    update requires 6 edits; helplines are already inconsistent (`public/crisis-resources.json`
    lists the retired `1-800-273-8255` alongside 988).
20. **`BoardList` duplicates `src/data/boards.json`** and invents engagement numbers
    (`1,247 threads`, `23 active`) that are not derived from anything. Home page shows
    `50K+ posts / 10K+ members` and a "Live" activity ticker with four hard-coded rows.

---

## 4. Security & privacy findings

> Severity: **P0** = exploitable/user-harmful now, **P1** = must fix before any public deploy,
> **P2** = should fix, **P3** = hygiene.

| ID | Severity | Finding | Evidence | Impact |
|---|---|---|---|---|
| S1 | **P0** | No server-side authorization exists at all; the only "admin" surface is an unauthenticated page that can wipe data | `src/pages/DatabasePage.js`, `src/utils/forumAdmin.js` | Anyone can destroy/reset forum state; no moderation authority possible |
| S2 | **P0** | Identity is client-generated and unverifiable → no ownership, no abuse prevention, no moderation | `src/hooks/useAuth.js:14-22` | Impersonation, spam, untraceable abuse; can't implement "authorized to hide/remove" |
| S3 | **P1** | Sensitive crisis telemetry persisted in `localStorage` with session id + URL | `src/utils/crisisDetection.js:139-155` | Mental-health data readable by any same-origin XSS or anyone with device access; no deletion |
| S4 | **P1** | No XSS-safe rendering strategy for rich text; `dangerouslySetInnerHTML` used | `src/components/Common/Chatbot.js:118-130, 355` | Latent stored/reflected XSS as soon as content becomes user- or provider-generated |
| S5 | **P1** | No input validation/sanitization on the server side (there is no server) — `DOMPurify` is used only on create path, not on read/render | `src/components/Thread/PostForm.js:26` vs `ThreadView` raw render | Stored HTML/script injection is possible via `localStorage` import; inconsistent sanitization |
| S6 | **P1** | Chatbot service exposes `/api/chat/message` with **no auth**, no per-user rate limit on the AI call (only a global 100 req/15 min), and `sessionId`-only isolation | `chatbot/.../chat.routes.js` | Anonymous cost/abuse of AI quota; cross-session conversation access (IDOR) |
| S7 | **P1** | Committed Firebase project identifiers | `community-forum/firebase-config.js` | Credential hygiene; project enumeration; quota abuse |
| S8 | **P1** | No HTTP security headers in the actual app (no Helmet, no CSP); only the unwired chatbot service uses Helmet | root app has no server | Clickjacking, MIME sniffing, no CSP for a health-data app |
| S9 | **P1** | No CSRF strategy; `localStorage` sessions + no cookies today means there is nothing to protect — but the planned cookie-based auth **must** ship with CSRF protection | architecture gap | Future foot-gun |
| S10 | **P2** | No rate limiting on forum writes, reports, or chat in the main app | n/a (no API) | Spam/brigading, AI cost abuse |
| S11 | **P2** | No audit logging of moderation actions or admin data operations | `forumAdmin.js` uses `console.log` only | No accountability for content hiding/removal |
| S12 | **P2** | No data-retention or deletion mechanism for forum content, conversations, crisis events | — | Privacy obligations unmet |
| S13 | **P2** | `.env` in working tree contains placeholders (fine) but no `.env.example` exists; `community-forum` hard-codes config instead of env | root, `community-forum/firebase-config.js` | Onboarding risk → developers commit real keys |
| S14 | **P2** | Dependency vulnerabilities: `npm audit` → **71 vulnerabilities (17 low, 15 moderate, 35 high, 4 critical)** in the installed tree (webpack/CRA toolchain, `firebase@9`, `dompurify`, dev-server) | `npm audit` output | Supply-chain risk, especially the dev server |
| S15 | **P3** | No `helmet`/CSP/HTTPS/CORS configuration documented; no `SECURITY.md`, no vulnerability disclosure path | — | Ops hygiene |
| S16 | **P3** | Session/preferences keys are un-namespaced relative to product (`mh_chan_*`, leftover from the predecessor product name) | `useAuth.js`, `forumStore.js` | Confusion, collisions |

**Privacy assessment (mental-health data):** the platform collects content that may contain
suicidal ideation, trauma disclosure and substance use. Today that content is stored unencrypted
in browser storage with a fake session id; nothing is ever deleted; crisis events are silently
logged. A real deployment requires: no IP logging, no analytics of chat content, explicit AI
disclosure, retention limits, per-user deletion, and crisis events that never store message text.
None of that exists.

---

## 5. Frontend problems

| ID | Prio | Problem |
|---|---|---|
| F-1 | P1 | **Three competing design systems** in CSS: `index.css` (1,303 lines), `chan-theme.css` + `chan-theme-professional.css` (160 + 457), `index-professional.css` / `responsive*.css` are never imported. Two visual languages coexist (dark "chan" board + premium marketing sections). |
| F-2 | P1 | Inline `style={{…}}` used pervasively (hundreds of objects, e.g. `BoardHeader`, `CrisisPage`, `Chatbot`, `Footer`); no tokens enforced, so theming/dark-mode is impossible. |
| F-3 | P1 | No loading skeletons (a fake 300 ms `setTimeout` "loading" spinner is used to *simulate* latency in `ThreadList` / `ThreadView`). |
| F-4 | P1 | Error handling is inconsistent: `PostForm` swallows errors into `console.error`, `ThreadView` has a bespoke not-found block, `App` has an `ErrorBoundary`, and the chatbot can never fail because it never calls anything. No toast usage on failures despite `react-hot-toast` being installed. |
| F-5 | P1 | Empty states exist only for thread list; boards/search/replies/chat have none. |
| F-6 | P1 | Accessibility: emoji-only buttons (`🚩 Report` has no `aria-label`), `<div onClick>` used as a button (`CrisisPage` breathing circle), no focus-visible styling, colour contrast of `--text-tertiary` on dark glass is below WCAG AA in several places, no skip-link, no `lang` management, icon-only controls in the chat (no accessible names beyond two). |
| F-7 | P2 | Responsive layout relies on fixed pixel widths in inline styles (e.g. `width: 380px` chat, 2-column grids in `CrisisPage`/`GuidelinesPage` that do not collapse). Modal drawer has no focus trap or Escape handling. |
| F-8 | P2 | Fake data everywhere: hero stats, "Live" activity, board thread/post counts, `Math.random()` reply delays. |
| F-9 | P2 | The "Report" buttons and the three reaction buttons ("❤️ Support", "🤝 Relate", "🕊️ Heal") are **decorative no-ops** presented as features. |
| F-10 | P2 | `Chatbot` is a 400-line component with inline styles; no conversation persistence, no retry, no error state, no disclosure that it is not a clinician, no rate limit, no markdown renderer (regex HTML). |
| F-11 | P3 | Copy still says "Mental Health Chan", "Smart India Hackathon 2024", "50K+ posts"; meta title in `src/index.js` overrides the good `public/index.html` metadata via `react-helmet`. |
| F-12 | P3 | `Navigation.js` is a `() => null` shim kept "for backward compatibility" — dead component. |

---

## 6. Backend problems

There is no backend for the actual application. The following findings concern the two backend
fragments that exist.

| ID | Prio | Problem |
|---|---|---|
| B-1 | P1 | `chatbot/.../app.js` uses `app.use('*', …)` 404 handler (Express 4 pattern, breaks on Express 5), has no request logging, no request ids, no validation library, no OpenAPI, and returns `{error: string}` instead of a consistent envelope. |
| B-2 | P1 | `chat.routes.js` business logic lives in the route; persistence is a process-local `Map`; risk scoring is duplicated keyword logic. |
| B-3 | P1 | `gemini.service.js` **fabricates a fallback answer whenever the model call fails** (`getFallbackResponse`) and returns HTTP 200. The client cannot distinguish real AI from canned text. Exactly the failure mode this overhaul must remove. |
| B-4 | P2 | No timeouts/retries/backoff on the Gemini call; a hung provider hangs the request (axios 10 s timeout exists only in the unused MUI client). |
| B-5 | P2 | Prompt injection unmitigated: user text is interpolated directly into the prompt with no delimiters/instructions. |
| B-6 | P2 | No graceful DB/Redis shutdown, no connection pooling config, no health/readiness separation. |
| B-7 | P2 | `functions/src/index.ts` exports nothing; `firestore.rules` is a thoughtful draft but cannot be exercised because no app talks to Firestore. |
| B-8 | P3 | No API versioning (`/api/chat` vs `/api/v1/*`), no pagination contract, no idempotency for writes. |

---

## 7. Database problems

| ID | Prio | Problem |
|---|---|---|
| D-1 | **P0** | Primary persistence is `localStorage` — a per-browser key/value store with a ~5 MB quota, no concurrency control, no backup, no cross-device sync, no access control. |
| D-2 | P0 | Data model is a nested array (`threads[].posts[]`) — replies cannot be paginated, sorted independently, moderated individually, or referenced for reports. |
| D-3 | P1 | No schema, no validation, no indexes (there is no database). |
| D-4 | P1 | `forumAdmin.importData` accepts arbitrary JSON arrays and writes them without validation → data corruption + stored XSS vector. |
| D-5 | P1 | No ownership field on threads/replies (only `anonymous: true`), so authorization cannot be added incrementally. |
| D-6 | P2 | No ids that are safe to expose; ids are `thread_<timestamp>_<random>`. |
| D-7 | P2 | No migration path from the localStorage prototype, no seed data for boards, no backup/restore runbook. |
| D-8 | P3 | `firestore.indexes.json` / `firestore.rules` are dead configuration that will confuse operators (`database (default)` in `asia-south2`). |
| D-9 | P3 | Two different Firebase projects referenced (`mental-health-chan-8e78f` in `docs/database-guide.md`, `adiyogi-4ffe4` in `community-forum`). |

---

## 8. UX / IA problems

1. **Broken information architecture:** the home page mixes a marketing hero, a board directory,
   a fake activity feed, and an "Our mission" block; there is no dedicated community dashboard,
   no search entry point, no way back to your own posts, no preferences page (even though
   preferences are stored), no auth screens.
2. **Dead ends:** `/board/crisis` is linked from the footer but exists only as a data entry;
   `/board/resources` likewise; `ThreadView`'s "Report" does nothing; "Reactions" do nothing.
3. **Trust signals that undermine trust:** fabricated counters and a "Live" ticker; a claim of
   "AI-Moderated Safety" with no moderation; the disclaimer "we never log IPs" while the crisis
   module logs URLs and session ids locally.
4. **Crisis UX is both too aggressive and not strong enough:** a modal can pop while you type in
   a post, but there is no calm, persistent, always-reachable crisis affordance with verified
   local helplines (only US numbers), no way to intentionally reach help, and no location
   handling.
5. **No AI disclosure** at the point of chat: "MindBot" presents as a companion; the only
   disclaimer is a 10 px footer line inside the window.
6. **Mobile:** chat window at `380px` width plus `2rem` offsets overflows on ≤400 px viewports;
   crisis page grids do not collapse.
7. **Error states:** a failed post shows nothing; a not-found thread shows a raw message; there
   is no offline state for the app.

---

## 9. Technical debt inventory

| Item | Type | Notes |
|---|---|---|
| Vendored `config/` + `scripts/` (react-scripts 5) | dead-ish code | ~2,000 lines to maintain; upgrade path unclear; should be replaced by Vite |
| Unused dependencies | bloat | `firebase`, `tailwindcss` (installed, never configured), `react-helmet`, `uuid`, `lodash.debounce`, `date-fns`, `@types/*` in a JS project, `sass-loader`, `workbox-webpack-plugin` |
| Duplicate data | bloat | `src/data/boards.json` vs `BoardList.js` board array |
| Duplicate crisis copy | duplication | 8 files hard-code 988/741741/911 |
| Separate sub-products | duplication | `community-forum/` (vanilla + Firestore) and `chatbot/` (MUI + Express) re-implement parts of the same product with different stacks/backends |
| Broken submodule | build break | `mythology-app` |
| `docs/` describes the prototype, not a product | docs | `database-guide.md` documents localStorage as the database; `sharing-guide.md` is a hand-off note |
| No lint/format/CI/type-check | tooling | `eslint` present via CRA only; no prettier; no GitHub Actions |
| No environment management | ops | `.env` placeholders; no `.env.example`; the chatbot service reads `GEMINI_API_KEY` while `.env` has Firebase keys |
| 71 dependency vulns (35 high, 4 critical) | security | toolchain-driven; requires migration off vendored CRA |
| `console.log` "telemetry" | observability | `crisisDetection`, `forumAdmin`, chatbot service |

---

## 10. Missing functionality (required by the product brief)

- Real backend API + MongoDB persistence with cross-device sync
- Server-side anonymous sessions and ownership/authorization (moderator/admin roles)
- AI provider integration on the server with conversation persistence, rate limits, real
  failure handling, and safe mental-health boundaries
- Layered crisis detection (self-report + weighted text signals + AI risk flag), verified
  location-aware helplines, manual "get help now", privacy-preserving event handling
- Moderation queue: report → review → hide/remove, with audit trail and authorization
- Notifications (reply to your thread)
- Preferences UI (display name, content-warning policy, data deletion)
- Search / filtering / sorting / pagination across boards and threads
- Resource library (educational wellness content)
- Automated tests (unit, API integration, component, end-to-end) and CI
- Docker/compose, environment management, health checks, deployment docs
- OpenAPI documentation

---

## 11. Recommended target architecture

A **modular monolith** — one deployable API with clean internal modules — replacing the
prototype and the two side packages. All three persistence mechanisms collapse into MongoDB.

```
Client (React 18 + Vite + Tailwind)  ──HTTPS──▶  API (Node 20 + Express 4, /api/v1)
   • design system, a11y, states                  • auth (anon session + account), CSRF
   • API service layer                           • boards/threads/replies/reports/moderation
   • no domain data in localStorage             • chat (Gemini provider, guarded, persisted)
                                                   • crisis (layered, no content stored)
                                                 • health, OpenAPI, structured logs
                                                        │
                                                 Mongoose ODM
                                                        │
                                            MongoDB Atlas / local Mongo
```

Key decisions (full detail in `docs/ARCHITECTURE.md`):

1. **Auth:** server-issued opaque refresh session (hashed at rest) + short-lived JWT access
   cookie, `httpOnly`+`Secure`+`SameSite=Lax`, double-submit CSRF. Anonymous sessions are a
   first-class identity type (`authorType: 'anon'`) so the forum works with zero PII while still
   being server-authorized. Accounts exist for moderators/admins (and optionally members).
2. **Forum content:** normalized `Thread` + `Reply` collections with owner refs, soft-delete,
   content warnings, tags, pagination, text index for search, and per-IP/per-session rate limits.
3. **AI:** server-only provider adapter (Gemini), never the browser; conversation + messages in
   Mongo with TTL; explicit AI disclosure; on provider failure return a real error (no fabricated
   answers); crisis path bypasses normal prompting and returns resources immediately.
4. **Crisis:** layered scoring (self-report, weighted phrase patterns with negation handling, AI
   risk signal), never labels a user, stores metadata only, serves verified regional helplines
   with a safe international fallback.
5. **Remove** `community-forum/`, `chatbot/`, `functions/`, all Firebase config, vendored CRA,
   `mythology-app`, and `localStorage` persistence after their useful behaviour is reimplemented.

---

## 12. Prioritized roadmap

### P0 — blocks any public use
1. Build the Express + MongoDB API and move all forum reads/writes to it (D-1, D-2, F3–F5, B-8).
2. Implement server-side anonymous sessions + ownership; remove `useAuth` fabrication (S2).
3. Remove unauthenticated destructive data surface; require moderator/admin role for moderation
   (S1, F24).
4. Replace fake AI with a real server-side provider call, with honest failure and AI disclosure
   (F14, B-3, S6).
5. Stop persisting crisis content/session data in `localStorage`; implement privacy-preserving
   crisis events (S3).

### P1 — required before sharing a URL with real users
6. Moderation workflow with reports, actions and audit log (F11, F12, S11).
7. Layered crisis support with verified helplines + manual access; AI safe boundaries (F16–F18).
8. Security baseline: Helmet/CSP, CORS allow-list, rate limits, validation (zod), sanitization,
   consistent error envelope, CSRF (S4–S10).
9. Frontend rebuild on one design system with loading/empty/error/offline states, responsive and
   accessible (F-1…F-12).
10. Tests + CI (unit, API integration with in-memory Mongo, component, E2E) and Docker/deploy
    docs (F/no-tests, S14).
11. Search, filtering, sorting, pagination, notifications, preferences (F6–F10, F21, F23).
12. Data deletion + retention controls (S12).

### P2 — production hardening
13. Structured logging with request ids + PII redaction; health/readiness; graceful shutdown.
14. OpenAPI docs + Swagger UI.
15. Dependency upgrade away from CRA/vendored toolchain (S14).
16. Atlas index tuning, backups, migration scripts.
17. Resource library content (F20), location-aware helplines by country.

### P3 — hygiene
18. Remove duplicate/dead files (`Navigation.js`, `src/data/boards.json` duplication, CRA copy),
    fix naming (`mh_chan_*`), unify metadata, add `SECURITY.md`/`CONTRIBUTING`, dependency
    automation.

---

## 13. Methodology & evidence

- `git ls-files` (116 files) reviewed file-by-file; every `.js/.ts/.json/.md` read in full.
- `npm run build` executed on the snapshot → compiled with 1 ESLint warning
  (`originalPostCount` unused) and produced `build/` (96.68 kB gz JS) — so the prototype *builds*,
  which is why its defects are invisible to a "does it run?" check.
- `npm audit --omit=dev` → 71 vulnerabilities (17 low, 15 moderate, 35 high, 4 critical).
- `cat .env` → only `REACT_APP_FIREBASE_*` placeholders (`your_...`); no real secrets committed
  in `.env` (it is git-ignored), **but** `community-forum/firebase-config.js` commits a real
  Firebase project's public config.
- No `tests/` directory; no `.github/`; no Dockerfile; no `.env.example`.
- Claims in `README.md` cross-checked against code: backend (Firebase), AI chatbot, crisis
  detection, `mythology-app`, `functions/` subfolders, and moderation are all **not implemented
  as described**.

**What is worth preserving:** the calming visual language and copywriting of the crisis and
guidelines pages, the board taxonomy and guidelines text, the breathing exercise interaction,
the AI-disclosure/peer-support framing, and the overall spiritual-but-professional brand.

---

*Continue to `docs/ARCHITECTURE.md` for the target design and `README.md` for the implemented
system.*
