import { createTestApp, type TestApp } from './support/app.js';
import { ownerDb, resetDatabase } from './support/db.js';
import { buildOrg, type World } from './support/world.js';

const content = {
  title: 'Add appointment reminders',
  description: 'SMS and email reminders 24h before each appointment.',
  priceDeltaCents: 450_000,
  deadlineDeltaDays: 10,
};

describe('scope changes with immutable revisions', () => {
  let t: TestApp;
  let w: World;
  let base: string;
  beforeAll(async () => {
    t = await createTestApp();
  });
  beforeEach(async () => {
    await resetDatabase();
    w = await buildOrg(t, 'Echo');
    base = `/orgs/${w.org.id}/projects/${w.project.id}/scope-changes`;
  });
  afterAll(() => t.close());

  const propose = async (body = content) => (await (await t.as(w.member)).post(base).send(body).expect(201)).body;
  const revise = async (sc: { id: string; version: number }, patch: Partial<typeof content>, status = 201) =>
    (await t.as(w.member))
      .post(`${base}/${sc.id}/revisions`)
      .send({ ...content, ...patch, version: sc.version })
      .expect(status);
  const decide = async (scId: string, revisionId: string, decision = 'APPROVED', status = 201) =>
    (await t.as(w.client)).post(`${base}/${scId}/decision`).send({ revisionId, decision }).expect(status);

  it('creates a proposal with revision 1 and numbers proposals per project', async () => {
    const first = await propose();
    const second = await propose({ ...content, title: 'Second' });
    expect(first).toMatchObject({ number: 1, status: 'PENDING', version: 1 });
    expect(first.revisions).toEqual([expect.objectContaining({ revisionNumber: 1, ...content })]);
    expect(first.currentRevisionId).toBe(first.revisions[0].id);
    expect(second.number).toBe(2);
  });

  it('editing appends a revision and leaves earlier revisions untouched', async () => {
    const sc = await propose();
    const before = await ownerDb.scopeChangeRevision.findUniqueOrThrow({ where: { id: sc.currentRevisionId } });

    const res = await revise(sc, { priceDeltaCents: 380_000, description: 'SMS reminders only.' });
    expect(res.body.revisions.map((r: { revisionNumber: number }) => r.revisionNumber)).toEqual([1, 2]);
    expect(res.body.currentRevisionId).toBe(res.body.revisions[1].id);
    expect(res.body.version).toBe(2);

    const after = await ownerDb.scopeChangeRevision.findUniqueOrThrow({ where: { id: sc.currentRevisionId } });
    expect(after).toEqual(before);
  });

  it('rejects a no-op revision', async () => {
    const sc = await propose();
    await revise(sc, {}, 400);
  });

  it('approves exactly the revision the client chose', async () => {
    const sc = await propose();
    const v2 = (await revise(sc, { priceDeltaCents: 300_000 })).body;
    const res = await decide(sc.id, v2.currentRevisionId);
    expect(res.body).toMatchObject({ status: 'APPROVED', approvedRevisionId: v2.currentRevisionId });
    expect(res.body.decisions).toEqual([
      expect.objectContaining({ revisionId: v2.currentRevisionId, decision: 'APPROVED' }),
    ]);
  });

  it('refuses approval of a superseded revision with 409 and the current state', async () => {
    const sc = await propose();
    await revise(sc, { priceDeltaCents: 600_000 });
    const res = await decide(sc.id, sc.currentRevisionId, 'APPROVED', 409);
    expect(res.body.error).toBe('revision_superseded');
    expect(res.body.current.revisions).toHaveLength(2);
    expect((await ownerDb.scopeChange.findUniqueOrThrow({ where: { id: sc.id } })).status).toBe('PENDING');
  });

  it('never alters an approved revision: further edits are refused', async () => {
    const sc = await propose();
    await decide(sc.id, sc.currentRevisionId);
    const approved = await ownerDb.scopeChangeRevision.findUniqueOrThrow({ where: { id: sc.currentRevisionId } });
    const current = await ownerDb.scopeChange.findUniqueOrThrow({ where: { id: sc.id } });

    const res = await revise({ id: sc.id, version: current.version }, { priceDeltaCents: 1 }, 409);
    expect(res.body.error).toBe('already_approved');
    expect(await ownerDb.scopeChangeRevision.findUniqueOrThrow({ where: { id: sc.currentRevisionId } })).toEqual(
      approved,
    );
    await decide(sc.id, sc.currentRevisionId, 'REJECTED', 409);
  });

  it('a rejected proposal can be revised and resubmitted', async () => {
    const sc = await propose();
    await decide(sc.id, sc.currentRevisionId, 'REJECTED');
    const current = await ownerDb.scopeChange.findUniqueOrThrow({ where: { id: sc.id } });
    const v2 = (await revise({ id: sc.id, version: current.version }, { priceDeltaCents: 200_000 })).body;
    expect(v2.status).toBe('PENDING');
    const approved = await decide(sc.id, v2.currentRevisionId);
    expect(approved.body.decisions.map((d: { decision: string }) => d.decision)).toEqual(['REJECTED', 'APPROVED']);
  });

  it('rejects a stale revise with 409 version_conflict', async () => {
    const sc = await propose();
    await revise(sc, { title: 'First edit' });
    const res = await revise(sc, { title: 'Second edit from a stale tab' }, 409);
    expect(res.body).toMatchObject({ error: 'version_conflict', current: { version: 2 } });
  });

  it('lets only one of two concurrent revisions win', async () => {
    const sc = await propose();
    const m = await t.as(w.member);
    const [a, b] = await Promise.all([
      m.post(`${base}/${sc.id}/revisions`).send({ ...content, title: 'Edit A', version: 1 }),
      m.post(`${base}/${sc.id}/revisions`).send({ ...content, title: 'Edit B', version: 1 }),
    ]);
    expect([a.status, b.status].sort((x, y) => x - y)).toEqual([201, 409]);
    expect(await ownerDb.scopeChangeRevision.count({ where: { scopeChangeId: sc.id } })).toBe(2);
  });

  it('assigns distinct numbers to concurrent proposals', async () => {
    const m = await t.as(w.member);
    const results = await Promise.all(
      [1, 2, 3, 4].map((i) => m.post(base).send({ ...content, title: `Parallel ${i}` })),
    );
    expect(results.map((r) => r.status)).toEqual([201, 201, 201, 201]);
    expect(results.map((r) => r.body.number as number).sort((x, y) => x - y)).toEqual([1, 2, 3, 4]);
  });

  it('only staff propose and only clients decide', async () => {
    const sc = await propose();
    await (await t.as(w.client)).post(base).send(content).expect(403);
    await (
      await t.as(w.client)
    )
      .post(`${base}/${sc.id}/revisions`)
      .send({ ...content, version: 1 })
      .expect(403);
    await (
      await t.as(w.owner)
    )
      .post(`${base}/${sc.id}/decision`)
      .send({ revisionId: sc.currentRevisionId, decision: 'APPROVED' })
      .expect(403);
  });

  it('shows the inbox and project totals, filtered by visibility', async () => {
    const sc = await propose();
    const hidden = await (
      await t.as(w.member)
    )
      .post(`/orgs/${w.org.id}/projects/${w.hiddenProject.id}/scope-changes`)
      .send({ ...content, title: 'Internal only' })
      .expect(201);

    const clientInbox = await (await t.as(w.client)).get(`/orgs/${w.org.id}/scope-changes?status=PENDING`).expect(200);
    const staffInbox = await (await t.as(w.member)).get(`/orgs/${w.org.id}/scope-changes?status=PENDING`).expect(200);
    expect(clientInbox.body.map((x: { id: string }) => x.id)).toEqual([sc.id]);
    const byId = (x: string, y: string) => x.localeCompare(y);
    expect(staffInbox.body.map((x: { id: string }) => x.id).sort(byId)).toEqual([sc.id, hidden.body.id].sort(byId));

    await decide(sc.id, sc.currentRevisionId);
    const project = await (await t.as(w.client)).get(`/orgs/${w.org.id}/projects/${w.project.id}`).expect(200);
    expect(project.body.scope).toEqual({
      approvedCount: 1,
      approvedPriceDeltaCents: 450_000,
      approvedDeadlineDeltaDays: 10,
      pendingCount: 0,
    });
  });

  it('threads comments on a proposal, but only on the same project', async () => {
    const sc = await propose();
    const comments = `/orgs/${w.org.id}/projects/${w.project.id}/comments`;
    await (await t.as(w.client)).post(comments).send({ body: 'Is SMS included?', scopeChangeId: sc.id }).expect(201);
    const thread = await (await t.as(w.member)).get(`${comments}?scopeChangeId=${sc.id}`).expect(200);
    expect(thread.body.map((c: { body: string }) => c.body)).toEqual(['Is SMS included?']);

    const other = `/orgs/${w.org.id}/projects/${w.hiddenProject.id}/comments`;
    await (await t.as(w.member)).post(other).send({ body: 'Wrong project', scopeChangeId: sc.id }).expect(404);
  });

  it('writes the whole history to the audit log', async () => {
    const sc = await propose();
    const v2 = (await revise(sc, { priceDeltaCents: 1000 })).body;
    await decide(sc.id, v2.currentRevisionId);
    const log = await (await t.as(w.owner)).get(`/orgs/${w.org.id}/activity`).expect(200);
    const scEvents = log.body.items
      .filter((e: { entityId: string }) => e.entityId === sc.id)
      .map((e: { type: string; data: { revisionNumber?: number; revisionId?: string } }) => [
        e.type,
        e.data.revisionId,
      ]);
    expect(scEvents).toEqual([
      ['scope_change.approved', v2.currentRevisionId],
      ['scope_change.revised', v2.currentRevisionId],
      ['scope_change.created', sc.currentRevisionId],
    ]);
  });
});
