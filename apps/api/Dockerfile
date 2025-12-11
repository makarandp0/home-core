# syntax=docker/dockerfile:1

# Build stage: install deps and build all workspaces
FROM node:22-bookworm-slim AS builder
ENV NODE_ENV=development
WORKDIR /app

# Enable pnpm via Corepack and pin version from repo
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

# Copy workspace manifests first for better caching
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY packages ./packages
COPY apps ./apps

# Install dependencies (with dev deps for build) and build API + Web
RUN pnpm install --frozen-lockfile
RUN pnpm build


# Runtime stage: install only API production deps and run compiled server
FROM node:22-bookworm-slim AS runner
ENV NODE_ENV=production
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

# Provide minimal workspace context to install only API runtime deps
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
# Include runtime workspace dependency manifests so pnpm can resolve them
COPY --from=builder /app/packages/types/package.json ./packages/types/package.json

# Install only production dependencies for the API workspace (resolves workspaces)
RUN pnpm install --frozen-lockfile --prod --filter @home/api...

# Copy built artifacts for API, its workspace deps, and Web (for static serving)
COPY --from=builder /app/packages/types/dist ./packages/types/dist
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/web/dist ./apps/web/dist
# Enable static serving by default
ENV SERVE_STATIC=true

# Expose and set default port (Railway will provide PORT)
EXPOSE 3001
ENV PORT=3001

# Start the compiled server
CMD ["node", "apps/api/dist/index.js"]
