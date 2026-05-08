import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CfnOutput, Duration, RemovalPolicy, SecretValue, Stack, type StackProps } from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as ses from 'aws-cdk-lib/aws-ses';
import type { Construct } from 'constructs';

export interface ScopeFlowStackProps extends StackProps {
  /** Base domain. The app is served at app.<domain>, the API at api.<domain>, Keycloak at auth.<domain>. */
  domain: string;
  /** ACM certificate covering the three hostnames (e.g. *.<domain>). Empty → HTTP only (testing). */
  certificateArn: string;
  mailFrom: string;
}

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));

/**
 * ScopeFlow on AWS:
 *
 *   Route 53 / DNS ──► ALB (HTTPS, host-based routing, WebSockets)
 *                        ├─ app.<domain>  → ECS Fargate: web (Next.js)
 *                        ├─ api.<domain>  → ECS Fargate: api (NestJS + socket.io)
 *                        └─ auth.<domain> → ECS Fargate: keycloak
 *   private subnets:  RDS PostgreSQL (scopeflow + keycloak databases)
 *   Secrets Manager:  DB role passwords, Auth.js secret, OIDC client secret, Stripe, SES SMTP
 *   SES:              outbound email (SMTP interface)
 *   CloudWatch Logs:  container logs
 *
 * Nothing here is deployed by CI. See infra/aws/README.md for the deploy runbook.
 */
export class ScopeFlowStack extends Stack {
  constructor(scope: Construct, id: string, props: ScopeFlowStackProps) {
    super(scope, id, props);

    const hosts = {
      web: `app.${props.domain}`,
      api: `api.${props.domain}`,
      auth: `auth.${props.domain}`,
    };
    const https = Boolean(props.certificateArn);
    const url = (host: string) => `${https ? 'https' : 'http'}://${host}`;
    const issuer = `${url(hosts.auth)}/realms/scopeflow`;

    // --- Network ------------------------------------------------------------------
    // Two AZs, one NAT gateway (cost over NAT redundancy; see the README tradeoffs).
    const vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        { name: 'public', subnetType: ec2.SubnetType.PUBLIC },
        { name: 'app', subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        { name: 'data', subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      ],
    });

    // --- Secrets ------------------------------------------------------------------
    const generated = (name: string, exclude = '"@/\\\' :?#[]%') =>
      new secretsmanager.Secret(this, name, {
        generateSecretString: { passwordLength: 40, excludeCharacters: exclude },
      });
    const dbOwnerPassword = generated('DbOwnerPassword');
    const dbAppPassword = generated('DbAppPassword');
    const dbKeycloakPassword = generated('DbKeycloakPassword');
    const authSecret = generated('AuthSecret');
    const oidcClientSecret = generated('OidcClientSecret');
    const keycloakAdmin = generated('KeycloakAdminPassword');
    // Filled in by hand after deploy (Stripe dashboard, SES SMTP credentials).
    const external = new secretsmanager.Secret(this, 'ExternalCredentials', {
      description: 'Stripe keys and SES SMTP credentials: set the JSON fields after the first deploy',
      // Every field must exist or ECS refuses to start the task; empty means "not configured".
      secretObjectValue: Object.fromEntries(
        [
          'SMTP_USER',
          'SMTP_PASS',
          'STRIPE_SECRET_KEY',
          'STRIPE_WEBHOOK_SECRET',
          'STRIPE_PRICE_PRO',
          'STRIPE_PRICE_AGENCY',
        ].map((k) => [k, SecretValue.unsafePlainText('')]),
      ),
    });

    // --- Database -----------------------------------------------------------------
    const db = new rds.DatabaseInstance(this, 'Postgres', {
      engine: rds.DatabaseInstanceEngine.postgres({ version: rds.PostgresEngineVersion.VER_17 }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.MICRO),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      credentials: rds.Credentials.fromGeneratedSecret('postgres'),
      allocatedStorage: 20,
      maxAllocatedStorage: 100,
      storageEncrypted: true,
      backupRetention: Duration.days(7),
      deletionProtection: true,
      removalPolicy: RemovalPolicy.SNAPSHOT,
      multiAz: false,
    });

    // --- Email --------------------------------------------------------------------
    new ses.EmailIdentity(this, 'MailDomain', { identity: ses.Identity.domain(props.domain) });

    // --- Compute ------------------------------------------------------------------
    const cluster = new ecs.Cluster(this, 'Cluster', { vpc, containerInsightsV2: ecs.ContainerInsights.ENABLED });
    const logGroup = new logs.LogGroup(this, 'Logs', {
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    const logging = (prefix: string) => ecs.LogDrivers.awsLogs({ logGroup, streamPrefix: prefix });

    const dbEnv = {
      DB_HOST: db.dbInstanceEndpointAddress,
      DB_PORT: db.dbInstanceEndpointPort,
      DB_NAME: 'scopeflow',
    };
    const dbSecrets = {
      DB_APP_PASSWORD: ecs.Secret.fromSecretsManager(dbAppPassword),
      DB_OWNER_PASSWORD: ecs.Secret.fromSecretsManager(dbOwnerPassword),
    };

    // API
    const apiTask = new ecs.FargateTaskDefinition(this, 'ApiTask', { cpu: 512, memoryLimitMiB: 1024 });
    const apiImage = ecs.ContainerImage.fromAsset(repoRoot, { file: 'apps/api/Dockerfile' });
    apiTask.addContainer('api', {
      image: apiImage,
      // Migrations run as the separate MigrateTask below, never on service start.
      command: ['node', 'dist/main.js'],
      portMappings: [{ containerPort: 4100 }],
      logging: logging('api'),
      environment: {
        NODE_ENV: 'production',
        API_PORT: '4100',
        WEB_URL: url(hosts.web),
        OIDC_ISSUER: issuer,
        OIDC_AUDIENCE: 'scopeflow-api',
        SMTP_HOST: `email-smtp.${this.region}.amazonaws.com`,
        SMTP_PORT: '587',
        MAIL_FROM: `ScopeFlow <${props.mailFrom}>`,
        ...dbEnv,
      },
      secrets: {
        ...dbSecrets,
        SMTP_USER: ecs.Secret.fromSecretsManager(external, 'SMTP_USER'),
        SMTP_PASS: ecs.Secret.fromSecretsManager(external, 'SMTP_PASS'),
        STRIPE_SECRET_KEY: ecs.Secret.fromSecretsManager(external, 'STRIPE_SECRET_KEY'),
        STRIPE_WEBHOOK_SECRET: ecs.Secret.fromSecretsManager(external, 'STRIPE_WEBHOOK_SECRET'),
        STRIPE_PRICE_PRO: ecs.Secret.fromSecretsManager(external, 'STRIPE_PRICE_PRO'),
        STRIPE_PRICE_AGENCY: ecs.Secret.fromSecretsManager(external, 'STRIPE_PRICE_AGENCY'),
      },
    });

    // One-off tasks: database bootstrap (roles + databases) and Prisma migrations.
    const migrateTask = new ecs.FargateTaskDefinition(this, 'MigrateTask', { cpu: 256, memoryLimitMiB: 512 });
    migrateTask.addContainer('migrate', {
      image: apiImage,
      command: ['node_modules/.bin/prisma', 'migrate', 'deploy'],
      logging: logging('migrate'),
      environment: dbEnv,
      secrets: dbSecrets,
    });

    const bootstrapTask = new ecs.FargateTaskDefinition(this, 'DbBootstrapTask', { cpu: 256, memoryLimitMiB: 512 });
    bootstrapTask.addContainer('bootstrap', {
      image: ecs.ContainerImage.fromRegistry('public.ecr.aws/docker/library/postgres:17-alpine'),
      entryPoint: ['sh', '-c'],
      command: [
        'printf "%s" "$BOOTSTRAP_SQL" > /tmp/bootstrap.sql && psql "host=$PGHOST dbname=postgres sslmode=require" ' +
          '-v owner_password="$OWNER_PASSWORD" -v app_password="$APP_PASSWORD" -v keycloak_password="$KEYCLOAK_PASSWORD" ' +
          '-f /tmp/bootstrap.sql',
      ],
      logging: logging('bootstrap'),
      environment: {
        PGHOST: db.dbInstanceEndpointAddress,
        BOOTSTRAP_SQL: readFileSync(new URL('../../postgres/bootstrap-rds.sql', import.meta.url), 'utf8'),
      },
      secrets: {
        PGUSER: ecs.Secret.fromSecretsManager(db.secret!, 'username'),
        PGPASSWORD: ecs.Secret.fromSecretsManager(db.secret!, 'password'),
        OWNER_PASSWORD: ecs.Secret.fromSecretsManager(dbOwnerPassword),
        APP_PASSWORD: ecs.Secret.fromSecretsManager(dbAppPassword),
        KEYCLOAK_PASSWORD: ecs.Secret.fromSecretsManager(dbKeycloakPassword),
      },
    });

    // Web
    const webTask = new ecs.FargateTaskDefinition(this, 'WebTask', { cpu: 512, memoryLimitMiB: 1024 });
    webTask.addContainer('web', {
      image: ecs.ContainerImage.fromAsset(repoRoot, { file: 'apps/web/Dockerfile' }),
      portMappings: [{ containerPort: 3100 }],
      logging: logging('web'),
      environment: {
        AUTH_URL: url(hosts.web),
        AUTH_TRUST_HOST: 'true',
        AUTH_KEYCLOAK_ID: 'scopeflow-web',
        OIDC_ISSUER: issuer,
        OIDC_INTERNAL_URL: issuer,
        PUBLIC_API_URL: url(hosts.api),
        API_INTERNAL_URL: url(hosts.api),
      },
      secrets: {
        AUTH_SECRET: ecs.Secret.fromSecretsManager(authSecret),
        AUTH_KEYCLOAK_SECRET: ecs.Secret.fromSecretsManager(oidcClientSecret),
      },
    });

    // Keycloak
    const keycloakTask = new ecs.FargateTaskDefinition(this, 'KeycloakTask', { cpu: 1024, memoryLimitMiB: 2048 });
    keycloakTask.addContainer('keycloak', {
      image: ecs.ContainerImage.fromRegistry('quay.io/keycloak/keycloak:26.4'),
      command: ['start', '--optimized=false'],
      portMappings: [{ containerPort: 8080 }, { containerPort: 9000 }],
      logging: logging('keycloak'),
      environment: {
        KC_DB: 'postgres',
        KC_DB_URL: `jdbc:postgresql://${db.dbInstanceEndpointAddress}:5432/keycloak?sslmode=require`,
        KC_DB_USERNAME: 'keycloak',
        KC_HOSTNAME: url(hosts.auth),
        KC_HTTP_ENABLED: 'true',
        KC_PROXY_HEADERS: 'xforwarded',
        KC_HEALTH_ENABLED: 'true',
        KC_BOOTSTRAP_ADMIN_USERNAME: 'admin',
      },
      secrets: {
        KC_DB_PASSWORD: ecs.Secret.fromSecretsManager(dbKeycloakPassword),
        KC_BOOTSTRAP_ADMIN_PASSWORD: ecs.Secret.fromSecretsManager(keycloakAdmin),
      },
    });

    const service = (name: string, task: ecs.FargateTaskDefinition) =>
      new ecs.FargateService(this, name, {
        cluster,
        taskDefinition: task,
        // A single API task: socket.io fan-out is in-process. Scaling out needs the
        // socket.io Redis adapter (ElastiCache); see README tradeoffs.
        desiredCount: 1,
        minHealthyPercent: 100,
        vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        circuitBreaker: { rollback: true },
      });
    const apiService = service('ApiService', apiTask);
    const webService = service('WebService', webTask);
    const keycloakService = service('KeycloakService', keycloakTask);

    for (const svc of [apiService, keycloakService]) db.connections.allowDefaultPortFrom(svc);
    // One-off tasks (migrate, db-bootstrap) run in the app subnets with this security group.
    const tasksSg = new ec2.SecurityGroup(this, 'OneOffTasks', { vpc, description: 'migrate and db-bootstrap tasks' });
    db.connections.allowDefaultPortFrom(tasksSg);

    // --- Load balancer ------------------------------------------------------------
    const alb = new elbv2.ApplicationLoadBalancer(this, 'Alb', {
      vpc,
      internetFacing: true,
      // socket.io pings every 25s, well inside the idle timeout.
      idleTimeout: Duration.seconds(120),
    });
    const listener = https
      ? alb.addListener('Https', {
          port: 443,
          certificates: [acm.Certificate.fromCertificateArn(this, 'Cert', props.certificateArn)],
          defaultAction: elbv2.ListenerAction.fixedResponse(404),
        })
      : alb.addListener('Http', { port: 80, defaultAction: elbv2.ListenerAction.fixedResponse(404) });
    if (https) {
      alb.addListener('HttpRedirect', {
        port: 80,
        defaultAction: elbv2.ListenerAction.redirect({ protocol: 'HTTPS', port: '443', permanent: true }),
      });
    }

    const route = (id: string, priority: number, host: string, svc: ecs.FargateService, port: number, health: string) =>
      listener.addTargets(id, {
        priority,
        conditions: [elbv2.ListenerCondition.hostHeaders([host])],
        port,
        protocol: elbv2.ApplicationProtocol.HTTP,
        targets: [
          svc.loadBalancerTarget({
            containerName: svc.taskDefinition.defaultContainer!.containerName,
            containerPort: port,
          }),
        ],
        healthCheck: { path: health, healthyHttpCodes: '200', interval: Duration.seconds(15) },
        deregistrationDelay: Duration.seconds(15),
      });
    route('Web', 10, hosts.web, webService, 3100, '/');
    route('Api', 20, hosts.api, apiService, 4100, '/health');
    const kc = route('Keycloak', 30, hosts.auth, keycloakService, 8080, '/realms/master');
    kc.configureHealthCheck({ path: '/realms/master', healthyHttpCodes: '200', interval: Duration.seconds(30) });

    // --- Outputs ------------------------------------------------------------------
    new CfnOutput(this, 'LoadBalancerDns', {
      value: alb.loadBalancerDnsName,
      description: `Point ${hosts.web}, ${hosts.api} and ${hosts.auth} here (CNAME/alias)`,
    });
    new CfnOutput(this, 'ClusterName', { value: cluster.clusterName });
    new CfnOutput(this, 'MigrateTaskDefinition', { value: migrateTask.taskDefinitionArn });
    new CfnOutput(this, 'DbBootstrapTaskDefinition', { value: bootstrapTask.taskDefinitionArn });
    new CfnOutput(this, 'OneOffTaskSecurityGroup', { value: tasksSg.securityGroupId });
    new CfnOutput(this, 'AppSubnets', {
      value: vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }).subnetIds.join(','),
    });
    new CfnOutput(this, 'ExternalCredentialsSecret', { value: external.secretName });
    new CfnOutput(this, 'OidcClientSecretArn', { value: oidcClientSecret.secretArn });
  }
}
