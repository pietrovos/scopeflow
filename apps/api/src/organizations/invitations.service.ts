import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { createInvitationSchema } from '@scopeflow/shared';
import type { z } from 'zod';
import { TenantDb } from '../db/tenant-db.service.js';
import { SystemPrismaService } from '../db/prisma.service.js';
import { ActivityService } from '../activity/activity.service.js';
import { PlanLimits } from '../billing/plan-limits.js';
import { ENV, type Env } from '../config/env.js';
import type { AuthUser } from '../auth/users.service.js';
import type { TenantContext } from '../tenancy/tenant-context.js';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const hash = (token: string) => createHash('sha256').update(token).digest('hex');

const invitationSelect = {
  id: true,
  email: true,
  role: true,
  projectIds: true,
  expiresAt: true,
  createdAt: true,
  invitedBy: { select: { id: true, name: true } },
} as const;

export interface InvitationCreatedEvent {
  orgName: string;
  inviterName: string;
  email: string;
  role: string;
  url: string;
}

export const INVITATION_LISTENER = Symbol('INVITATION_LISTENER');
export type InvitationListener = (event: InvitationCreatedEvent) => Promise<void> | void;

@Injectable()
export class InvitationsService {
  constructor(
    private readonly db: TenantDb,
    private readonly system: SystemPrismaService,
    private readonly activity: ActivityService,
    private readonly limits: PlanLimits,
    @Inject(ENV) private readonly env: Env,
    @Inject(INVITATION_LISTENER) private readonly onCreated: InvitationListener,
  ) {}

  listPending(t: TenantContext) {
    return this.db.run(t, (tx) =>
      tx.invitation.findMany({
        where: { acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
        select: invitationSelect,
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  async create(t: TenantContext, input: z.output<typeof createInvitationSchema>) {
    if (input.role !== 'CLIENT' && input.projectIds.length > 0) {
      throw new BadRequestException('Only client invitations can be limited to projects');
    }
    const token = randomBytes(32).toString('base64url');
    const url = `${this.env.WEB_URL}/invitations/${token}`;

    const { invitation, orgName, inviterName } = await this.db.run(t, async (tx) => {
      const existingMember = await tx.membership.findFirst({
        where: { orgId: t.orgId, user: { email: input.email } },
      });
      if (existingMember) throw new ConflictException(`${input.email} is already a member`);

      if (input.projectIds.length > 0) {
        const found = await tx.project.count({ where: { id: { in: input.projectIds } } });
        if (found !== new Set(input.projectIds).size) throw new NotFoundException('Project not found');
      }

      // One live invitation per email: re-inviting replaces the old link.
      await tx.invitation.updateMany({
        where: { email: input.email, acceptedAt: null, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      if (input.role !== 'CLIENT') await this.limits.assertCanAddSeat(tx, t.orgId);

      const invitation = await tx.invitation.create({
        data: {
          orgId: t.orgId,
          email: input.email,
          role: input.role,
          projectIds: [...new Set(input.projectIds)],
          tokenHash: hash(token),
          invitedById: t.userId,
          expiresAt: new Date(Date.now() + INVITE_TTL_MS),
        },
        select: invitationSelect,
      });
      await this.activity.record(tx, t, {
        type: 'member.invited',
        entityType: 'invitation',
        entityId: invitation.id,
        data: { email: input.email, role: input.role },
      });
      const org = await tx.organization.findUniqueOrThrow({ where: { id: t.orgId }, select: { name: true } });
      return { invitation, orgName: org.name, inviterName: invitation.invitedBy.name };
    });

    await this.onCreated({ orgName, inviterName, email: input.email, role: input.role, url });
    // The link is returned so an admin can share it directly; it is never stored.
    return { ...invitation, url };
  }

  revoke(t: TenantContext, invitationId: string) {
    return this.db.run(t, async (tx) => {
      const { count } = await tx.invitation.updateMany({
        where: { id: invitationId, acceptedAt: null, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (count === 0) throw new NotFoundException('Invitation not found');
    });
  }

  /** Public preview for the invite landing page. System path: the viewer is not a member. */
  async preview(token: string) {
    const inv = await this.system.invitation.findUnique({
      where: { tokenHash: hash(token) },
      select: {
        email: true,
        role: true,
        expiresAt: true,
        acceptedAt: true,
        revokedAt: true,
        org: { select: { name: true } },
        invitedBy: { select: { name: true } },
      },
    });
    if (!inv || inv.revokedAt) throw new NotFoundException('This invitation is not valid');
    return {
      orgName: inv.org.name,
      inviterName: inv.invitedBy.name,
      email: inv.email,
      role: inv.role,
      status: inv.acceptedAt ? 'accepted' : inv.expiresAt < new Date() ? 'expired' : 'pending',
    };
  }

  /** System path: the invitee has no membership yet, so RLS would hide the invitation. */
  async accept(token: string, user: AuthUser) {
    const result = await this.system.$transaction(async (tx) => {
      const inv = await tx.invitation.findUnique({ where: { tokenHash: hash(token) } });
      if (!inv || inv.revokedAt) throw new NotFoundException('This invitation is not valid');
      if (inv.acceptedAt) throw new GoneException('This invitation has already been used');
      if (inv.expiresAt < new Date()) throw new GoneException('This invitation has expired');
      if (inv.email.toLowerCase() !== user.email.toLowerCase()) {
        throw new ForbiddenException(`This invitation was sent to ${inv.email}. Sign in with that address.`);
      }

      const existing = await tx.membership.findUnique({
        where: { orgId_userId: { orgId: inv.orgId, userId: user.id } },
      });
      if (existing) throw new ConflictException('You are already a member of this organization');

      // Optimistic claim: a second concurrent accept finds acceptedAt already set.
      const claimed = await tx.invitation.updateMany({
        where: { id: inv.id, acceptedAt: null },
        data: { acceptedAt: new Date() },
      });
      if (claimed.count === 0) throw new GoneException('This invitation has already been used');

      await tx.membership.create({ data: { orgId: inv.orgId, userId: user.id, role: inv.role } });
      if (inv.role === 'CLIENT' && inv.projectIds.length > 0) {
        const projects = await tx.project.findMany({
          where: { id: { in: inv.projectIds }, orgId: inv.orgId },
          select: { id: true },
        });
        await tx.projectAssignment.createMany({
          data: projects.map((p) => ({ orgId: inv.orgId, projectId: p.id, userId: user.id })),
          skipDuplicates: true,
        });
      }
      const event = await tx.activityEvent.create({
        data: {
          orgId: inv.orgId,
          actorId: user.id,
          type: 'member.joined',
          entityType: 'membership',
          entityId: user.id,
          data: { userName: user.name, role: inv.role },
        },
        include: ActivityService.include,
      });
      return { orgId: inv.orgId, role: inv.role, event };
    });
    this.activity.publishCommitted([result.event]);
    return { orgId: result.orgId, role: result.role };
  }
}
