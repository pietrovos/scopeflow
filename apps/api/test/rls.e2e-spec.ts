import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaService } from '../src/db/prisma.service.js';
import { TenantDb } from '../src/db/tenant-db.service.js';
import { loadEnv } from '../src/config/env.js';
import { ownerDb, resetDatabase } from './support/db.js';

// Database-level guarantees, tested without the HTTP layer. The API-level
// cross-tenant sweep lives in tenant-isolation.e2e-spec.ts.
describe('row-level security', () => {
  const env = loadEnv();
  const prisma = new PrismaService(env);
  const db = new TenantDb(prisma);
  const orgA = randomUUID();
  const orgB = randomUUID();
  const userA = randomUUID();
  let projectA: string;
  let projectB: string;

  beforeEach(async () => {
    await resetDatabase();
    await ownerDb.user.create({ data: { id: userA, email: 'a@example.test', name: 'A' } });
    await ownerDb.organization.createMany({
      data: [
        { id: orgA, name: 'A', slug: 'a' },
        { id: orgB, name: 'B', slug: 'b' },
      ],
    });
    projectA = (await ownerDb.project.create({ data: { orgId: orgA, name: 'PA', clientName: 'c' } })).id;
    projectB = (await ownerDb.project.create({ data: { orgId: orgB, name: 'PB', clientName: 'c' } })).id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('sees nothing without tenant context', async () => {
    expect(await prisma.project.count()).toBe(0);
  });

  it('only sees the current org', async () => {
    const names = await db.run({ orgId: orgA, userId: userA, role: 'MEMBER' }, (tx) =>
      tx.project.findMany({ select: { name: true } }),
    );
    expect(names).toEqual([{ name: 'PA' }]);
  });

  it('cannot update or delete another org row, even by primary key', async () => {
    const ctx = { orgId: orgA, userId: userA, role: 'OWNER' as const };
    const updated = await db.run(ctx, (tx) =>
      tx.project.updateMany({ where: { id: projectB }, data: { name: 'pwned' } }),
    );
    const deleted = await db.run(ctx, (tx) => tx.project.deleteMany({ where: { id: projectB } }));
    expect(updated.count).toBe(0);
    expect(deleted.count).toBe(0);
    expect((await ownerDb.project.findUniqueOrThrow({ where: { id: projectB } })).name).toBe('PB');
  });

  it('rejects inserting a row into another org', async () => {
    await expect(
      db.run({ orgId: orgA, userId: userA, role: 'OWNER' }, (tx) =>
        tx.project.create({ data: { orgId: orgB, name: 'x', clientName: 'c' } }),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it('rejects child rows that point at another org project', async () => {
    await expect(
      db.run({ orgId: orgA, userId: userA, role: 'OWNER' }, (tx) =>
        tx.milestone.create({ data: { orgId: orgA, projectId: projectB, title: 'x' } }),
      ),
    ).rejects.toThrow(/Foreign key constraint violated|does not belong to org/);
  });

  it('limits clients to assigned projects', async () => {
    const second = await ownerDb.project.create({ data: { orgId: orgA, name: 'PA2', clientName: 'c' } });
    await ownerDb.projectAssignment.create({ data: { orgId: orgA, projectId: second.id, userId: userA } });
    const visible = await db.run({ orgId: orgA, userId: userA, role: 'CLIENT' }, (tx) =>
      tx.project.findMany({ select: { id: true } }),
    );
    expect(visible).toEqual([{ id: second.id }]);
    expect(projectA).not.toBe(second.id);
  });

  it('does not leak context between pooled transactions', async () => {
    await db.run({ orgId: orgA, userId: userA, role: 'OWNER' }, (tx) => tx.project.count());
    expect(await prisma.project.count()).toBe(0);
  });

  it('keeps revisions append-only, even for the owner', async () => {
    const sc = await ownerDb.scopeChange.create({
      data: { orgId: orgA, projectId: projectA, number: 1, createdById: userA },
    });
    const rev = await ownerDb.scopeChangeRevision.create({
      data: {
        orgId: orgA,
        scopeChangeId: sc.id,
        revisionNumber: 1,
        title: 't',
        description: 'd',
        priceDeltaCents: 100,
        deadlineDeltaDays: 1,
        createdById: userA,
      },
    });
    await expect(
      ownerDb.scopeChangeRevision.update({ where: { id: rev.id }, data: { priceDeltaCents: 1 } }),
    ).rejects.toThrow(/append-only/);
  });

  it('app role has no access to the webhook ledger', async () => {
    const raw = new PrismaClient({ adapter: new PrismaPg({ connectionString: env.DATABASE_URL }) });
    await expect(raw.processedStripeEvent.count()).rejects.toThrow(/permission denied/);
    await raw.$disconnect();
  });
});
