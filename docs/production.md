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
→ backup PROD (Phase 11.2/11.3, not implemented here)
→ prisma migrate deploy
→ change APP_VERSION=v1.1.0
→ prod-up
→ PROD runs v1.1.0
```

Backup, restore, rollback automation, remote registry, CI/CD, LAN/Tailscale access, and replication are outside Phase 11.1.
