"""
Apply the R2 bucket CORS policy.

Why this is needed
------------------
Uploads are presigned PUTs sent straight from the client to R2. A **browser** doing that first
sends a CORS preflight to the bucket, and R2 rejects it unless the bucket has a matching rule —
so web-vendor's image upload fails without this. React Native's fetch is not subject to CORS, so
the mobile apps work either way; this is purely for the web apps.

CORS applies to the bucket's own endpoint. It is unrelated to the WAF rule protecting
`cdn.avdanstore.com/qa-evidence/*`, which stays in the Cloudflare dashboard.

Token permissions
-----------------
Setting CORS is a *bucket configuration* operation, not an object operation. The API token in
`.env` is scoped **Object Read & Write**, which is the right scope for the app to hold — it can
read and write objects but cannot reconfigure the bucket. So this script will fail with
`AccessDenied` on that token, by design.

Two ways to apply it:
  1. Paste the policy into the Cloudflare dashboard (R2 -> bucket -> Settings -> CORS Policy).
     Run with `--json` to print exactly what to paste. This is the recommended path — it needs no
     broader credentials to exist at all.
  2. Temporarily use an **Admin Read & Write** token, run `--apply`, then revoke it.

Usage (from apps/api):
    uv run python scripts/configure_r2_cors.py --json     # print the policy to paste (default)
    uv run python scripts/configure_r2_cors.py --show     # read current policy (needs admin token)
    uv run python scripts/configure_r2_cors.py --apply    # write it (needs admin token)

Either way this file stays the single source of truth for what the policy should be.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import sys

sys.path.insert(0, ".")

import aioboto3  # noqa: E402
from botocore.config import Config  # noqa: E402

from core.config import settings  # noqa: E402

# Origins allowed to presign-upload from a browser.
# Wildcards are not used: R2 echoes the matching origin back, and a wildcard here would let any
# site with a stolen presigned URL upload from a victim's browser session.
ALLOWED_ORIGINS = [
    # Local development — one entry per app port, per hostname the apps are reached on.
    # (The runbook uses three hostnames deliberately, because cookies ignore port numbers.)
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
    "http://localhost:3003",
    "http://localhost:3004",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "http://127.0.0.1:3002",
    "http://127.0.0.1:3003",
    "http://127.0.0.1:3004",
    # Production
    "https://avdanstore.com",
    "https://www.avdanstore.com",
    "https://vendor.avdanstore.com",
    "https://admin.avdanstore.com",
    "https://hub.avdanstore.com",
    "https://rider.avdanstore.com",
    # Staging
    "https://staging.avdanstore.com",
    "https://staging-vendor.avdanstore.com",
    "https://staging-admin.avdanstore.com",
    "https://staging-hub.avdanstore.com",
]

CORS_RULES = [
    {
        "AllowedOrigins": ALLOWED_ORIGINS,
        # PUT for the upload itself; GET/HEAD so a browser can read back a public object it just
        # wrote (e.g. to render a preview) without tripping CORS.
        "AllowedMethods": ["PUT", "GET", "HEAD"],
        # The presigned PUT is signed over Content-Type, so the browser must be allowed to send it.
        "AllowedHeaders": ["content-type"],
        # ETag lets the client confirm what R2 stored.
        "ExposeHeaders": ["ETag"],
        "MaxAgeSeconds": 3600,
    }
]


def _client_kwargs() -> dict:
    return {
        "endpoint_url": settings.r2_endpoint_url,
        "aws_access_key_id": settings.r2_access_key_id,
        "aws_secret_access_key": settings.r2_secret_access_key,
        "region_name": "auto",
        "config": Config(signature_version="s3v4"),
    }


async def show() -> int:
    session = aioboto3.Session()
    async with session.client("s3", **_client_kwargs()) as s3:
        try:
            resp = await s3.get_bucket_cors(Bucket=settings.r2_bucket)
            print(json.dumps(resp.get("CORSRules", []), indent=2))
        except Exception as exc:  # noqa: BLE001 — R2 raises NoSuchCORSConfiguration when unset
            if "NoSuchCORSConfiguration" in str(exc):
                print("No CORS policy set on this bucket.")
                return 0
            print(f"Could not read CORS policy: {exc}")
            return 1
    return 0


def print_json() -> int:
    """Emit the policy in the shape the Cloudflare dashboard's CORS editor expects."""
    print(json.dumps(CORS_RULES, indent=2))
    print()
    print("Paste the above into: Cloudflare dashboard -> R2 -> "
          f"{settings.r2_bucket} -> Settings -> CORS Policy")
    return 0


async def apply() -> int:
    session = aioboto3.Session()
    async with session.client("s3", **_client_kwargs()) as s3:
        try:
            await s3.put_bucket_cors(
                Bucket=settings.r2_bucket,
                CORSConfiguration={"CORSRules": CORS_RULES},
            )
            resp = await s3.get_bucket_cors(Bucket=settings.r2_bucket)
        except Exception as exc:  # noqa: BLE001
            if "AccessDenied" in str(exc):
                print("AccessDenied — the token in .env is scoped to objects, not bucket config.")
                print("That scope is correct for the app to hold. Apply the policy via the")
                print("dashboard instead:\n")
                return print_json()
            raise

    rules = resp.get("CORSRules", [])
    print(f"CORS applied to bucket '{settings.r2_bucket}'.")
    for rule in rules:
        print(f"  methods : {', '.join(rule.get('AllowedMethods', []))}")
        print(f"  headers : {', '.join(rule.get('AllowedHeaders', []))}")
        print(f"  origins : {len(rule.get('AllowedOrigins', []))} allowed")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--show", action="store_true", help="read the live policy (admin token)")
    parser.add_argument("--apply", action="store_true", help="write the policy (admin token)")
    parser.add_argument("--json", action="store_true", help="print the policy to paste (default)")
    args = parser.parse_args()

    if not settings.storage_enabled:
        print("R2 is not configured — set R2_* values in apps/api/.env first.")
        return 1

    if args.show:
        return asyncio.run(show())
    if args.apply:
        return asyncio.run(apply())
    return print_json()


if __name__ == "__main__":
    raise SystemExit(main())
