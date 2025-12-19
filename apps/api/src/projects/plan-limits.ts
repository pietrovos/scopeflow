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
}
