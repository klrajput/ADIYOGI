# syntax=docker/dockerfile:1.7
# =============================================================================
# AdiYogi API image (Express + Mongoose modular monolith)
#
# Multi-stage build:
#   1. "deps"    — node:20-alpine, installs ONLY the API workspace's production
#                  dependencies (no client packages, no dev dependencies).
#   2. "runtime" — node:20-alpine, non-root user, production env, healthcheck.
#
# The client SPA has its own image: client/Dockerfile (nginx).
#
# Build (from the repository root, which is also the npm-workspaces root):
#   docker build -t adiyogi-api .
#
# Run (secrets are injected at runtime, never baked into the image):
#   docker run --init --rm -p 4000:4000 --env-file .env adiyogi-api
#
# PID 1: node runs as PID 1 and server/src/server.js installs SIGTERM/SIGINT
# handlers that close the HTTP server and disconnect Mongoose before exiting
# (force-exit after 15s). The application spawns no child processes, so no zombie
# reaping is needed. For an external init on compose, `init: true` is set in
# docker-compose.yml (Docker's built-in tini); on Render, the platform sends
# SIGTERM to PID 1, which node handles. If you prefer a bundled init, add
# `RUN apk add --no-cache tini` (Alpine *community* repo) and
# ENTRYPOINT ["/sbin/tini", "--"] — deliberately not used here so the image build
# has exactly one external dependency (the npm registry).
#
# The container boots with NODE_ENV=production, so server/src/config/env.js
# refuses to start unless JWT_SECRET, SESSION_SECRET, MONGODB_URI and a
# non-localhost CLIENT_URL are provided (fail-fast by design).
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1 — dependency installation
#
# npm workspaces require the workspace manifests to be present before an install,
# so the root manifest + lockfile + both workspace manifests are copied first.
# Copying the manifests (not the sources) keeps this layer cacheable: it is only
# rebuilt when a package.json or the lockfile changes.
#
# `--workspace server` scopes the install to the API workspace; `--omit=dev`
# drops jest/eslint/nodemon/mongodb-memory-server/supertest; `--include-workspace-root`
# keeps the root manifest in the dependency graph. Verified locally:
#   npm ci --omit=dev --workspace server --include-workspace-root --dry-run
#   -> added 154 packages, no client/dev packages (see docs/DEPLOYMENT.md).
# -----------------------------------------------------------------------------
FROM node:20-alpine AS deps

WORKDIR /app

# Keep npm quiet/non-interactive in CI and image builds.
ENV NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false

COPY package.json package-lock.json ./
COPY server/package.json ./server/
COPY client/package.json ./client/

RUN npm ci --omit=dev --workspace server --include-workspace-root

# -----------------------------------------------------------------------------
# Stage 2 — runtime
# -----------------------------------------------------------------------------
FROM node:20-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production \
    PORT=4000 \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false

# Production node_modules from the deps stage (hoisted root node_modules plus any
# workspace-local node_modules that npm decided not to hoist).
COPY --from=deps /app/node_modules ./node_modules

# Application code. `server/package.json` must be present: config/env.js reads the
# version from it; the root package.json is kept for workspace metadata.
COPY --chown=node:node server ./server
COPY --chown=node:node package.json ./package.json

# Drop privileges: the official node image ships a `node` user (uid 1000).
USER node

EXPOSE 4000

# Liveness probe. Matches GET /health (no DB dependency, so a slow Mongo does not
# flap the container). Uses Node's built-in fetch — curl/wget are not installed.
HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 4000) + '/health').then(function (r) { process.exit(r.ok ? 0 : 1); }).catch(function () { process.exit(1); })"

# Node is PID 1. server/src/server.js owns the SIGTERM/SIGINT graceful-shutdown
# path (see the image header); `docker run --init` or compose `init: true` adds an
# external reaper when one is desired.
CMD ["node", "server/src/server.js"]
