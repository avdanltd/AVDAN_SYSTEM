# infra/docker/

Dockerfiles and operational scripts used by the real production deployment
(`docker compose -f docker-compose.prod.yml`, driven by `.github/workflows/deploy-prod.yml`
over SSH to a single Contabo VPS — see `STATUS_DESIGN.md` §2). `infra/k8s/*` is a drafted
future state and is **not** currently deployed; nothing here depends on it.

```
infra/docker/
├── api/         # apps/api production Dockerfile
├── web/         # shared Dockerfile for all 5 Next.js apps (APP_NAME build arg)
└── backup/      # automated Postgres backups (this document)
    ├── backup-db.sh   # pg_dump → gzip → timestamped file, + retention pruning
    └── crontab         # busybox crond table: runs backup-db.sh daily at 02:00 UTC
```

## Automated database backups

The `db-backup` service in `docker-compose.prod.yml` runs `postgres:16-alpine` (matching the
production Postgres major version) as a long-lived `crond` process. On deploy,
`deploy-prod.yml` copies `backup-db.sh` and `crontab` to `/opt/avdan/infra/docker/backup/` on
the VPS, and the compose service bind-mounts them in read-only, with a named volume
(`pg_backups`) at `/backups` holding the dumps.

It reads `DATABASE_URL` from the same `/opt/avdan/secrets/api.env` the `api`/`celery` services
already use — nothing new to configure on a normal deploy. Default retention is 14 days,
overridable via `BACKUP_RETENTION_DAYS` in that same compose service block.

**Off-VPS storage (S3/R2/B2) is not wired up yet** — a VPS-disk-only backup dies with the VPS,
so this is the actually-correct next step, but it needs the user's own bucket + credentials.
`backup-db.sh` has a clearly-marked, inert-by-default section (`BACKUP_S3_BUCKET`) ready for
that — see the comment block in the script for exactly what to add.

### How to verify a backup actually happened

```bash
# On the VPS:
docker compose -f /opt/avdan/docker-compose.prod.yml exec db-backup ls -la /backups
docker compose -f /opt/avdan/docker-compose.prod.yml exec db-backup cat /backups/backup.log

# Sanity-check a dump is well-formed gzip'd SQL without restoring anywhere:
docker compose -f /opt/avdan/docker-compose.prod.yml exec db-backup \
  sh -c 'gunzip -c /backups/avdan-<timestamp>.sql.gz | head -20'
```

### How to run a backup on demand (don't wait for the 02:00 UTC cron tick)

```bash
docker compose -f /opt/avdan/docker-compose.prod.yml exec db-backup /usr/local/bin/backup-db.sh
```

### How to restore from a backup

**Restoring overwrites data in the target database — never point this at production unless
production itself is the thing being recovered.**

```bash
# 1. Copy the dump off the VPS (or wherever it landed) to somewhere you can run psql from:
docker compose -f /opt/avdan/docker-compose.prod.yml cp \
  db-backup:/backups/avdan-2026-01-15-020000.sql.gz ./avdan-restore.sql.gz

# 2. Restore into a target Postgres (the SAME DATABASE_URL used for the dump normally means
#    production — for a real disaster recovery this is intentional; for testing, point this
#    at a scratch database instead, e.g. a fresh local `avdan_restore_test` DB):
gunzip -c avdan-restore.sql.gz | psql "postgresql://user:pass@host:5432/target_db"
```

If restoring into a database that already has the schema/data (rather than a fresh empty one),
expect `CREATE`/`INSERT` conflicts — `pg_dump`'s default plain-SQL output does not drop existing
objects first. For a clean restore, restore into a freshly created empty database.

**This has NOT been tested against a real production-shaped environment in this session** —
only the `pg_dump` half was dry-run against a local dev database to confirm the command syntax
is correct (see the backup script's header comment). An untested restore path is not a real
backup. Before relying on this for production, the user should run an actual restore drill:
either against the local dev Postgres (safe, disposable) or, ideally, against a scratch
database that mirrors production, to confirm the full dump → restore round-trip produces a
working database.

## Verify

- [x] `pg_dump` command syntax dry-run against local dev Postgres (`docker-compose.infra.yml`'s
      `avdan` DB) — produced a valid, restorable-looking gzip'd SQL dump.
- [ ] Full restore drill (dump → restore into a fresh database → confirm the app works against
      it) — not done in this session; see the restore section above.
- [ ] Real off-VPS (S3/R2/B2) upload — needs a bucket + credentials the user has to create.
