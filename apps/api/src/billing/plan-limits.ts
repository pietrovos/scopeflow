import { ForbiddenException, Injectable } from '@nestjs/common';
import { PLAN_INFO } from '@scopeflow/shared';
import type { Tx } from '../db/tenant-db.service.js';

/** Plan quotas, checked inside the same transaction as the write they guard. */
@Injectable()
export class PlanLimits {
  async assertCanCreateProject(tx: Tx, orgId: string) {
    const org = await tx.organization.findUniqueOrThrow({ where: { id: orgId }, select: { plan: true } });
    const max = PLAN_INFO[org.plan].maxActiveProjects;
    if (max === null) return;
    const active = await tx.project.count({ where: { orgId, status: 'ACTIVE' } });
    if (active >= max) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'plan_limit',
        message: `The ${PLAN_INFO[org.plan].name} plan allows ${max} active projects. Upgrade to add more.`,
      });
    }
  }

  /** Team seats = staff members plus pending staff invitations. Clients are free. */
  async assertCanAddSeat(tx: Tx, orgId: string) {
    const org = await tx.organization.findUniqueOrThrow({ where: { id: orgId }, select: { plan: true } });
    const max = PLAN_INFO[org.plan].maxSeats;
    if (max === null) return;
    const [members, pending] = await Promise.all([
      tx.membership.count({ where: { orgId, role: { not: 'CLIENT' } } }),
      tx.invitation.count({
        where: { orgId, role: { not: 'CLIENT' }, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
      }),
    ]);
    if (members + pending >= max) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'plan_limit',
        message: `The ${PLAN_INFO[org.plan].name} plan includes ${max} team seats. Upgrade to invite more teammates.`,
      });
    }
  }
}
