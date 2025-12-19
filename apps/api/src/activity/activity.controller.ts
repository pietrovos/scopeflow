import { Controller, Get, Param, Query } from '@nestjs/common';
import { activityQuerySchema } from '@scopeflow/shared';
import type { z } from 'zod';
import { ZodPipe } from '../common/zod.pipe.js';
import { UuidPipe } from '../common/uuid.pipe.js';
import { TenantDb } from '../db/tenant-db.service.js';
import { StaffOnly } from '../tenancy/roles.decorator.js';
import { Tenant } from '../tenancy/tenant.decorator.js';
import type { TenantContext } from '../tenancy/tenant-context.js';
import { ActivityService, toActivityDto } from './activity.service.js';

type ActivityQuery = z.infer<typeof activityQuerySchema>;

@Controller('orgs/:orgId')
export class ActivityController {
  constructor(private readonly db: TenantDb) {}

  /** Org-wide audit log, newest first. Page backwards with ?before=<seq>. */
  @StaffOnly()
  @Get('activity')
  async auditLog(@Tenant() t: TenantContext, @Query(new ZodPipe(activityQuerySchema)) q: ActivityQuery) {
    const rows = await this.db.run(t, (tx) =>
      tx.activityEvent.findMany({
        where: q.before ? { seq: { lt: q.before } } : {},
        orderBy: { seq: 'desc' },
        take: q.limit,
        include: ActivityService.include,
      }),
    );
    return { items: rows.map(toActivityDto), nextBefore: rows.length === q.limit ? rows.at(-1)!.seq.toString() : null };
  }

  /**
   * Project feed. Without a cursor: the newest page, newest first. With ?after=<seq>:
   * everything after that cursor in ascending order, which is what a reconnecting
   * socket client uses to catch up on missed events.
   */
  @Get('projects/:projectId/activity')
  async projectFeed(
    @Tenant() t: TenantContext,
    @Param('projectId', UuidPipe) projectId: string,
    @Query(new ZodPipe(activityQuerySchema)) q: ActivityQuery,
  ) {
    return this.db.run(t, async (tx) => {
      await tx.project.findUniqueOrThrow({ where: { id: projectId }, select: { id: true } });
      if (q.after !== undefined) {
        const rows = await tx.activityEvent.findMany({
          where: { projectId, seq: { gt: q.after } },
          orderBy: { seq: 'asc' },
          take: q.limit,
          include: ActivityService.include,
        });
        return { items: rows.map(toActivityDto), hasMore: rows.length === q.limit };
      }
      const rows = await tx.activityEvent.findMany({
        where: { projectId, ...(q.before ? { seq: { lt: q.before } } : {}) },
        orderBy: { seq: 'desc' },
        take: q.limit,
        include: ActivityService.include,
      });
      return { items: rows.map(toActivityDto), hasMore: rows.length === q.limit };
    });
  }
}
