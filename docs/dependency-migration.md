# Dependency migration

The repository history was reconstructed with a late-2025 dependency baseline
and a subsequent migration to the current stack. Commit timestamps are a
simulated development timeline, not a record of when the original work occurred.

## Baseline

The baseline dependency set uses versions published by November 30, 2025.
Both direct and transitive dependencies in the historical lockfile were checked
against npm publication timestamps. Dependency versions are pinned so a fresh
install cannot silently select later releases.

| Component | Baseline | Current migration |
| --- | --- | --- |
| pnpm | 10.24.0 | 11.3.0 |
| NestJS core | 11.1.9 | 12.0.1 |
| Next.js | 16.0.6 | 16.3.8 |
| Prisma | 7.0.1 | 7.10.0 |
| React | 19.2.0 | 19.2.8 |
| TypeScript | 5.9.3 | 6.0.x |
| Vitest | 4.0.14 | 5.0.3 |
| Tailwind | 4.1.17 | 4.3.x |
| Stripe SDK | 20.0.0 | 23.0.0 |
| Nodemailer | 7.0.11 | 10.0.14 |

Next.js 16 and Prisma 7 were already released in 2025, so the baseline retains
their original major versions. NestJS's configuration package has its own release
numbering; its baseline version is 4.0.2.

## Changes in the migration

- Upgrade package manifests and the lockfile to the current dependency set.
- Replace pnpm 10's `onlyBuiltDependencies` with pnpm 11's `allowBuilds` policy.
- Remove the SWC test transform required for NestJS decorator metadata under
  Vitest 4. The current Vitest/Vite toolchain supplies the newer transform path.
- Enable the current API test configuration's `resolve.tsconfigPaths` option.
- Restore declaration emission under TypeScript 6; the baseline disables it to
  avoid Prisma 7.0.1's generated null types triggering TS2742 under TypeScript 5.9.
- Keep database migration SQL and identifiers stable across the upgrade.

## Verification

The complete baseline passed installation with its frozen lockfile, workspace
typechecking, linting, shared/frontend tests, API integration tests against a
separate PostgreSQL database, production builds, and AWS CDK synthesis.

## Existing databases from before the history reconstruction

Migration directories were renamed to match the reconstructed feature dates.
The SQL itself is unchanged. A fresh database applies them normally. A database
already initialized from the original history has the old names recorded in
`_prisma_migrations`; reconcile those names before deploying the rewritten
history to it. Do not replay already applied SQL.

| Original identifier | Reconstructed identifier |
| --- | --- |
| 20261005200125_init | 20251203150125_init |
| 20261005200200_row_level_security | 20251203150200_row_level_security |
| 20261005204000_scope_self_visibility | 20260119184000_scope_self_visibility |
| 20261006005255_billing_synced_at | 20260312205255_billing_synced_at |
