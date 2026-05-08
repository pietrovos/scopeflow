# Deploying ScopeFlow to AWS

Infrastructure is an AWS CDK app (TypeScript) in this directory. `pnpm synth` runs in CI on
every push and needs no AWS credentials. Nothing is deployed automatically.

## What gets created

| Concern | Service | Notes |
|---|---|---|
| Containers | ECS on Fargate | `web`, `api`, `keycloak` services, one task each. Private subnets. |
| Images | ECR (CDK asset repo) | Built from `apps/*/Dockerfile` during `cdk deploy`. |
| Ingress | Application Load Balancer | Host-based routing: `app.`, `api.`, `auth.<domain>`. HTTPS with an ACM certificate; WebSockets work through the ALB as-is. |
| Database | RDS for PostgreSQL 17 | `db.t4g.micro`, encrypted, 7-day backups, deletion protection. Holds the `scopeflow` and `keycloak` databases. |
| Secrets | Secrets Manager | Generated: DB role passwords, `AUTH_SECRET`, OIDC client secret, Keycloak admin. Filled by hand: Stripe keys, SES SMTP credentials. |
| Email | SES (SMTP interface) | Domain identity created by the stack; the API uses the same `SmtpMailer` as local dev. |
| Logs | CloudWatch Logs | One log group, a stream prefix per container. |

Fargate runs the same Docker images used locally without requiring host management.
RDS provides managed Postgres with the row-level security policies the API uses.
One ALB serves all three hostnames with a single TLS certificate and public entry point.
App Runner was also considered, but its lack of WebSocket support ruled it out for the API.

## First deploy

Prerequisites: an AWS account, credentials for it, Docker, a domain and an ACM certificate
for `*.your-domain` in the target region.

```bash
cd infra/aws
pnpm cdk bootstrap                                 # once per account/region
pnpm cdk deploy \
  -c domain=scopeflow.example.com \
  -c certificateArn=arn:aws:acm:us-east-1:123456789012:certificate/... \
  -c mailFrom=no-reply@scopeflow.example.com
```

Then, in order:

1. Point `app.`, `api.` and `auth.<domain>` at the `LoadBalancerDns` output.
2. Run the database bootstrap task once. It creates the `scopeflow_owner`,
   `scopeflow_app` and `keycloak` roles and databases (`infra/postgres/bootstrap-rds.sql`):
   ```bash
   aws ecs run-task --cluster <ClusterName> --launch-type FARGATE \
     --task-definition <DbBootstrapTaskDefinition> \
     --network-configuration "awsvpcConfiguration={subnets=[<AppSubnets>],securityGroups=[<OneOffTaskSecurityGroup>]}"
   ```
3. Run the same command with `<MigrateTaskDefinition>`. Run it again on every release
   before the new API tasks roll out. `prisma migrate deploy` takes an advisory lock, so a
   concurrent run is safe.
4. Sign in to `https://auth.<domain>` as `admin` (password in Secrets
   Manager). Import `infra/keycloak/scopeflow-realm.json`, then change the `scopeflow-web`
   client: set redirect URI `https://app.<domain>/*`, web origin `https://app.<domain>`, and the
   client secret to the value of the `OidcClientSecret` secret. Delete the demo users unless
   this is a demo environment.
5. Fill the `ExternalCredentials` secret (`SMTP_USER`, `SMTP_PASS`
   from SES; Stripe keys and price IDs), then force a new deployment of the api service.
6. Add a Stripe endpoint for `https://api.<domain>/billing/webhook` with the
   events `checkout.session.completed` and `customer.subscription.*`, and put its signing
   secret in `STRIPE_WEBHOOK_SECRET`.

## Releases

`pnpm cdk deploy` rebuilds and pushes the images, then ECS rolls the services (with
circuit-breaker rollback). Run the migrate task first if the release has migrations.
Migrations are written to be backwards compatible with the previous API version for exactly
this reason.

## Known limits of this setup

- Real-time fan-out is in-process (`ActivityBus`). Running more than one API
  task needs the socket.io Redis adapter on ElastiCache so events reach sockets on other tasks.
  Clients recover missed events from the REST cursor after reconnecting.
- A single-AZ database and one NAT gateway keep the demo bill small. Production would turn on
  `multiAz` and add a NAT gateway per AZ.
- Email is sent inline after commit. A crash between commit and send drops that email.
  An outbox table drained by a worker would allow failed deliveries to be retried.
