import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  DecideScopeChangeInput,
  ReviseScopeChangeInput,
  ScopeChangeContent,
  decideScopeChangeSchema,
} from '@scopeflow/shared';
import type { z } from 'zod';
import { TenantDb, type Tx } from '../db/tenant-db.service.js';
import { ActivityService } from '../activity/activity.service.js';
import { VersionConflictException } from '../common/conflict.js';
import { Prisma, type ScopeChangeStatus } from '../generated/prisma/client.js';
import type { TenantContext } from '../tenancy/tenant-context.js';
import { ScopeChangeEvents } from './scope-change.events.js';

const person = { select: { id: true, name: true } } as const;
const revisionSelect = {
  id: true,
  revisionNumber: true,
  title: true,
  description: true,
  priceDeltaCents: true,
  deadlineDeltaDays: true,
  createdAt: true,
  createdBy: person,
} as const;

const summaryInclude = {
  currentRevision: { select: revisionSelect },
  createdBy: person,
  project: { select: { id: true, name: true, clientName: true } },
} as const;

const detailInclude = {
  ...summaryInclude,
  revisions: { select: revisionSelect, orderBy: { revisionNumber: 'asc' } },
  decisions: {
    select: { id: true, revisionId: true, decision: true, note: true, createdAt: true, decidedBy: person },
    orderBy: { createdAt: 'asc' },
  },
} as const;

export type ScopeChangeDetail = Prisma.ScopeChangeGetPayload<{ include: typeof detailInclude }>;

@Injectable()
export class ScopeChangesService {
  constructor(
    private readonly db: TenantDb,
    private readonly activity: ActivityService,
    private readonly events: ScopeChangeEvents,
  ) {}

  /** Approval inbox: org-wide, filtered to the caller's visible projects by RLS. */
  inbox(t: TenantContext, status?: ScopeChangeStatus) {
    return this.db.run(t, (tx) =>
      tx.scopeChange.findMany({
        where: status ? { status } : {},
        include: summaryInclude,
        orderBy: [{ updatedAt: 'desc' }],
        take: 100,
      }),
    );
  }

  listForProject(t: TenantContext, projectId: string) {
    return this.db.run(t, async (tx) => {
      await tx.project.findUniqueOrThrow({ where: { id: projectId }, select: { id: true } });
      return tx.scopeChange.findMany({
        where: { projectId },
        include: summaryInclude,
        orderBy: { number: 'desc' },
      });
    });
  }

  get(t: TenantContext, projectId: string, scopeChangeId: string) {
    return this.db.run(t, (tx) => this.load(tx, projectId, scopeChangeId));
  }

  create(t: TenantContext, projectId: string, input: ScopeChangeContent) {
    return this.db.run(t, async (tx) => {
      const project = await tx.project.findUnique({ where: { id: projectId }, select: { id: true, name: true } });
      if (!project) throw new NotFoundException('Project not found');

      // Per-project numbering (SC-1, SC-2...). Serialize creators on the project row so
      // two concurrent proposals cannot both take the same number.
      await tx.$executeRaw`SELECT 1 FROM projects WHERE id = ${projectId}::uuid FOR UPDATE`;
      const last = await tx.scopeChange.aggregate({ where: { projectId }, _max: { number: true } });

      const sc = await tx.scopeChange.create({
        data: { orgId: t.orgId, projectId, number: (last._max.number ?? 0) + 1, createdById: t.userId },
      });
      const revision = await tx.scopeChangeRevision.create({
        data: { ...input, orgId: t.orgId, scopeChangeId: sc.id, revisionNumber: 1, createdById: t.userId },
      });
      await tx.scopeChange.update({ where: { id: sc.id }, data: { currentRevisionId: revision.id } });

      await this.activity.record(tx, t, {
        type: 'scope_change.created',
        entityType: 'scope_change',
        entityId: sc.id,
        projectId,
        data: {
          number: sc.number,
          title: input.title,
          priceDeltaCents: input.priceDeltaCents,
          revisionId: revision.id,
        },
      });
      const detail = await this.load(tx, projectId, sc.id);
      TenantDb.afterCommit(() => this.events.submitted(t, detail, project.name, 1));
      return detail;
    });
  }

  /**
   * Editing never touches an existing revision: it appends revision N+1 and points the
   * proposal at it. The proposal's `version` guards against two people revising at once.
   */
  revise(t: TenantContext, projectId: string, scopeChangeId: string, input: ReviseScopeChangeInput) {
    const { version, ...content } = input;
    return this.db.run(t, async (tx) => {
      const sc = await this.load(tx, projectId, scopeChangeId);
      if (sc.version !== version) throw new VersionConflictException(sc, 'This proposal was revised by someone else.');
      if (sc.status === 'APPROVED') {
        throw new ConflictException({
          statusCode: 409,
          error: 'already_approved',
          message: 'Approved proposals are final. Create a new scope change instead.',
        });
      }
      if (sc.status === 'WITHDRAWN') throw new BadRequestException('This proposal was withdrawn');

      const latest = sc.revisions.at(-1)!;
      if (
        latest.title === content.title &&
        latest.description === content.description &&
        latest.priceDeltaCents === content.priceDeltaCents &&
        latest.deadlineDeltaDays === content.deadlineDeltaDays
      ) {
        throw new BadRequestException('Nothing changed since the current revision');
      }

      const revision = await tx.scopeChangeRevision.create({
        data: {
          ...content,
          orgId: t.orgId,
          scopeChangeId,
          revisionNumber: latest.revisionNumber + 1,
          createdById: t.userId,
        },
      });
      // Conditional on version: if another revise committed between our read and this
      // write, zero rows match and the whole transaction rolls back.
      const { count } = await tx.scopeChange.updateMany({
        where: { id: scopeChangeId, version },
        data: { currentRevisionId: revision.id, status: 'PENDING', version: { increment: 1 } },
      });
      if (count === 0) throw new VersionConflictException(await this.load(tx, projectId, scopeChangeId));

      await this.activity.record(tx, t, {
        type: 'scope_change.revised',
        entityType: 'scope_change',
        entityId: scopeChangeId,
        projectId,
        data: {
          number: sc.number,
          title: content.title,
          revisionNumber: revision.revisionNumber,
          revisionId: revision.id,
          reopened: sc.status === 'REJECTED',
        },
      });
      const detail = await this.load(tx, projectId, scopeChangeId);
      TenantDb.afterCommit(() => this.events.submitted(t, detail, detail.project.name, revision.revisionNumber));
      return detail;
    });
  }

  /**
   * A client approves or rejects one specific revision. If that revision is no longer
   * the current one (the agency revised it while the client was reading), the decision
   * is refused with 409 and the client is shown the new revision.
   */
  decide(t: TenantContext, projectId: string, scopeChangeId: string, input: z.output<typeof decideScopeChangeSchema>) {
    return this.db.run(t, async (tx) => {
      const sc = await this.load(tx, projectId, scopeChangeId);
      const revision = sc.revisions.find((r) => r.id === input.revisionId);
      if (!revision) throw new NotFoundException('Revision not found');
      if (sc.status !== 'PENDING') {
        throw new ConflictException({
          statusCode: 409,
          error: 'not_pending',
          message: `This proposal is already ${sc.status.toLowerCase()}.`,
          current: sc,
        });
      }

      const status = input.decision === 'APPROVED' ? 'APPROVED' : 'REJECTED';
      const { count } = await tx.scopeChange.updateMany({
        where: { id: scopeChangeId, status: 'PENDING', currentRevisionId: input.revisionId },
        data: {
          status,
          approvedRevisionId: status === 'APPROVED' ? input.revisionId : null,
          version: { increment: 1 },
        },
      });
      if (count === 0) {
        throw new ConflictException({
          statusCode: 409,
          error: 'revision_superseded',
          message: `Revision ${revision.revisionNumber} is no longer current. Review the latest revision before deciding.`,
          current: await this.load(tx, projectId, scopeChangeId),
        });
      }

      await tx.scopeChangeDecision.create({
        data: {
          orgId: t.orgId,
          scopeChangeId,
          revisionId: input.revisionId,
          decision: input.decision,
          note: input.note,
          decidedById: t.userId,
        },
      });
      await this.activity.record(tx, t, {
        type: status === 'APPROVED' ? 'scope_change.approved' : 'scope_change.rejected',
        entityType: 'scope_change',
        entityId: scopeChangeId,
        projectId,
        data: {
          number: sc.number,
          title: revision.title,
          revisionNumber: revision.revisionNumber,
          revisionId: revision.id,
          priceDeltaCents: revision.priceDeltaCents,
          deadlineDeltaDays: revision.deadlineDeltaDays,
          note: input.note || undefined,
        },
      });
      const detail = await this.load(tx, projectId, scopeChangeId);
      TenantDb.afterCommit(() => this.events.decided(t, detail, input as DecideScopeChangeInput));
      return detail;
    });
  }

  withdraw(t: TenantContext, projectId: string, scopeChangeId: string, version: number) {
    return this.db.run(t, async (tx) => {
      const sc = await this.load(tx, projectId, scopeChangeId);
      if (sc.status === 'APPROVED') throw new BadRequestException('Approved proposals cannot be withdrawn');
      const { count } = await tx.scopeChange.updateMany({
        where: { id: scopeChangeId, version, status: { in: ['PENDING', 'REJECTED'] } },
        data: { status: 'WITHDRAWN', version: { increment: 1 } },
      });
      if (count === 0) throw new VersionConflictException(sc);
      await this.activity.record(tx, t, {
        type: 'scope_change.withdrawn',
        entityType: 'scope_change',
        entityId: scopeChangeId,
        projectId,
        data: { number: sc.number, title: sc.currentRevision?.title },
      });
      return this.load(tx, projectId, scopeChangeId);
    });
  }

  private async load(tx: Tx, projectId: string, scopeChangeId: string): Promise<ScopeChangeDetail> {
    const sc = await tx.scopeChange.findFirst({ where: { id: scopeChangeId, projectId }, include: detailInclude });
    if (!sc) throw new NotFoundException('Scope change not found');
    return sc;
  }
}
