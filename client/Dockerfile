# syntax=docker/dockerfile:1.7
# =============================================================================
# AdiYogi web image (Vite SPA served by nginx)
#
# Build (from the repository root — required because npm workspaces need the
# root manifest + lockfile):
#   docker build -f client/Dockerfile -t adiyogi-web .
#
# The SPA is built with a RELATIVE API base ("/api/v1" — the default in
# client/src/api/client.js when VITE_API_BASE_URL is unset). nginx proxies
# /api/ to the API, so from the browser's point of view the API is same-origin:
# cookies stay first-party and SameSite=Lax is sufficient.
#
# To point the image at an external API origin instead (no nginx proxy), build
# with --build-arg VITE_API_BASE_URL=https://api.example.com/api/v1 and update
# the connect-src in client/nginx.conf accordingly. For the Vercel deployment
# this is configured in vercel.json + the Vercel project env, not here.
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1 — build the SPA
#
# Only the manifests are copied before `npm ci`, so the dependency layer is
# cached until a package.json/lockfile changes. `--workspace client` installs the
# client workspace (vite, tailwind, react, ...) and skips the root devDependency
# (concurrently). The API workspace manifest is copied only because npm
# workspaces require every workspace manifest to exist.
# Verified locally: `npm ci --workspace client --dry-run` -> added 430 packages,
# root devDependency absent, vite binary present (see docs/DEPLOYMENT.md).
# -----------------------------------------------------------------------------
FROM node:20-alpine AS build

WORKDIR /app

ENV NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false

COPY package.json package-lock.json ./
COPY server/package.json ./server/
COPY client/package.json ./client/

RUN npm ci --workspace client

# Vite source (node_modules is excluded by .dockerignore, so the install above
# is preserved).
COPY client ./client

# Build-time config. Anything VITE_* is PUBLIC: it is inlined into the JS bundle.
# Never pass a secret here.
ARG VITE_API_BASE_URL=
ARG VITE_APP_NAME=AdiYogi
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL} \
    VITE_APP_NAME=${VITE_APP_NAME}

RUN npm run build --workspace client

# -----------------------------------------------------------------------------
# Stage 2 — serve the static build
#
# The official nginx image's entrypoint runs envsubst over
# /etc/nginx/templates/*.template and only substitutes variables that exist in
# the container environment, so ${API_UPSTREAM} is replaced while nginx runtime
# variables ($uri, $host, ...) are left alone. API_UPSTREAM must be the full
# origin, including scheme.
# -----------------------------------------------------------------------------
FROM nginx:alpine AS runtime

# Default matches docker-compose.yml (service name "api", container port 4000).
# Override for an external API origin, e.g.
#   -e API_UPSTREAM=https://api.example.com
ENV API_UPSTREAM=http://api:4000

# Site config (SPA fallback, /api proxy, gzip, cache + security headers, /healthz).
COPY client/nginx.conf /etc/nginx/templates/default.conf.template

COPY --from=build /app/client/dist /usr/share/nginx/html

EXPOSE 80

# Uses busybox wget from the alpine base — no extra packages needed.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
