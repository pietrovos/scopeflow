import { Global, Module } from '@nestjs/common';
import { PrismaService, SystemPrismaService } from './prisma.service.js';
import { TenantDb } from './tenant-db.service.js';

@Global()
@Module({
  providers: [PrismaService, SystemPrismaService, TenantDb],
  exports: [PrismaService, SystemPrismaService, TenantDb],
})
export class DbModule {}
