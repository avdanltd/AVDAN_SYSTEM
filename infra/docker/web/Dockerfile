FROM node:20-alpine AS base

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

FROM base AS development

COPY package.json pnpm-workspace.yaml ./
COPY apps/web-customer/package.json ./apps/web-customer/
COPY packages/config/package.json ./packages/config/
COPY packages/types/package.json ./packages/types/
COPY packages/ui/package.json ./packages/ui/

RUN pnpm install

COPY . .

EXPOSE 3000

CMD ["pnpm", "dev"]
