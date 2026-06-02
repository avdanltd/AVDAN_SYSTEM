#!/usr/bin/env bash
# Starts all services concurrently in native mode.
# Assumes postgres + redis are running (docker compose -f docker-compose.infra.yml up -d)

set -e

echo "Starting all AVDAN services in development mode..."
pnpm turbo run dev
