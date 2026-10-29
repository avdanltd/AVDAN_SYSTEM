PSQL := $(shell command -v psql 2>/dev/null || echo /opt/homebrew/opt/libpq/bin/psql)

DB_HOST ?= localhost
DB_PORT ?= 5432
DB_SUPERUSER ?= postgres
DB_USER ?= avdan
DB_PASS ?= avdan_dev
DB_NAME ?= avdan

.PHONY: help setup dev dev-api dev-web dev-mobile dev-all dev-all-except-mobile install db-create db-drop db-migrate db-upgrade db-downgrade db-reset types clean

help:
	@echo "AVDAN — available targets:"
	@echo "  make setup        Install all deps (pnpm + uv) and create the database"
	@echo "  make dev          Run all JS apps concurrently (turbo run dev) — web + mobile, no backend"
	@echo "  make dev-api      Run only the FastAPI backend"
	@echo "  make dev-web      Run only the frontend apps (all web-*)"
	@echo "  make dev-mobile   Run the app-rider Expo dev server"
	@echo "  make dev-all      Run EVERYTHING in one terminal: API, Celery worker+beat, cloudflare"
	@echo "                    tunnel, all 5 web apps, all 3 mobile apps. Requires DBngin already"
	@echo "                    running and cloudflared installed (brew install cloudflared)."
	@echo "                    NOTE: Expo only draws its QR code on a real TTY — piped through"
	@echo "                    concurrently, the 3 mobile dev servers start fine but print no QR."
	@echo "                    If you need to scan a QR, use dev-all-except-mobile instead and run"
	@echo "                    each mobile app's own dev server in its own terminal tab."
	@echo "  make dev-all-except-mobile"
	@echo "                    Same as dev-all but without the 3 Expo dev servers — pair with"
	@echo "                    running app-customer/app-vendor/app-rider manually, each in its"
	@echo "                    own terminal tab, so Expo gets a real TTY and shows its QR code."
	@echo "  make install      Install JS + Python dependencies"
	@echo "  make db-create    Create the local Postgres database (via DBngin)"
	@echo "  make db-drop      Drop the local Postgres database"
	@echo "  make db-migrate   Generate a new Alembic migration (make db-migrate m=\"message\")"
	@echo "  make db-upgrade   Apply all pending Alembic migrations"
	@echo "  make db-downgrade Revert the last Alembic migration"
	@echo "  make db-reset     Drop, recreate, and re-migrate the database"
	@echo "  make types        Regenerate @avdan/types from the running FastAPI OpenAPI spec"
	@echo "  make clean        Remove node_modules, .next, and Python caches"

setup: install db-create db-upgrade
	@echo "Setup complete. Run 'make dev' to start all services."

install:
	pnpm install
	cd apps/api && uv sync

dev:
	pnpm turbo run dev

dev-api:
	pnpm turbo run dev --filter=api

dev-web:
	pnpm turbo run dev --filter="./apps/web-*"

dev-mobile:
	pnpm turbo run dev --filter=app-rider

# Everything in one terminal — API, Celery worker + beat, the cloudflare tunnel (for real
# Paystack webhooks — see RUNBOOK_ORDER_E2E.md §6), every web app, every mobile app. Labeled,
# colour-coded, interleaved output via `concurrently` (fetched on the fly, not a project
# dependency). Ctrl-C once stops all of them.
#
# Prerequisites this does NOT start for you:
#   - DBngin running (Postgres + Redis) — see RUNBOOK_ORDER_E2E.md §2
#   - cloudflared installed — brew install cloudflared
#
# The tunnel waits for the API's /health to respond before starting, since
# scripts/tunnel_webhook.sh otherwise exits immediately if nothing is listening yet.
dev-all:
	npx --yes concurrently@8 \
		-n API,BEAT,WORKER,TUNNEL,CUSTOMER-W,VENDOR-W,ADMIN-W,HUB-W,RIDER-W,CUSTOMER-M,VENDOR-M,RIDER-M \
		-c blue,cyan,cyan,yellow,green,green,green,green,green,magenta,magenta,magenta \
		--kill-others \
		"cd apps/api && uv run uvicorn main:app --host 0.0.0.0 --port 8000" \
		"cd apps/api && uv run celery -A workers.celery_app beat --loglevel=info" \
		"cd apps/api && uv run celery -A workers.celery_app worker --loglevel=info" \
		"until curl -sf http://localhost:8000/health >/dev/null 2>&1; do sleep 1; done; bash apps/api/scripts/tunnel_webhook.sh" \
		"cd apps/web-customer && npx next dev" \
		"cd apps/web-vendor && npx next dev" \
		"cd apps/web-admin && npx next dev" \
		"cd apps/web-hub && npx next dev" \
		"cd apps/web-rider && npx next dev" \
		"cd apps/app-customer && npx expo start --port 8083 --clear" \
		"cd apps/app-vendor && npx expo start --port 8082 --clear" \
		"cd apps/app-rider && npx expo start --port 8081 --clear"

# Same as dev-all, minus the 3 Expo dev servers. Use this when you need to scan a QR code —
# run this in one terminal, then in three more tabs run each mobile app's own dev server
# directly (e.g. `cd apps/app-customer && npx expo start --port 8083 --clear`). Expo only
# draws its QR box on a real TTY; concurrently pipes child output through itself, which is
# never a TTY, so the mobile dev servers under dev-all start fine but never show a QR code.
dev-all-except-mobile:
	npx --yes concurrently@8 \
		-n API,BEAT,WORKER,TUNNEL,CUSTOMER-W,VENDOR-W,ADMIN-W,HUB-W,RIDER-W \
		-c blue,cyan,cyan,yellow,green,green,green,green,green \
		--kill-others \
		"cd apps/api && uv run uvicorn main:app --host 0.0.0.0 --port 8000" \
		"cd apps/api && uv run celery -A workers.celery_app beat --loglevel=info" \
		"cd apps/api && uv run celery -A workers.celery_app worker --loglevel=info" \
		"until curl -sf http://localhost:8000/health >/dev/null 2>&1; do sleep 1; done; bash apps/api/scripts/tunnel_webhook.sh" \
		"cd apps/web-customer && npx next dev" \
		"cd apps/web-vendor && npx next dev" \
		"cd apps/web-admin && npx next dev" \
		"cd apps/web-hub && npx next dev" \
		"cd apps/web-rider && npx next dev"

db-create:
	@$(PSQL) -h $(DB_HOST) -p $(DB_PORT) -U $(DB_SUPERUSER) -tc \
		"SELECT 1 FROM pg_roles WHERE rolname = '$(DB_USER)'" postgres | grep -q 1 || \
		$(PSQL) -h $(DB_HOST) -p $(DB_PORT) -U $(DB_SUPERUSER) -c \
		"CREATE ROLE $(DB_USER) LOGIN PASSWORD '$(DB_PASS)'" postgres
	@$(PSQL) -h $(DB_HOST) -p $(DB_PORT) -U $(DB_SUPERUSER) -tc \
		"SELECT 1 FROM pg_database WHERE datname = '$(DB_NAME)'" postgres | grep -q 1 || \
		$(PSQL) -h $(DB_HOST) -p $(DB_PORT) -U $(DB_SUPERUSER) -c \
		"CREATE DATABASE $(DB_NAME) OWNER $(DB_USER)" postgres
	@echo "Database '$(DB_NAME)' ready on $(DB_HOST):$(DB_PORT)."

db-drop:
	$(PSQL) -h $(DB_HOST) -p $(DB_PORT) -U $(DB_SUPERUSER) -c "DROP DATABASE IF EXISTS $(DB_NAME)" postgres

db-migrate:
	cd apps/api && uv run alembic revision --autogenerate -m "$(m)"

db-upgrade:
	cd apps/api && uv run alembic upgrade head

db-downgrade:
	cd apps/api && uv run alembic downgrade -1

db-reset: db-drop db-create db-upgrade

types:
	bash scripts/generate-types.sh

clean:
	rm -rf node_modules apps/*/node_modules apps/*/.next packages/*/node_modules
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find apps/api -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
