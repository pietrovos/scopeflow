import { Injectable, NotFoundException } from '@nestjs/common';
import type { createMilestoneSchema, updateMilestoneSchema } from '@scopeflow/shared';
import type { z } from 'zod';
import { TenantDb } from '../db/tenant-db.service.js';
import { ActivityService } from '../activity/activity.service.js';
import { VersionConflictException } from '../common/conflict.js';
import type { TenantContext } from '../tenancy/tenant-context.js';

const toDate = (d: string | null | undefined) => (d === undefined ? undefined : d === null ? null : new Date(d));

@Injectable()
export class MilestonesService {
  constructor(
    private readonly db: TenantDb,
    private readonly activity: ActivityService,
  ) {}

  list(t: TenantContext, projectId: string) {
    return this.db.run(t, async (tx) => {
      await tx.project.findUniqueOrThrow({ where: { id: projectId }, select: { id: true } });
      return tx.milestone.findMany({ where: { projectId }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] });
    });
  }

  create(t: TenantContext, projectId: string, input: z.output<typeof createMilestoneSchema>) {
    return this.db.run(t, async (tx) => {
      await tx.project.findUniqueOrThrow({ where: { id: projectId }, select: { id: true } });
      const last = await tx.milestone.aggregate({ where: { projectId }, _max: { position: true } });
      const milestone = await tx.milestone.create({
        data: {
          ...input,
          dueDate: toDate(input.dueDate),
          orgId: t.orgId,
          projectId,
          position: (last._max.position ?? -1) + 1,
        },
      });
      await this.activity.record(tx, t, {
        type: 'milestone.created',
        entityType: 'milestone',
        entityId: milestone.id,
        projectId,
        data: { title: milestone.title },
      });
      return milestone;
    });
  }

  /**
   * Optimistic locking: the UPDATE only matches if the row is still at the version the
   * client read. Zero rows means someone else saved first, so return 409 with the
   * current row and let the user decide.
   */
  update(t: TenantContext, projectId: string, milestoneId: string, input: z.output<typeof updateMilestoneSchema>) {
    const { version, ...changes } = input;
    return this.db.run(t, async (tx) => {
      const { count } = await tx.milestone.updateMany({
        where: { id: milestoneId, projectId, version },
        data: { ...changes, dueDate: toDate(changes.dueDate), version: { increment: 1 } },
      });
      if (count === 0) {
        const current = await tx.milestone.findFirst({ where: { id: milestoneId, projectId } });
        if (!current) throw new NotFoundException('Milestone not found');
        throw new VersionConflictException(current);
      }
      const milestone = await tx.milestone.findUniqueOrThrow({ where: { id: milestoneId } });
      await this.activity.record(tx, t, {
        type: 'milestone.updated',
        entityType: 'milestone',
        entityId: milestone.id,
        projectId,
        data: {
          title: milestone.title,
          fields: Object.keys(changes).filter((k) => changes[k as keyof typeof changes] !== undefined),
          status: changes.status,
          version: milestone.version,
        },
      });
      return milestone;
    });
  }

  /** With `version`, the delete only applies if nobody changed the milestone since it was read. */
  remove(t: TenantContext, projectId: string, milestoneId: string, version?: number) {
    return this.db.run(t, async (tx) => {
      const milestone = await tx.milestone.findFirst({ where: { id: milestoneId, projectId } });
      if (!milestone) throw new NotFoundException('Milestone not found');
      const { count } = await tx.milestone.deleteMany({
        where: { id: milestoneId, ...(version !== undefined ? { version } : {}) },
      });
      if (count === 0) {
        throw new VersionConflictException(milestone, 'This milestone changed since you loaded it.');
      }
      await this.activity.record(tx, t, {
        type: 'milestone.deleted',
        entityType: 'milestone',
        entityId: milestoneId,
        projectId,
        data: { title: milestone.title },
      });
    });
  }
}
