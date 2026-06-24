FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# ─── Development ────────────────────────────────────────────────────────────────
FROM base AS development

ARG APP_NAME

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/${APP_NAME}/package.json ./apps/${APP_NAME}/
COPY packages/config/package.json ./packages/config/
COPY packages/types/package.json ./packages/types/
COPY packages/ui/package.json ./packages/ui/

RUN pnpm install --frozen-lockfile

COPY . .

EXPOSE 3000

CMD ["pnpm", "--filter", "${APP_NAME}", "dev"]

# ─── Builder ────────────────────────────────────────────────────────────────────
FROM base AS builder

ARG APP_NAME
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/${APP_NAME}/package.json ./apps/${APP_NAME}/
COPY packages/config/package.json ./packages/config/
COPY packages/types/package.json ./packages/types/
COPY packages/ui/package.json ./packages/ui/

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm --filter ${APP_NAME} build

# ─── Production ─────────────────────────────────────────────────────────────────
FROM base AS production

ARG APP_NAME
# Store APP_NAME as env var so CMD can use it at runtime
ENV APP_NAME=${APP_NAME} NODE_ENV=production NEXT_TELEMETRY_DISABLED=1

# Copy workspace root node_modules and package manifests
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-workspace.yaml ./

# Copy shared packages
COPY --from=builder /app/packages ./packages

# Copy built app
COPY --from=builder /app/apps/${APP_NAME} ./apps/${APP_NAME}

EXPOSE 3000

# next start reads PORT env var; docker-compose.prod.yml sets PORT=3000
CMD ["sh", "-c", "exec /app/apps/$APP_NAME/node_modules/.bin/next start -p ${PORT:-3000}"]
