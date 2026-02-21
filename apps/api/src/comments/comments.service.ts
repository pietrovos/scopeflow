import { Injectable, NotFoundException } from '@nestjs/common';
import type { createCommentSchema } from '@scopeflow/shared';
import type { z } from 'zod';
import { TenantDb } from '../db/tenant-db.service.js';
import { ActivityService } from '../activity/activity.service.js';
import type { TenantContext } from '../tenancy/tenant-context.js';

const commentSelect = {
  id: true,
  body: true,
  projectId: true,
  scopeChangeId: true,
  createdAt: true,
  author: { select: { id: true, name: true } },
} as const;

@Injectable()
export class CommentsService {
  constructor(
    private readonly db: TenantDb,
    private readonly activity: ActivityService,
  ) {}

  list(t: TenantContext, projectId: string, scopeChangeId?: string) {
    return this.db.run(t, async (tx) => {
      await tx.project.findUniqueOrThrow({ where: { id: projectId }, select: { id: true } });
      const rows = await tx.comment.findMany({
        where: { projectId, ...(scopeChangeId ? { scopeChangeId } : {}) },
        select: commentSelect,
        orderBy: { createdAt: 'desc' },
        take: 200,
      });
      return rows.reverse();
    });
  }

  /** Any member who can see the project can comment, clients included. */
  create(t: TenantContext, projectId: string, input: z.output<typeof createCommentSchema>) {
    return this.db.run(t, async (tx) => {
      await tx.project.findUniqueOrThrow({ where: { id: projectId }, select: { id: true } });
      if (input.scopeChangeId) {
        // Must be a proposal on this same project (RLS already hides other orgs' rows).
        const sc = await tx.scopeChange.findFirst({
          where: { id: input.scopeChangeId, projectId },
          select: { id: true },
        });
        if (!sc) throw new NotFoundException('Scope change not found');
      }
      const comment = await tx.comment.create({
        data: { orgId: t.orgId, projectId, authorId: t.userId, body: input.body, scopeChangeId: input.scopeChangeId },
        select: commentSelect,
      });
      // The event carries the whole comment so live clients (and clients resyncing from
      // the activity cursor) can render it without another request.
      await this.activity.record(tx, t, {
        type: 'comment.created',
        entityType: 'comment',
        entityId: comment.id,
        projectId,
        data: {
          comment: { ...comment, createdAt: comment.createdAt.toISOString() },
          scopeChangeId: input.scopeChangeId,
        },
      });
      return comment;
    });
  }
}
