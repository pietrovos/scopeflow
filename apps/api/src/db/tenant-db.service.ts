import { Injectable } from '@nestjs/common';
import type { Role } from '@scopeflow/shared';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from './prisma.service.js';

export type Tx = Prisma.TransactionClient;

export interface DbContext {
  userId: string;
  /** Null for user-scoped work outside any organization (e.g. listing my orgs). */
  orgId: string | null;
  role: Role | null;
}

/**
 * The one place tenant context reaches the database. Each call opens a transaction,
 * sets app.org_id / app.user_id / app.role with set_config(..., true) so they are
 * scoped to that transaction (safe with pooled connections), then runs `fn`.
 */
@Injectable()
export class TenantDb {
  constructor(private readonly prisma: PrismaService) {}

  run<T>(ctx: DbContext, fn: (tx: Tx) => Promise<T>, opts?: { timeout?: number }): Promise<T> {
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT
          set_config('app.org_id', ${ctx.orgId ?? ''}, true),
          set_config('app.user_id', ${ctx.userId}, true),
          set_config('app.role', ${ctx.role ?? ''}, true)`;
        return fn(tx);
      },
      { timeout: opts?.timeout ?? 10_000 },
    );
  }
}
