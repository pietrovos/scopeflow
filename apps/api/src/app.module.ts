import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ConfigModule } from './config/config.module.js';
import { DbModule } from './db/db.module.js';
import { AuthModule } from './auth/auth.module.js';
import { AuthGuard } from './auth/auth.guard.js';
import { TenancyModule } from './tenancy/tenancy.module.js';
import { TenantGuard } from './tenancy/tenant.guard.js';
import { PrismaExceptionFilter } from './common/prisma-exception.filter.js';
import { ActivityModule } from './activity/activity.module.js';
import { OrganizationsModule } from './organizations/organizations.module.js';
import { ProjectsModule } from './projects/projects.module.js';
import { MilestonesModule } from './milestones/milestones.module.js';
import { ScopeChangesModule } from './scope-changes/scope-changes.module.js';
import { MailModule } from './mail/mail.module.js';
import { HealthController } from './health/health.controller.js';

@Module({
  imports: [
    ConfigModule,
    DbModule,
    MailModule,
    AuthModule,
    TenancyModule,
    ActivityModule,
    OrganizationsModule,
    ProjectsModule,
    MilestonesModule,
    ScopeChangesModule,
  ],
  controllers: [HealthController],
  providers: [
    // Order matters: authenticate first, then resolve the tenant from :orgId.
    { provide: APP_GUARD, useExisting: AuthGuard },
    { provide: APP_GUARD, useExisting: TenantGuard },
    { provide: APP_FILTER, useClass: PrismaExceptionFilter },
  ],
})
export class AppModule {}
