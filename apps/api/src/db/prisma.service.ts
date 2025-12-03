import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { ENV, type Env } from '../config/env.js';

/**
 * Connects as `scopeflow_app`. Row-level security applies to every query, so this
 * client sees nothing unless it runs inside TenantDb.run(), which sets the context.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(@Inject(ENV) env: Env) {
    super({ adapter: new PrismaPg({ connectionString: env.DATABASE_URL }) });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

/**
 * Connects as the schema owner, which bypasses row-level security. Only for the system
 * paths listed in ./README.md. Anything tenant-facing must use TenantDb instead.
 */
@Injectable()
export class SystemPrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(@Inject(ENV) env: Env) {
    super({ adapter: new PrismaPg({ connectionString: env.DATABASE_OWNER_URL, max: 4 }) });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
