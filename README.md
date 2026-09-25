# Rental House

A modular monolith foundation for a rental property management application. Phase 0 and Phase 1 cover the property, floor, and space model plus an interactive building dashboard. Tenant, tenancy, billing, payments, meters, maintenance, assets, IoT, portals, and analytics are intentionally out of scope.

## Stack

- Next.js 16 App Router
- TypeScript with strict mode
- Tailwind CSS 4
- shadcn/ui-style components built on Radix primitives
- Prisma ORM 7
- PostgreSQL
- Zod
- Motion for React
- Vitest
- Docker and Docker Compose

## Local Setup

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Copy environment defaults:

   ```bash
   cp .env.example .env
   ```

3. Start PostgreSQL with Docker Compose:

   ```bash
   docker compose up -d postgres
   ```

4. Generate Prisma client, run migrations, and seed development data:

   ```bash
   pnpm prisma:generate
   pnpm db:migrate:dev
   pnpm db:seed
   ```

5. Start the app:

   ```bash
   pnpm dev
   ```

The seeded development property is named `My Rental Property` and can be renamed later.
Seeding populates an empty database only; rerunning it leaves existing property edits untouched.

## Docker

Run the app and PostgreSQL together:

```bash
docker compose up --build
```

The app container runs `pnpm db:migrate` before `pnpm start`. Seed data is not run automatically in production-style startup because the seed is a development workflow.

## Validation

Useful commands:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm prisma:validate
pnpm prisma:generate
pnpm build
pnpm format:check
```

Database commands:

```bash
pnpm db:migrate:dev
pnpm db:migrate
pnpm db:seed
```

## Project Structure

- `src/app` - App Router pages, metadata, and global styles.
- `src/components/ui` - Local shadcn/ui-style primitives.
- `src/lib` - Shared infrastructure helpers such as Prisma and utility functions.
- `src/modules/property` - Phase 1 property/floor/space domain, server actions, queries, components, and tests.
- `prisma` - Prisma schema, migrations, and development seed.
- `docs` - Architecture notes and conventions.

The UX is currently optimized around one owner managing one primary property, but the domain model supports multiple properties and does not hard-code the current building layout.

## Isolated Acceptance Checks

Use a local PostgreSQL database named `rental_house_phase01_audit_v2`, owned by `rental_user`. Never point audit commands at a production database. The audit URL is derived from the local `DATABASE_URL`; its database name is replaced with the dedicated audit name.

```bash
pnpm exec tsx scripts/audit-database.ts prepare
pnpm test:integration
pnpm exec tsx scripts/audit-database.ts serve
```

In a separate terminal, run `pnpm test:browser`. The browser test creates Floor 4 with P09/P10, verifies persistence and ordering after refresh, and removes only its test floor from the audit database afterward. It captures desktop and mobile screenshots in `test-results/`.

The audit server uses port 3001 and shares Next.js's `.next` output directory with the normal development server. Run only one of the two development servers at a time.

## Phase Scope

Implemented now:

- Property viewing and basic editing.
- Dynamic floors and spaces.
- Floor/space create, update, reorder, archive, and safe delete operations.
- Interactive 2.5D building dashboard rendered from data.

Not implemented in this phase:

- Tenants, occupants, tenancy history, rent, deposits, electricity/water billing, invoices, payments, expenses, maintenance, tasks, asset/device management, tenant portal, IoT, integrations, and analytics.
