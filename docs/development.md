# Development notes

## Local setup

Build the shared package before typechecking or building the apps. Both apps import
its compiled output, which is excluded from Git.

```bash
docker compose up -d --wait
pnpm --filter @scopeflow/shared build
pnpm db:migrate && pnpm db:seed
pnpm dev
```

| Service | Port |
| --- | --- |
| Web | 3100 |
| API | 4100 |
| PostgreSQL | 5544 |
| Keycloak | 8180 |
| Mailpit | 8125 (UI), 1125 (SMTP) |

The Keycloak issuer is `http://localhost:8180/realms/scopeflow`. Containers reach
Keycloak at `keycloak:8180`; `KC_HOSTNAME_BACKCHANNEL_DYNAMIC` allows internal
requests without changing the issuer. Auth.js uses explicit internal token and
userinfo URLs. Demo accounts use the password `scopeflow-demo`.

Auth.js reads its environment per request. `PUBLIC_API_URL` is also read at runtime
so the same image can run in different environments. Next.js embeds variables
prefixed with `NEXT_PUBLIC_` during the build.

## Database access

Prisma generates the client into `apps/api/src/generated` using
`@prisma/adapter-pg`. Migration configuration is in `apps/api/prisma.config.ts`.
The migrations include hand-written row-level security policies and triggers,
which Prisma does not manage.

Tenant requests use `TenantDb.run()` to set the organization, user and role for a
transaction. Cross-organization queries return 404. Clients can read only assigned
projects; related milestones, proposals, comments and activity use the same policy.

System operations use a separate database client. Its permitted uses are listed in
[`apps/api/src/db/README.md`](../apps/api/src/db/README.md).

Scope changes store content in append-only revisions. Approvals check the current
revision ID and pending status in the update. Rejected proposals can be revised;
approved proposals return `already_approved` if someone tries to revise them.
Concurrent proposals lock the project row while assigning their numbers.

Zod applies defaults inside `.partial()`. Update schemas therefore use field sets
without defaults, so omitted values do not reset existing data. Tests cover this
in `packages/shared/src/schemas.test.ts` and the API suite.

## Authentication and live updates

HTTP guards are global. Routes require an access token unless marked `@Public()`;
routes with `:orgId` also check membership. Browser API calls refresh the token and
retry once on authentication failure. Server components use `serverApi`.
`/auth/sign-out` ends the Keycloak session as well as the application session.

The `/realtime` namespace verifies JWTs during the handshake. Joining a project
room checks membership and project visibility. Token expiry closes the socket;
membership and assignment changes cause the gateway to recheck access.

`ProjectLive` fetches a fresh token when connecting, joins the room, and requests
activity after its last sequence number. Comment events contain the comment data.
Other project events trigger a debounced `router.refresh()`.

Broadcasts and notifications run after the database transaction commits. Email
delivery errors are logged without failing the request. Email has no outbox, so
a process crash between commit and delivery can lose a notification.

## Billing and email

The Stripe webhook verifies the raw request body and records the event ID in the
same transaction as the subscription update. Duplicate IDs return
`{status:'duplicate'}`. `billing_synced_at` prevents older subscription events from
replacing newer state.

Without `STRIPE_SECRET_KEY`, checkout and customer-portal requests return
`billing_unavailable`. Webhook verification needs only `STRIPE_WEBHOOK_SECRET`.
Plan limits count active projects and staff seats, including pending staff invites.

Mail transports are SMTP (Mailpit locally, SES in production), logging
(`MAIL_TRANSPORT=log`), and an in-memory implementation for tests. Mailpit messages
can be inspected at `http://localhost:8125` or through `/api/v1/messages`.

## Tests

API tests use the `scopeflow_test` database. Vitest's global setup applies migrations
before the suite. Test tokens are signed with a local RSA key, and `createTestApp`
replaces the JWKS provider and mailer.

`tenant-isolation.e2e-spec.ts` enumerates Express routes. When adding a route
parameter, add a corresponding fixture to `bIds`. The test checks response data
and verifies that requests from another organization did not modify rows.

Frontend tests polyfill `HTMLDialogElement.showModal()` and `.close()` for jsdom.
`LocalTime` renders a timezone-neutral value on the server, then displays local
time after hydration.

The Playwright suite reseeds the database before running. `reconnect.spec.ts` uses
`page.routeWebSocket` to interrupt a socket; setting a browser context offline
does not close an existing WebSocket. Install the route before navigating.

```bash
pnpm test
docker compose --profile app up -d --build --wait
pnpm e2e
pnpm --filter @scopeflow/infra synth
```

Real Stripe checkout and an AWS deployment have not been tested. The local suites
cover signed webhook payloads, Mailpit delivery and CDK synthesis.
