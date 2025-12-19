import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable, Logger } from '@nestjs/common';
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

const afterCommitHooks = new AsyncLocalStorage<Array<() => void | Promise<void>>>();

/**
 * The one place tenant context reaches the database. Each call opens a transaction,
 * sets app.org_id / app.user_id / app.role with set_config(..., true) so they are
 * scoped to that transaction (safe with pooled connections), then runs `fn`.
 */
@Injectable()
export class TenantDb {
  private readonly logger = new Logger(TenantDb.name);

  constructor(private readonly prisma: PrismaService) {}

  async run<T>(ctx: DbContext, fn: (tx: Tx) => Promise<T>, opts?: { timeout?: number }): Promise<T> {
    const hooks: Array<() => void | Promise<void>> = [];
    const result = await afterCommitHooks.run(hooks, () =>
      this.prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`SELECT
            set_config('app.org_id', ${ctx.orgId ?? ''}, true),
            set_config('app.user_id', ${ctx.userId}, true),
            set_config('app.role', ${ctx.role ?? ''}, true)`;
          return fn(tx);
        },
        { timeout: opts?.timeout ?? 10_000 },
      ),
    );
    for (const hook of hooks) {
      try {
        await hook();
      } catch (err) {
        this.logger.error('after-commit hook failed', err);
      }
    }
    return result;
  }

  /**
   * Runs `fn` once the surrounding run() commits; dropped if it rolls back. Used for
   * side effects that must not describe uncommitted state: socket broadcasts, email.
   */
  static afterCommit(fn: () => void | Promise<void>) {
    const hooks = afterCommitHooks.getStore();
    if (!hooks) throw new Error('afterCommit() called outside TenantDb.run()');
    hooks.push(fn);
  }
}
