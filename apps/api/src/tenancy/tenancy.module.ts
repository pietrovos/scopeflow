import { Global, Module } from '@nestjs/common';
import { TenantGuard } from './tenant.guard.js';

@Global()
@Module({ providers: [TenantGuard], exports: [TenantGuard] })
export class TenancyModule {}
