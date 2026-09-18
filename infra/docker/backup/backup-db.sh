#!/bin/sh
# infra/docker/backup/backup-db.sh
#
# Dumps the production Postgres database to a compressed, timestamped file and prunes
# old dumps past a retention window. Runs inside the `db-backup` service defined in
# docker-compose.prod.yml, on a schedule set by infra/docker/backup/crontab (daily by
# default). Written in POSIX sh, not bash — the postgres:16-alpine base image this
# service uses is Alpine-based and does not ship bash.
#
# See infra/docker/README.md for how to verify a backup and how to restore from one.
#
# Required env (supplied via docker-compose.prod.yml's env_file, the same
# /opt/avdan/secrets/api.env used by the api/celery services, so DATABASE_URL never
# needs to be duplicated):
#   DATABASE_URL              e.g. postgresql+asyncpg://user:pass@host:5432/avdan
#
# Optional env (see docker-compose.prod.yml's db-backup service for defaults):
#   BACKUP_DIR                 where dumps are written (default: /backups)
#   BACKUP_RETENTION_DAYS      delete dumps older than this many days (default: 14)
#   BACKUP_S3_BUCKET           if set, attempt to also upload the dump off-VPS (see below)
#   BACKUP_S3_ENDPOINT         optional S3-compatible endpoint (e.g. R2/B2), passed to `aws s3`

set -eu

BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
TIMESTAMP="$(date -u +%Y-%m-%d-%H%M%S)"
DUMP_FILE="${BACKUP_DIR}/avdan-${TIMESTAMP}.sql"
GZ_FILE="${DUMP_FILE}.gz"

log() {
    echo "[backup-db] $(date -u +%Y-%m-%dT%H:%M:%SZ) $*"
}

if [ -z "${DATABASE_URL:-}" ]; then
    log "ERROR: DATABASE_URL is not set — cannot run pg_dump. Check env_file wiring."
    exit 1
fi

mkdir -p "$BACKUP_DIR"

# pg_dump/libpq accept the standard postgresql:// scheme, not SQLAlchemy's
# "postgresql+asyncpg://" driver-qualified scheme — strip the driver suffix.
PG_URL=$(printf '%s' "$DATABASE_URL" | sed -e 's#^postgresql+asyncpg://#postgresql://#' -e 's#^postgres+asyncpg://#postgres://#')

log "starting dump -> ${GZ_FILE}"

if ! pg_dump "$PG_URL" --no-owner --no-privileges > "$DUMP_FILE"; then
    log "ERROR: pg_dump failed — removing partial dump file"
    rm -f "$DUMP_FILE"
    exit 1
fi

gzip -f "$DUMP_FILE"

DUMP_SIZE=$(du -h "$GZ_FILE" | cut -f1)
log "dump complete: ${GZ_FILE} (${DUMP_SIZE})"

# ── Retention: delete local dumps older than BACKUP_RETENTION_DAYS ─────────────────
log "pruning dumps older than ${RETENTION_DAYS} days in ${BACKUP_DIR}"
find "$BACKUP_DIR" -maxdepth 1 -name 'avdan-*.sql.gz' -type f -mtime +"$RETENTION_DAYS" -print -delete | while read -r removed; do
    log "removed old dump: ${removed}"
done

# ── OPTIONAL: off-VPS upload (S3-compatible: Backblaze B2, Cloudflare R2, AWS S3) ──
# A VPS-disk-only backup dies with the VPS — this is the actually-correct practice per
# STATUS_DESIGN.md §2, but it needs the user's own bucket + credentials, which don't
# exist yet. This section is fully inert until BACKUP_S3_BUCKET is set.
#
# To enable once a bucket exists:
#   1. Set BACKUP_S3_BUCKET (and BACKUP_S3_ENDPOINT if not using real AWS S3, e.g.
#      https://<account_id>.r2.cloudflarestorage.com for Cloudflare R2) in
#      /opt/avdan/secrets/api.env on the VPS.
#   2. Add AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_DEFAULT_REGION to the same
#      secrets file (scoped to a bucket-only credential, not the R2_* app upload keys).
#   3. The db-backup service's image needs the `aws` CLI available — it is NOT installed
#      by default (keeping the default image minimal). Either extend postgres:16-alpine
#      with `apk add --no-cache aws-cli` in a small custom Dockerfile and point
#      docker-compose.prod.yml's db-backup service at it, or swap in any other image
#      that ships `aws`/`rclone` and adjust upload_to_s3() below accordingly.
if [ -n "${BACKUP_S3_BUCKET:-}" ]; then
    if command -v aws >/dev/null 2>&1; then
        aws_endpoint_args=""
        if [ -n "${BACKUP_S3_ENDPOINT:-}" ]; then
            aws_endpoint_args="--endpoint-url ${BACKUP_S3_ENDPOINT}"
        fi
        log "BACKUP_S3_BUCKET set — uploading to s3://${BACKUP_S3_BUCKET}/"
        # shellcheck disable=SC2086
        if aws $aws_endpoint_args s3 cp "$GZ_FILE" "s3://${BACKUP_S3_BUCKET}/$(basename "$GZ_FILE")"; then
            log "uploaded $(basename "$GZ_FILE") to s3://${BACKUP_S3_BUCKET}/"
        else
            log "WARNING: S3 upload failed for $(basename "$GZ_FILE") — local dump is still intact"
        fi
    else
        log "WARNING: BACKUP_S3_BUCKET is set but the 'aws' CLI is not installed in this image — skipping off-VPS upload. See the comment above this block."
    fi
fi

log "done"
