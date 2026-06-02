#!/usr/bin/env bash
# Regenerates @avdan/types from the FastAPI OpenAPI spec.
# FastAPI must be running on localhost:8000 before running this script.

set -e

SPEC_URL="http://localhost:8000/openapi.json"
OUTPUT="packages/types/src/generated.ts"

echo "Fetching OpenAPI spec from $SPEC_URL..."
curl -f "$SPEC_URL" -o /tmp/avdan-openapi.json || {
  echo "ERROR: Could not fetch OpenAPI spec. Is the FastAPI server running on localhost:8000?"
  exit 1
}

echo "Generating TypeScript types..."
pnpm dlx openapi-typescript /tmp/avdan-openapi.json -o "$OUTPUT"

echo "Types written to $OUTPUT"
echo "Done. Commit packages/types/src/generated.ts to git."
