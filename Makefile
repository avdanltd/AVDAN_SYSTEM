PSQL := $(shell command -v psql 2>/dev/null || echo /opt/homebrew/opt/libpq/bin/psql)

DB_HOST ?= localhost
DB_PORT ?= 5432
DB_SUPERUSER ?= postgres
DB_USER ?= avdan
DB_PASS ?= avdan_dev
DB_NAME ?= avdan

.PHONY: help setup dev dev-api dev-web install db-create db-drop db-migrate db-upgrade db-downgrade db-reset types clean

help:
	@echo "AVDAN — available targets:"
	@echo "  make setup        Install all deps (pnpm + uv) and create the database"
	@echo "  make dev          Run all apps concurrently (turbo run dev)"
	@echo "  make dev-api      Run only the FastAPI backend"
	@echo "  make dev-web      Run only the frontend apps (all web-*)"
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
