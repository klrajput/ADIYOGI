# Orchestrator verification harness

These are the end-to-end smoke harnesses used by the integration manager to verify the *running*
system (not just unit behaviour) before merging. They start a real MongoDB (`mongodb-memory-server`),
boot the real Express app or the real `server/src/server.js` entry point, and drive it over real
HTTP with a cookie jar — including CSRF, cookies and the production env path.

Run from the repository root:

```bash
node scripts/verification/boot-check.js        # production entry point: boot, seed, health, cookies, SIGTERM
node scripts/verification/integration-check.js # 58-check full product journey over HTTP
node scripts/verification/reload-check.js      # cross-origin page-reload + CSRF bootstrap flow
```

They are intentionally outside the Jest/Vitest suites: they double-check the assembled system and the
production configuration path. The automated suites in `server/tests/**`, `client/src/__tests__/**`
and `e2e/journey.mjs` remain the primary regression protection. No real secrets are used — the values
are throwaway test credentials set inside each script.
