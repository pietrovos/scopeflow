import request from 'supertest';
import { createTestApp, type TestApp } from './support/app.js';
import { identity } from './support/auth.js';
import { resetDatabase } from './support/db.js';
import { buildOrg, type World } from './support/world.js';

describe('organizations, memberships and invitations', () => {
  let t: TestApp;
  let w: World;
  beforeAll(async () => {
    t = await createTestApp();
  });
  beforeEach(async () => {
    await resetDatabase();
    w = await buildOrg(t, 'Northwind');
  });
  afterAll(() => t.close());

  it('lists the caller’s organizations with their role', async () => {
    const owner = await (await t.as(w.owner)).get('/me').expect(200);
    const client = await (await t.as(w.client)).get('/me').expect(200);
    expect(owner.body.organizations).toEqual([expect.objectContaining({ id: w.org.id, role: 'OWNER' })]);
    expect(client.body.organizations).toEqual([expect.objectContaining({ id: w.org.id, role: 'CLIENT' })]);
  });

  it('only shows a user their own orgs in the switcher', async () => {
    const outsider = identity('Outsider');
    const o = await t.as(outsider);
    await o.post('/orgs').send({ name: 'Elsewhere' }).expect(201);
    const res = await o.get('/me').expect(200);
    expect(res.body.organizations.map((x: { name: string }) => x.name)).toEqual(['Elsewhere']);
  });

  describe('role checks', () => {
    it.each([
      ['MEMBER', 'member', 403],
      ['CLIENT', 'client', 403],
      ['ADMIN', 'admin', 201],
    ] as const)('%s inviting someone → %i', async (_role, key, status) => {
      const c = await t.as(w[key]);
      await c.post(`/orgs/${w.org.id}/invitations`).send({ email: 'new@example.test', role: 'MEMBER' }).expect(status);
    });

    it('clients cannot list members or the audit log', async () => {
      const c = await t.as(w.client);
      await c.get(`/orgs/${w.org.id}/members`).expect(403);
      await c.get(`/orgs/${w.org.id}/activity`).expect(403);
    });

    it('nobody can change or remove the owner', async () => {
      const a = await t.as(w.admin);
      const ownerMembership = w.membershipOf(w.owner);
      await a.patch(`/orgs/${w.org.id}/members/${ownerMembership.id}`).send({ role: 'MEMBER' }).expect(403);
      await a.delete(`/orgs/${w.org.id}/members/${ownerMembership.id}`).expect(403);
    });

    it('admins cannot demote other admins, but the owner can', async () => {
      const other = identity('Second Admin');
      const { join } = await import('./support/world.js');
      await join(t, w.owner, w.org.id, other, 'ADMIN');
      const members = (await (await t.as(w.owner)).get(`/orgs/${w.org.id}/members`)).body as Array<{
        id: string;
        user: { email: string };
      }>;
      const target = members.find((m) => m.user.email === other.email)!;
      await (await t.as(w.admin)).patch(`/orgs/${w.org.id}/members/${target.id}`).send({ role: 'MEMBER' }).expect(403);
      await (await t.as(w.owner)).patch(`/orgs/${w.org.id}/members/${target.id}`).send({ role: 'MEMBER' }).expect(200);
    });
  });

  describe('invitations', () => {
    it('can only be accepted by the invited email, once', async () => {
      const o = await t.as(w.owner);
      const inv = await o
        .post(`/orgs/${w.org.id}/invitations`)
        .send({ email: 'grace@example.test', role: 'MEMBER' })
        .expect(201);
      const token = inv.body.url.split('/invitations/')[1];

      const preview = await request(t.server).get(`/invitations/${token}`).expect(200);
      expect(preview.body).toMatchObject({ orgName: 'Northwind Agency', role: 'MEMBER', status: 'pending' });

      await (await t.as(identity('Mallory'))).post(`/invitations/${token}/accept`).expect(403);
      const grace = identity('Grace', 'grace@example.test');
      await (await t.as(grace)).post(`/invitations/${token}/accept`).expect(201);
      await (await t.as(grace)).post(`/invitations/${token}/accept`).expect(410);
    });

    it('re-inviting replaces the previous link', async () => {
      const o = await t.as(w.owner);
      const first = await o.post(`/orgs/${w.org.id}/invitations`).send({ email: 'x@example.test', role: 'MEMBER' });
      await o.post(`/orgs/${w.org.id}/invitations`).send({ email: 'x@example.test', role: 'ADMIN' }).expect(201);
      const firstToken = first.body.url.split('/invitations/')[1];
      await request(t.server).get(`/invitations/${firstToken}`).expect(404);
      const pending = await o.get(`/orgs/${w.org.id}/invitations`).expect(200);
      expect(pending.body).toEqual([expect.objectContaining({ email: 'x@example.test', role: 'ADMIN' })]);
    });

    it('rejects inviting an existing member', async () => {
      const o = await t.as(w.owner);
      await o.post(`/orgs/${w.org.id}/invitations`).send({ email: w.member.email, role: 'ADMIN' }).expect(409);
    });

    it('revoked invitations cannot be used', async () => {
      const o = await t.as(w.owner);
      const inv = await o.post(`/orgs/${w.org.id}/invitations`).send({ email: 'r@example.test', role: 'MEMBER' });
      await o.delete(`/orgs/${w.org.id}/invitations/${inv.body.id}`).expect(204);
      const r = identity('R', 'r@example.test');
      await (await t.as(r)).post(`/invitations/${inv.body.url.split('/invitations/')[1]}/accept`).expect(404);
    });
  });

  it('records membership changes in the audit log', async () => {
    const log = await (await t.as(w.owner)).get(`/orgs/${w.org.id}/activity`).expect(200);
    const types = log.body.items.map((e: { type: string }) => e.type);
    expect(types).toContain('org.created');
    expect(types.filter((x: string) => x === 'member.joined')).toHaveLength(3);
  });
});
