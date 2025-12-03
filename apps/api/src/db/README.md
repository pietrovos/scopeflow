# Database access

ScopeFlow isolates tenant data with Postgres row-level security (see
`prisma/migrations/*_row_level_security`). The API has two connections:

| Client                | Role              | RLS      | Used for |
|-----------------------|-------------------|----------|----------|
| `PrismaService`       | `scopeflow_app`   | enforced | every request, always through `TenantDb.run()` |
| `SystemPrismaService` | `scopeflow_owner` | bypassed | the system paths below, nothing else |

## Why RLS instead of a guard or a Prisma extension

A guard can check that you belong to org A. It cannot stop a service method from
running `findUnique({ where: { id } })` on a row that belongs to org B. A Prisma
extension that injects `where: { orgId }` misses raw queries, nested writes and
relation filters. With RLS the database rejects the row no matter which code path
built the query, and the cross-tenant tests check the behaviour at the HTTP layer.

Each tenant request runs in a transaction to scope `set_config`. The SQL policies
also need separate review.

## System paths (bypass RLS)

1. Sign-in bootstrap (`auth/users.service.ts`): find or create the `users` row for a
   token subject. `users` has no RLS. It goes through the system client so it can link
   a pre-seeded user by verified email.
2. Membership lookup (`tenancy/tenant.guard.ts`): read the caller's membership in the
   org named in the URL. This happens before any tenant context exists.
3. Invitation acceptance (`organizations/invitations.service.ts`): find an
   invitation by token hash. The invitee is not a member yet, so RLS would hide it.
4. Stripe webhooks (`billing/billing.service.ts`): map a Stripe customer to an
   organization and record processed event IDs.
5. Socket handshake (`realtime/realtime.gateway.ts`): the same membership lookup
   as (2), for socket connections.

Adding to this list needs a reason in code review.
