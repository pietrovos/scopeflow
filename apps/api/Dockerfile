# syntax=docker/dockerfile:1.7
FROM node:24-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable && apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /repo

FROM base AS build
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm --filter @scopeflow/shared build && pnpm --filter @scopeflow/api build
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
  pnpm deploy --filter @scopeflow/api --prod --legacy /out

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out ./
USER node
EXPOSE 4100
# Migrations run as the schema owner (DATABASE_OWNER_URL) before the server starts.
# On ECS this is a separate one-off task; see infra/aws/README.md.
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node dist/main.js"]
