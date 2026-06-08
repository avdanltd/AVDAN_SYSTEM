FROM node:20-alpine AS base

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

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
