import { createTestApp, type TestApp } from './support/app.js';
import { resetDatabase } from './support/db.js';
import { buildOrg, type World } from './support/world.js';

describe('projects and milestones', () => {
  let t: TestApp;
  let w: World;
  const base = () => `/orgs/${w.org.id}/projects`;
  beforeAll(async () => {
    t = await createTestApp();
  });
  beforeEach(async () => {
    await resetDatabase();
    w = await buildOrg(t, 'Acme');
  });
  afterAll(() => t.close());

  it('lets staff create and update projects', async () => {
    const m = await t.as(w.member);
    const created = await m.post(base()).send({ name: 'App', clientName: 'Bright', dueDate: '2026-12-01' }).expect(201);
    const updated = await m.patch(`${base()}/${created.body.id}`).send({ status: 'ON_HOLD' }).expect(200);
    expect(updated.body).toMatchObject({ name: 'App', status: 'ON_HOLD' });
  });

  it('validates input', async () => {
    const res = await (await t.as(w.member)).post(base()).send({ name: '', clientName: 'x' }).expect(400);
    expect(res.body.issues).toEqual([expect.objectContaining({ path: 'name' })]);
  });

  it('enforces the free plan project limit', async () => {
    const o = await t.as(w.owner);
    await o.post(base()).send({ name: 'Third', clientName: 'x' }).expect(201);
    const res = await o.post(base()).send({ name: 'Fourth', clientName: 'x' }).expect(403);
    expect(res.body.error).toBe('plan_limit');
  });

  it('only assigns client members to projects', async () => {
    const o = await t.as(w.owner);
    const memberId = w.membershipOf(w.member).user.id;
    await o.post(`${base()}/${w.hiddenProject.id}/clients`).send({ userId: memberId }).expect(400);
  });

  it('orders milestones and rejects stale updates with 409', async () => {
    const m = await t.as(w.member);
    const url = `${base()}/${w.project.id}/milestones`;
    await m.post(url).send({ title: 'Build' }).expect(201);
    const list = await m.get(url).expect(200);
    expect(list.body.map((x: { title: string }) => x.title)).toEqual(['Acme Discovery', 'Build']);

    const first = await m.patch(`${url}/${w.milestone.id}`).send({ status: 'IN_PROGRESS', version: 1 }).expect(200);
    expect(first.body.version).toBe(2);
    const stale = await m.patch(`${url}/${w.milestone.id}`).send({ title: 'Overwrite', version: 1 }).expect(409);
    expect(stale.body).toMatchObject({ error: 'version_conflict', current: { version: 2, status: 'IN_PROGRESS' } });
  });

  it('clients can read but not change milestones', async () => {
    const c = await t.as(w.client);
    const url = `${base()}/${w.project.id}/milestones`;
    await c.get(url).expect(200);
    await c.post(url).send({ title: 'Nope' }).expect(403);
    await c.patch(`${url}/${w.milestone.id}`).send({ title: 'Nope', version: 1 }).expect(403);
  });
});
