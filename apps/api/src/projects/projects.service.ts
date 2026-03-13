import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { isStaff, type createProjectSchema, type updateProjectSchema } from '@scopeflow/shared';
import type { z } from 'zod';
import { TenantDb } from '../db/tenant-db.service.js';
import { ActivityService } from '../activity/activity.service.js';
import type { TenantContext } from '../tenancy/tenant-context.js';
import { PlanLimits } from '../billing/plan-limits.js';

const toDate = (d: string | null | undefined) => (d === undefined ? undefined : d === null ? null : new Date(d));

@Injectable()
export class ProjectsService {
  constructor(
    private readonly db: TenantDb,
    private readonly activity: ActivityService,
    private readonly limits: PlanLimits,
  ) {}

  list(t: TenantContext) {
    return this.db.run(t, async (tx) => {
      const projects = await tx.project.findMany({
        orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
        include: {
          _count: { select: { scopeChanges: { where: { status: 'PENDING' } } } },
          milestones: { select: { status: true } },
        },
      });
      return projects.map(({ milestones, _count, ...p }) => ({
        ...p,
        milestoneCount: milestones.length,
        milestonesDone: milestones.filter((m) => m.status === 'DONE').length,
        pendingScopeChanges: _count.scopeChanges,
      }));
    });
  }

  get(t: TenantContext, projectId: string) {
    return this.db.run(t, async (tx) => {
      const project = await tx.project.findUnique({
        where: { id: projectId },
        include: {
          milestones: { orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] },
          // Staff see every assigned client; RLS limits a client to their own row.
          assignments: { select: { user: { select: { id: true, name: true, email: true } } } },
        },
      });
      if (!project) throw new NotFoundException('Project not found');
      const [approved, pending] = await Promise.all([
        tx.scopeChangeRevision.aggregate({
          where: { approvedOf: { projectId } },
          _sum: { priceDeltaCents: true, deadlineDeltaDays: true },
          _count: true,
        }),
        tx.scopeChange.count({ where: { projectId, status: 'PENDING' } }),
      ]);
      const { assignments, ...rest } = project;
      return {
        ...rest,
        clients: assignments.map((a) => a.user),
        viewerRole: t.role,
        canEdit: isStaff(t.role),
        scope: {
          approvedCount: approved._count,
          approvedPriceDeltaCents: approved._sum.priceDeltaCents ?? 0,
          approvedDeadlineDeltaDays: approved._sum.deadlineDeltaDays ?? 0,
          pendingCount: pending,
        },
      };
    });
  }

  create(t: TenantContext, input: z.output<typeof createProjectSchema>) {
    return this.db.run(t, async (tx) => {
      await this.limits.assertCanCreateProject(tx, t.orgId);
      const project = await tx.project.create({
        data: { ...input, dueDate: toDate(input.dueDate), orgId: t.orgId },
      });
      await this.activity.record(tx, t, {
        type: 'project.created',
        entityType: 'project',
        entityId: project.id,
        projectId: project.id,
        data: { name: project.name },
      });
      return project;
    });
  }

  update(t: TenantContext, projectId: string, input: z.output<typeof updateProjectSchema>) {
    return this.db.run(t, async (tx) => {
      const before = await tx.project.findUnique({ where: { id: projectId } });
      if (!before) throw new NotFoundException('Project not found');
      if (input.status === 'ACTIVE' && before.status !== 'ACTIVE') {
        await this.limits.assertCanCreateProject(tx, t.orgId);
      }
      const project = await tx.project.update({
        where: { id: projectId },
        data: { ...input, dueDate: toDate(input.dueDate) },
      });
      const changed = (Object.keys(input) as (keyof typeof input)[]).filter(
        (k) => input[k] !== undefined && String(before[k]) !== String(project[k]),
      );
      if (changed.length > 0) {
        await this.activity.record(tx, t, {
          type: 'project.updated',
          entityType: 'project',
          entityId: project.id,
          projectId: project.id,
          data: { name: project.name, fields: changed, status: input.status },
        });
      }
      return project;
    });
  }

  listClients(t: TenantContext, projectId: string) {
    return this.db.run(t, async (tx) => {
      await tx.project.findUniqueOrThrow({ where: { id: projectId }, select: { id: true } });
      const assignments = await tx.projectAssignment.findMany({
        where: { projectId },
        select: { createdAt: true, user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'asc' },
      });
      return assignments.map((a) => ({ ...a.user, assignedAt: a.createdAt }));
    });
  }

  assignClient(t: TenantContext, projectId: string, userId: string) {
    return this.db.run(t, async (tx) => {
      const project = await tx.project.findUniqueOrThrow({ where: { id: projectId }, select: { name: true } });
      const membership = await tx.membership.findUnique({
        where: { orgId_userId: { orgId: t.orgId, userId } },
        include: { user: { select: { name: true } } },
      });
      if (!membership) throw new NotFoundException('Member not found');
      if (membership.role !== 'CLIENT') {
        throw new BadRequestException('Only client members are assigned to projects; staff see every project');
      }
      await tx.projectAssignment.upsert({
        where: { projectId_userId: { projectId, userId } },
        update: {},
        create: { orgId: t.orgId, projectId, userId },
      });
      await this.activity.record(tx, t, {
        type: 'project.client_assigned',
        entityType: 'project',
        entityId: projectId,
        projectId,
        data: { name: project.name, userName: membership.user.name },
      });
    });
  }

  unassignClient(t: TenantContext, projectId: string, userId: string) {
    return this.db.run(t, async (tx) => {
      const project = await tx.project.findUniqueOrThrow({ where: { id: projectId }, select: { name: true } });
      const { count } = await tx.projectAssignment.deleteMany({ where: { projectId, userId } });
      if (count === 0) throw new NotFoundException('Assignment not found');
      await this.activity.record(tx, t, {
        type: 'project.client_unassigned',
        entityType: 'project',
        entityId: projectId,
        projectId,
        data: { name: project.name },
      });
    });
  }
}
