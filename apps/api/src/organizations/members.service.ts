import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import type { Role } from '@scopeflow/shared';
import { TenantDb } from '../db/tenant-db.service.js';
import { ActivityService } from '../activity/activity.service.js';
import type { TenantContext } from '../tenancy/tenant-context.js';

const memberSelect = {
  id: true,
  role: true,
  createdAt: true,
  user: { select: { id: true, name: true, email: true } },
} as const;

@Injectable()
export class MembersService {
  constructor(
    private readonly db: TenantDb,
    private readonly activity: ActivityService,
  ) {}

  list(t: TenantContext) {
    return this.db.run(t, (tx) =>
      tx.membership.findMany({ select: memberSelect, orderBy: [{ role: 'asc' }, { createdAt: 'asc' }] }),
    );
  }

  changeRole(t: TenantContext, membershipId: string, role: Exclude<Role, 'OWNER'>) {
    return this.db.run(t, async (tx) => {
      const target = await tx.membership.findUniqueOrThrow({ where: { id: membershipId } });
      this.assertManageable(t, target);
      const updated = await tx.membership.update({
        where: { id: membershipId },
        data: { role },
        select: memberSelect,
      });
      if (target.role === 'CLIENT' && role !== 'CLIENT') {
        // Staff see every project; per-project assignments no longer mean anything.
        await tx.projectAssignment.deleteMany({ where: { userId: target.userId } });
      }
      await this.activity.record(tx, t, {
        type: 'member.role_changed',
        entityType: 'membership',
        entityId: membershipId,
        data: { userName: updated.user.name, from: target.role, to: role },
      });
      return updated;
    });
  }

  remove(t: TenantContext, membershipId: string) {
    return this.db.run(t, async (tx) => {
      const target = await tx.membership.findUniqueOrThrow({
        where: { id: membershipId },
        include: { user: { select: { name: true } } },
      });
      this.assertManageable(t, target);
      await tx.projectAssignment.deleteMany({ where: { userId: target.userId } });
      await tx.membership.delete({ where: { id: membershipId } });
      await this.activity.record(tx, t, {
        type: 'member.removed',
        entityType: 'membership',
        entityId: membershipId,
        data: { userName: target.user.name, role: target.role },
      });
    });
  }

  private assertManageable(t: TenantContext, target: { role: Role; userId: string }) {
    if (target.role === 'OWNER') throw new ForbiddenException('The owner cannot be changed or removed');
    if (target.userId === t.userId) throw new BadRequestException('You cannot change your own membership');
    if (t.role === 'ADMIN' && target.role === 'ADMIN') {
      throw new ForbiddenException('Only the owner can change other admins');
    }
  }
}
