# Phase 11.1 — Local Production Isolation

This setup keeps development and local production independent while both run on the same Windows machine.

## Architecture

### Development

- App: `http://localhost:3000`
- Database: existing development PostgreSQL
- Private files: existing development-only `private-data` volume
- Source may remain bind-mounted for hot reload/debugging
- Development seed/reset workflows remain development-only

### Production

- App: `http://localhost:8080`
- Compose project: `rental-prod`
- App image: immutable, versioned `rental-house:<APP_VERSION>` image
- Database: dedicated PostgreSQL 17 service on the production Compose network
- Database storage: explicit Docker volume `rentalhouse_prod_postgres`
- PostgreSQL is not published to a Windows host port
- Private files: host directory from `PROD_UPLOADS_PATH`, mounted at `/app/private-data`
- Production source code is not bind-mounted

Editing local source after production starts does not change the running production application. Production changes only when a new versioned image is built and `APP_VERSION` is explicitly changed.

## Initial production setup

From the repository root in PowerShell:

```powershell
Copy-Item .env.production.example .env.production
```

Edit `.env.production` and replace all `CHANGE_ME` values. Keep:

```dotenv
APP_ENV=production
```

Use a production-only database/user/password and make sure `DATABASE_URL` points to the Compose service hostname `postgres`, not `localhost`.

The default private file location is:

```text
C:/RentalHouseData/prod/uploads
```

`prod-up.ps1` and `prod-migrate.ps1` create that configured upload directory if it does not already exist.

## Build a versioned production image

Build and deployment are intentionally separate steps.

```powershell
.\scripts\prod-build.ps1 v1.0.0
```

This creates:

```text
rental-house:v1.0.0
```

Then set the same version in `.env.production`:

```dotenv
APP_VERSION=v1.0.0
```

Production Compose does not contain an app `build:` section and does not fall back to `latest`.

## Apply production migrations

Run migrations explicitly before starting or switching the application version:

```powershell
.\scripts\prod-migrate.ps1
```

This runs only:

```text
prisma migrate deploy
```

Normal production container startup never runs migrations automatically.

## Start production

```powershell
.\scripts\prod-up.ps1
```

The command uses:

- `.env.production`
- Compose project `rental-prod`
- `compose.prod.yml`
- the already-built image referenced by `APP_VERSION`

It never passes `--build`.

Open:

```text
http://localhost:8080
```

Development may continue independently on:

```text
http://localhost:3000
```

## Check status

```powershell
.\scripts\prod-status.ps1
```

## Stop production without deleting data

```powershell
.\scripts\prod-stop.ps1
```

This runs Compose `down` without `-v` or `--volumes`. The production PostgreSQL volume and host-mounted private files remain intact.

## Manual production backup

Phase 11.3A provides an explicit, online backup command for the production database and private uploads:

```powershell
.\scripts\prod-backup.ps1
```

The script always targets the production Compose project `rental-prod`, `compose.prod.yml`, and `.env.production`. It does not stop production, seed/reset data, copy raw PostgreSQL data directories, or touch DEV.

Configure the backup root in `.env.production` if desired:

```dotenv
PROD_BACKUP_PATH=C:/RentalHouseData/prod/backups
```

If `PROD_BACKUP_PATH` is omitted, the scripts use `C:/RentalHouseData/prod/backups`. The uploads path still comes from `PROD_UPLOADS_PATH`.

New manual backups are stored under the `manual` subdirectory:

```text
C:\RentalHouseData\prod\backups\
  manual\
    2026-09-29_153000\
      database.dump
      uploads.zip
      manifest.json
```

Historical backups created by earlier versions directly under `PROD_BACKUP_PATH` remain valid and are not moved or deleted automatically.

Each run first creates an `.incomplete` directory. Only after the database dump, uploads archive, checksums, and manifest all succeed is it renamed to a completed timestamped backup.

- `database.dump` is a PostgreSQL custom-format logical backup created with `pg_dump -Fc`.
- `uploads.zip` is a snapshot of production private media. An empty uploads directory still produces a valid archive.
- `manifest.json` records the backup format version, creation timestamps, application version, Compose project, backup type, SHA-256 checksums, and file sizes. It does not contain database credentials, `DATABASE_URL`, secrets, private filenames, or user data.

A failed backup is left with an `.incomplete` suffix and is never presented as completed. Scheduled retention never removes manual backups.

### Current backup limitation

A backup stored only on the same Windows machine does **not** protect against total disk failure, a stolen/lost machine, or catastrophic Windows filesystem failure. Off-machine/remote backup will be added in a later phase.

## Production safety rules

**NEVER run against production:**

- `prisma migrate reset`
- `prisma migrate dev`
- seed commands
- destructive reset/bootstrap scripts
- `docker compose down -v`
- `docker compose down --volumes`
- deletion of the `rentalhouse_prod_postgres` volume
- a development `DATABASE_URL` pointed at the production database

The project's seed and `db:migrate:dev` entrypoints refuse to run when `APP_ENV=production`.

There is intentionally no production reset helper.

## Normal local deployment flow

For a future application version, the intended flow is:

```text
DEV work
→ stable Git commit/tag
→ build rental-house:v1.1.0
→ run manual PROD backup (Phase 11.3A)
→ prisma migrate deploy
→ change APP_VERSION=v1.1.0
→ prod-up
→ PROD runs v1.1.0
```

Manual backup, full backup verification, controlled restore, and scheduled backup/retention are implemented in Phase 11.3. Off-machine backup, remote registry, CI/CD, LAN/Tailscale access, and replication remain future work.

## Verify a production backup

Phase 11.3B adds an explicit verification command for a completed backup. Pass the exact backup directory to verify; the script never chooses a backup automatically.

```powershell
.\scripts\prod-verify-backup.ps1 `
  D:\app_data\RentalHouseData\prod\backups\2026-09-29_165718
```

A manual backup should not be considered proven until this verification passes. The verification process is self-contained and uses only the selected backup artifacts. It does not read `DATABASE_URL`, connect to the production PostgreSQL service, attach to the `rental-prod` network, stop PROD, or touch DEV.

Verification performs the following checks:

- validates `manifest.json` and backup format version
- validates recorded file sizes and SHA-256 checksums
- confirms `uploads.zip` can be safely opened and extracted, including a valid empty archive
- confirms `database.dump` is readable by PostgreSQL 17 `pg_restore --list`
- starts a disposable isolated `postgres:17` container with temporary credentials and no published host port
- fully restores `database.dump` with `pg_restore --exit-on-error --no-owner --no-privileges`
- confirms the restored database contains public application tables
- queries `_prisma_migrations` when that table exists
- removes the temporary PostgreSQL container and extracted upload files on both success and failure

Successful output ends with:

```text
Backup verification PASSED
```

The selected backup directory itself is treated as read-only and is not repaired, renamed, rewritten, or deleted by verification.

Controlled restore-to-production is implemented in the next section as Phase 11.3C. Scheduled backup, automatic verification, and retention are documented below as Phase 11.3D.

## Controlled production restore

Phase 11.3C adds a destructive, operator-triggered restore command. Restore is never part of app startup, Compose startup, migrations, or deployment.

Run it only with an explicitly selected, completed backup directory:

```powershell
.\scripts\prod-restore.ps1 `
  D:\app_data\RentalHouseData\prod\backups\2026-09-29_165718
```

The restore sequence is intentionally guarded:

1. the selected backup is verified with `prod-verify-backup.ps1`
2. the backup metadata and target are displayed
3. the operator must type exactly `RESTORE PRODUCTION`
4. `prod-backup.ps1` creates a fresh pre-restore backup of the current production state
5. the fresh pre-restore backup is verified before production is modified
6. only the production `app` service is stopped; PostgreSQL stays running
7. the application database is logically replaced with `pg_restore`
8. the selected `uploads.zip` is extracted to staging and swapped into the configured production uploads path
9. basic database and uploads sanity checks run
10. the production app is started again

The PostgreSQL Docker volume is never deleted or copied. The restore keeps the existing production PostgreSQL role/password and uses `--no-owner --no-privileges`. DEV is not targeted.

If data restoration fails after production has already been modified, the script attempts an automatic rollback using the fresh pre-restore backup. If rollback also fails, the application remains stopped and the script reports the retained pre-restore backup path for manual recovery.

### Application version warning

A restore is a **data restore**. It does not change the deployed Docker image and it does not rewrite `APP_VERSION`.

For example:

```text
Current app:      v1.1.0
Restored backup:  v1.0.1
App after restore: v1.1.0
```

When the backup version differs from the currently deployed version, the restore script prints a compatibility warning. It does not automatically deploy an older image and it does not run Prisma migrations. If the restored schema is not compatible with the current image, coordinate application-version rollback and any later `prod-migrate.ps1` action separately.

Restore is always manual. There is no scheduled restore, automatic latest-backup selection, startup restore, Prisma reset, seed, volume deletion, or DEV restore path.

## Scheduled daily production backup

Phase 11.3D adds a scheduled backup workflow that reuses the same production backup and full verification scripts already proven manually. Scheduled backups do not stop the production app or PostgreSQL.

Scheduled backups are stored separately from manual and historical backups:

```text
C:\RentalHouseData\prod\backups\
  manual\
  scheduled\
  logs\
    scheduled-backup.log
```

Configure scheduled retention in `.env.production`:

```dotenv
PROD_SCHEDULED_BACKUP_RETENTION_DAYS=30
```

If the value is missing, the default is 30 days. Retention applies **only** to completed backup directories inside `scheduled`. Manual backups, pre-restore safety backups, historical backups outside `scheduled`, and `.incomplete` directories are not removed by scheduled retention. Retention runs only after a newly-created scheduled backup has passed full verification.

### Run the exact scheduled workflow manually

Use this before relying on Task Scheduler:

```powershell
.\scripts\prod-scheduled-backup.ps1
```

The workflow is:

1. create a backup with `prod-backup.ps1 -BackupType Scheduled`
2. capture the exact completed backup path
3. run `prod-verify-backup.ps1` against that backup
4. only after verification passes, delete expired completed scheduled backups
5. append a compact operational result to `<PROD_BACKUP_PATH>\logs\scheduled-backup.log`

The command returns a non-zero exit code if backup, verification, or retention fails. If backup or verification fails, retention is not run. A lightweight process lock also prevents overlapping manual scheduled runs.

### Install the Windows Scheduled Task

Register or update the single known task:

```powershell
.\scripts\prod-install-backup-task.ps1
```

The task is named:

```text
RentalHouse Production Backup
```

Default behavior:

- runs daily at 02:00 local machine time
- runs as soon as practical when a scheduled start was missed
- uses `IgnoreNew` so a second instance is not started while one is already running
- allows up to six hours for future larger backups
- does not require AC power
- runs in the current interactive Windows user context so it can use that user's Docker Desktop engine
- invokes `scripts/prod-scheduled-backup.ps1` by absolute path and sets the repository working directory explicitly

After installation, inspect it in Windows Task Scheduler under `RentalHouse Production Backup`. You do not need to wait until 02:00; run `prod-scheduled-backup.ps1` manually to exercise the same backup/verification/retention workflow.

### Remove the scheduled task

```powershell
.\scripts\prod-remove-backup-task.ps1
```

Removing the task does **not** remove any backup files.

### Backup storage security

Production backups may contain sensitive real data. Keep the backup directory private to the Windows machine. Do not expose it through Next.js `public/`, static web serving, Docker published volumes, or a network share by default.

The Windows drive containing production data and backups should use BitLocker or equivalent full-disk encryption when sensitive real data is stored. This phase does not add encrypted ZIPs or third-party encryption tooling.

### Same-machine limitation

Scheduled backups on the same physical machine are useful for bad deployments, accidental data changes, database corruption scenarios, and application mistakes. They are **not** sufficient disaster recovery for disk failure, theft, or catastrophic machine loss. Off-machine backup remains a future phase.

