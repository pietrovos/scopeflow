import { createTestApp, type TestApp } from './support/app.js';
import { ownerDb, resetDatabase } from './support/db.js';
import { buildOrg, type World } from './support/world.js';

/**
 * Optimistic locking. Every write to a milestone or proposal carries the version it was
 * based on; exactly one of several concurrent writers wins and the rest get 409 with
 * the current state, so nothing is silently overwritten.
 */
describe('optimistic locking', () => {
  let t: TestApp;
  let w: World;
  let ms: string;
  beforeAll(async () => {
    t = await createTestApp();
  });
  beforeEach(async () => {
    await resetDatabase();
    w = await buildOrg(t, 'Foxtrot');
    ms = `/orgs/${w.org.id}/projects/${w.project.id}/milestones/${w.milestone.id}`;
  });
  afterAll(() => t.close());

  it('lets exactly one of many concurrent milestone edits win', async () => {
    const editors = await Promise.all([w.owner, w.admin, w.member, w.owner, w.member].map((who) => t.as(who)));
    const results = await Promise.all(editors.map((c, i) => c.patch(ms).send({ title: `Edit ${i}`, version: 1 })));
    const statuses = results.map((r) => r.status);
    expect(statuses.filter((s) => s === 200)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(4);

    const winner = results.find((r) => r.status === 200)!.body;
    const row = await ownerDb.milestone.findUniqueOrThrow({ where: { id: w.milestone.id } });
    expect(row).toMatchObject({ title: winner.title, version: 2 });
    for (const loser of results.filter((r) => r.status === 409)) {
      expect(loser.body).toMatchObject({ error: 'version_conflict', current: { version: 2, title: winner.title } });
    }
  });

  it('accepts a retry based on the version returned in the 409', async () => {
    const m = await t.as(w.member);
    await m.patch(ms).send({ title: 'First', version: 1 }).expect(200);
    const conflict = await m.patch(ms).send({ title: 'Second', version: 1 }).expect(409);
    await m.patch(ms).send({ title: 'Second', version: conflict.body.current.version }).expect(200);
    expect((await ownerDb.milestone.findUniqueOrThrow({ where: { id: w.milestone.id } })).version).toBe(3);
  });

  it('rejects a stale delete and keeps the newer edit', async () => {
    const m = await t.as(w.member);
    await m.patch(ms).send({ title: 'Renamed by someone else', version: 1 }).expect(200);
    const res = await m.delete(`${ms}?version=1`).expect(409);
    expect(res.body.current.title).toBe('Renamed by someone else');
    expect(await ownerDb.milestone.count({ where: { id: w.milestone.id } })).toBe(1);
    await m.delete(`${ms}?version=2`).expect(204);
  });

  it('requires a version on milestone updates', async () => {
    const res = await (await t.as(w.member)).patch(ms).send({ title: 'No version' }).expect(400);
    expect(res.body.issues).toEqual([expect.objectContaining({ path: 'version' })]);
  });

  it('rejects a stale withdraw of a proposal', async () => {
    const base = `/orgs/${w.org.id}/projects/${w.project.id}/scope-changes`;
    const m = await t.as(w.member);
    const sc = (
      await m.post(base).send({ title: 'T', description: 'D', priceDeltaCents: 1, deadlineDeltaDays: 0 }).expect(201)
    ).body;
    await m
      .post(`${base}/${sc.id}/revisions`)
      .send({ title: 'T2', description: 'D', priceDeltaCents: 1, deadlineDeltaDays: 0, version: 1 })
      .expect(201);
    await m.post(`${base}/${sc.id}/withdraw`).send({ version: 1 }).expect(409);
    await m.post(`${base}/${sc.id}/withdraw`).send({ version: 2 }).expect(201);
  });

  it('serializes an approval against a concurrent revision: never both', async () => {
    const base = `/orgs/${w.org.id}/projects/${w.project.id}/scope-changes`;
    const m = await t.as(w.member);
    const c = await t.as(w.client);
    for (let i = 0; i < 5; i++) {
      const sc = (
        await m
          .post(base)
          .send({ title: `Race ${i}`, description: 'D', priceDeltaCents: 100, deadlineDeltaDays: 1 })
          .expect(201)
      ).body;
      const [revise, approve] = await Promise.all([
        m
          .post(`${base}/${sc.id}/revisions`)
          .send({ title: `Race ${i}`, description: 'Changed', priceDeltaCents: 200, deadlineDeltaDays: 1, version: 1 }),
        c.post(`${base}/${sc.id}/decision`).send({ revisionId: sc.currentRevisionId, decision: 'APPROVED' }),
      ]);
      const row = await ownerDb.scopeChange.findUniqueOrThrow({ where: { id: sc.id } });
      if (approve.status === 201) {
        // Approval won: revision 1 is the approved one, and the revise was refused.
        expect(revise.status).toBe(409);
        expect(row).toMatchObject({ status: 'APPROVED', approvedRevisionId: sc.currentRevisionId });
      } else {
        // Revise won: the approval of the stale revision was refused.
        expect(approve.status).toBe(409);
        expect(revise.status).toBe(201);
        expect(row).toMatchObject({ status: 'PENDING', approvedRevisionId: null });
      }
    }
  });
});
