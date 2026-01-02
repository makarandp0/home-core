# syntax=docker/dockerfile:1

# Build stage: install deps and build all workspaces
FROM node:22-bookworm-slim AS builder
ARG COMMIT_SHA
ARG RAILWAY_GIT_COMMIT_SHA
ENV COMMIT_SHA=${COMMIT_SHA:-${RAILWAY_GIT_COMMIT_SHA}}
ENV VITE_COMMIT_SHA=${COMMIT_SHA}

# Firebase/auth config for frontend build (Vite inlines VITE_* at build time)
ARG VITE_AUTH_ENABLED
ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_APP_ID
ENV VITE_AUTH_ENABLED=${VITE_AUTH_ENABLED}
ENV VITE_FIREBASE_API_KEY=${VITE_FIREBASE_API_KEY}
ENV VITE_FIREBASE_AUTH_DOMAIN=${VITE_FIREBASE_AUTH_DOMAIN}
ENV VITE_FIREBASE_PROJECT_ID=${VITE_FIREBASE_PROJECT_ID}
ENV VITE_FIREBASE_APP_ID=${VITE_FIREBASE_APP_ID}

ENV NODE_ENV=development
WORKDIR /app

# Enable pnpm via Corepack and pin version from repo
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

# Copy only package manifests first for better dependency caching
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY packages/db/package.json ./packages/db/
COPY packages/tailwind-config/package.json ./packages/tailwind-config/
COPY packages/tsconfig/package.json ./packages/tsconfig/
COPY packages/types/package.json ./packages/types/
COPY packages/utils/package.json ./packages/utils/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/

# Install dependencies (cached unless package.json files change)
RUN pnpm install --frozen-lockfile

# Now copy source code and build
COPY packages ./packages
COPY apps ./apps
RUN pnpm build


# Runtime stage: install only API production deps and run compiled server
FROM node:22-bookworm-slim AS runner
ARG COMMIT_SHA
ARG RAILWAY_GIT_COMMIT_SHA
ENV COMMIT_SHA=${COMMIT_SHA:-${RAILWAY_GIT_COMMIT_SHA}}
ENV NODE_ENV=production
WORKDIR /app

# Install utility tools for debugging
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    procps \
    net-tools \
    lsof \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

# Provide minimal workspace context to install only API runtime deps
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
# Include runtime workspace dependency manifests so pnpm can resolve them
COPY --from=builder /app/packages/types/package.json ./packages/types/package.json
COPY --from=builder /app/packages/db/package.json ./packages/db/package.json

# Install only production dependencies for the API workspace (resolves workspaces)
RUN pnpm install --frozen-lockfile --prod --filter @home/api...

# Copy built artifacts for API, its workspace deps, and Web (for static serving)
COPY --from=builder /app/packages/types/dist ./packages/types/dist
COPY --from=builder /app/packages/db/dist ./packages/db/dist
COPY --from=builder /app/packages/db/migrations ./packages/db/migrations
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/web/dist ./apps/web/dist
# Enable static serving by default
ENV SERVE_STATIC=true

# Expose and set default port (Railway will provide PORT)
EXPOSE 3001
ENV PORT=3001

# Start the compiled server
CMD ["node", "apps/api/dist/index.js"]
