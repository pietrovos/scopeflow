import { createTestApp, type TestApp } from './support/app.js';
import { listRoutes } from './support/routes.js';
import { resetDatabase } from './support/db.js';
import { buildOrg, type World } from './support/world.js';

/**
 * Resource-level authorization: a client user sees only the projects they are assigned
 * to, everything under those projects, and nothing org-wide.
 */
describe('client visibility', () => {
  let t: TestApp;
  let w: World;
  const org = () => `/orgs/${w.org.id}`;
  beforeAll(async () => {
    t = await createTestApp();
  });
  beforeEach(async () => {
    await resetDatabase();
    w = await buildOrg(t, 'Delta');
  });
  afterAll(() => t.close());

  it('lists only assigned projects for a client, all projects for staff', async () => {
    const asClient = await (await t.as(w.client)).get(`${org()}/projects`).expect(200);
    const asMember = await (await t.as(w.member)).get(`${org()}/projects`).expect(200);
    expect(asClient.body.map((p: { id: string }) => p.id)).toEqual([w.project.id]);
    expect(asMember.body).toHaveLength(2);
  });

  it('returns 404 for every route under an unassigned project', async () => {
    const c = await t.as(w.client);
    const routes = listRoutes(t.app).filter((r) => r.path.includes(':projectId'));
    expect(routes.length).toBeGreaterThan(4);
    for (const route of routes) {
      const url = route.path
        .replace(':orgId', w.org.id)
        .replace(':projectId', w.hiddenProject.id)
        .replace(/:\w+/g, w.hiddenMilestone.id);
      const res = await c[route.method](url).send({
        title: 'x',
        description: 'x',
        body: 'x',
        version: 1,
        priceDeltaCents: 1,
        deadlineDeltaDays: 1,
        userId: w.org.id,
        revisionId: w.org.id,
        decision: 'APPROVED',
      });
      const label = `${route.method.toUpperCase()} ${route.path}`;
      // 403 is fine for staff-only routes (role check runs first); never 2xx.
      expect([403, 404], label).toContain(res.status);
      expect(JSON.stringify(res.body), label).not.toContain('Delta Internal');
      expect(JSON.stringify(res.body), label).not.toContain('Delta Secret');
    }
  });

  it('shows the assigned project with milestones, but not other clients', async () => {
    const other = (await import('./support/auth.js')).identity('Second Client');
    const { join } = await import('./support/world.js');
    await join(t, w.owner, w.org.id, other, 'CLIENT', [w.project.id]);

    const res = await (await t.as(w.client)).get(`${org()}/projects/${w.project.id}`).expect(200);
    expect(res.body.milestones.map((m: { title: string }) => m.title)).toEqual(['Delta Discovery']);
    expect(res.body.clients.map((c: { email: string }) => c.email)).toEqual([w.client.email]);
    expect(res.body.canEdit).toBe(false);

    const staffView = await (await t.as(w.owner)).get(`${org()}/projects/${w.project.id}`).expect(200);
    expect(staffView.body.clients).toHaveLength(2);
  });

  it('loses access as soon as the assignment is removed', async () => {
    const clientUserId = w.membershipOf(w.client).user.id;
    const c = await t.as(w.client);
    await c.get(`${org()}/projects/${w.project.id}`).expect(200);
    await (await t.as(w.admin)).delete(`${org()}/projects/${w.project.id}/clients/${clientUserId}`).expect(204);
    await c.get(`${org()}/projects/${w.project.id}`).expect(404);
    expect((await c.get(`${org()}/projects`).expect(200)).body).toEqual([]);
  });

  it('gains access when assigned to another project', async () => {
    const clientUserId = w.membershipOf(w.client).user.id;
    await (
      await t.as(w.owner)
    )
      .post(`${org()}/projects/${w.hiddenProject.id}/clients`)
      .send({ userId: clientUserId })
      .expect(204);
    await (await t.as(w.client)).get(`${org()}/projects/${w.hiddenProject.id}`).expect(200);
  });

  it('sees every project once promoted to a staff role', async () => {
    const membership = w.membershipOf(w.client);
    await (await t.as(w.owner)).patch(`${org()}/members/${membership.id}`).send({ role: 'MEMBER' }).expect(200);
    const res = await (await t.as(w.client)).get(`${org()}/projects`).expect(200);
    expect(res.body).toHaveLength(2);
  });

  it('only sees project activity for assigned projects, and no org-level events', async () => {
    const c = await t.as(w.client);
    const feed = await c.get(`${org()}/projects/${w.project.id}/activity`).expect(200);
    expect(feed.body.items.length).toBeGreaterThan(0);
    expect(feed.body.items.every((e: { projectId: string }) => e.projectId === w.project.id)).toBe(true);
    await c.get(`${org()}/projects/${w.hiddenProject.id}/activity`).expect(404);
    await c.get(`${org()}/activity`).expect(403);
  });

  it('cannot use staff-only endpoints even on an assigned project', async () => {
    const c = await t.as(w.client);
    await c.patch(`${org()}/projects/${w.project.id}`).send({ name: 'Renamed' }).expect(403);
    await c.get(`${org()}/projects/${w.project.id}/clients`).expect(403);
    await c.post(`${org()}/projects`).send({ name: 'Mine', clientName: 'x' }).expect(403);
    await c.get(`${org()}/invitations`).expect(403);
  });
});
