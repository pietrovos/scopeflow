import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { CreateOrganizationInput } from '@scopeflow/shared';
import { TenantDb } from '../db/tenant-db.service.js';
import { ActivityService } from '../activity/activity.service.js';
import type { AuthUser } from '../auth/users.service.js';
import type { TenantContext } from '../tenancy/tenant-context.js';

const orgSelect = {
  id: true,
  name: true,
  slug: true,
  plan: true,
  subscriptionStatus: true,
  currentPeriodEnd: true,
  createdAt: true,
} as const;

export function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return `${base || 'org'}-${randomUUID().slice(0, 6)}`;
}

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly db: TenantDb,
    private readonly activity: ActivityService,
  ) {}

  /** Orgs the user belongs to. RLS shows a user their own memberships in any org. */
  listForUser(user: AuthUser) {
    return this.db.run({ userId: user.id, orgId: null, role: null }, async (tx) => {
      const memberships = await tx.membership.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'asc' },
        select: { role: true, org: { select: orgSelect } },
      });
      return memberships.map((m) => ({ ...m.org, role: m.role }));
    });
  }

  create(user: AuthUser, input: CreateOrganizationInput) {
    const ctx = { orgId: randomUUID(), userId: user.id, role: 'OWNER' as const };
    return this.db.run(ctx, async (tx) => {
      const org = await tx.organization.create({
        data: { id: ctx.orgId, name: input.name, slug: slugify(input.name) },
        select: orgSelect,
      });
      await tx.membership.create({ data: { orgId: org.id, userId: user.id, role: 'OWNER' } });
      await this.activity.record(tx, ctx, {
        type: 'org.created',
        entityType: 'organization',
        entityId: org.id,
        data: { name: org.name },
      });
      return { ...org, role: ctx.role };
    });
  }

  get(t: TenantContext) {
    return this.db.run(t, async (tx) => {
      const org = await tx.organization.findUniqueOrThrow({ where: { id: t.orgId }, select: orgSelect });
      return { ...org, role: t.role };
    });
  }

  rename(t: TenantContext, name: string) {
    return this.db.run(t, async (tx) => {
      const org = await tx.organization.update({ where: { id: t.orgId }, data: { name }, select: orgSelect });
      return { ...org, role: t.role };
    });
  }
}
