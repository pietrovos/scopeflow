import { createTestApp, type TestApp } from './support/app.js';
import { listRoutes, type RouteInfo } from './support/routes.js';
import { ownerDb, resetDatabase } from './support/db.js';
import { buildOrg, type World } from './support/world.js';

/**
 * Org A's owner attacks every route in the API with org B's identifiers. The route
 * list comes from the running Express app, so a new endpoint is covered (or this
 * test fails asking how to fill its parameters) without anyone remembering to add it.
 */
describe('tenant isolation: org A cannot reach org B through any endpoint', () => {
  let t: TestApp;
  let a: World;
  let b: World;
  let routes: RouteInfo[];
  let bIds: Record<string, string>;
  let bSecrets: string[];

  beforeAll(async () => {
    t = await createTestApp();
    await resetDatabase();
    a = await buildOrg(t, 'Alpha');
    b = await buildOrg(t, 'Bravo');
    routes = listRoutes(t.app);

    const bInvite = await (await t.as(b.owner))
      .post(`/orgs/${b.org.id}/invitations`)
      .send({ email: 'pending@bravo.test', role: 'MEMBER' })
      .expect(201);

    bIds = {
      orgId: b.org.id,
      projectId: b.project.id,
      milestoneId: b.milestone.id,
      membershipId: b.membershipOf(b.member).id,
      invitationId: bInvite.body.id,
      userId: b.membershipOf(b.client).user.id,
      token: 'not-a-real-token',
      ...(await extraIds(t, b)),
    };
    // Anything that would prove a leak if it showed up in a response body.
    bSecrets = [
      b.org.id,
      b.org.name,
      b.project.id,
      b.project.name,
      b.milestone.id,
      b.hiddenProject.name,
      bIds.scopeChangeId!,
      'Bravo',
    ];
  });
  afterAll(() => t.close());

  const snapshotB = async () => {
    const tables = await ownerDb.$queryRawUnsafe<Array<{ t: string; h: string }>>(`
      SELECT 'projects' t, md5(string_agg(p::text, ',' ORDER BY id)) h FROM projects p WHERE org_id = '${b.org.id}'
      UNION ALL SELECT 'milestones', md5(string_agg(m::text, ',' ORDER BY id)) FROM milestones m WHERE org_id = '${b.org.id}'
      UNION ALL SELECT 'memberships', md5(string_agg(m::text, ',' ORDER BY id)) FROM memberships m WHERE org_id = '${b.org.id}'
      UNION ALL SELECT 'invitations', md5(string_agg(i::text, ',' ORDER BY id)) FROM invitations i WHERE org_id = '${b.org.id}'
      UNION ALL SELECT 'assignments', md5(string_agg(x::text, ',' ORDER BY project_id, user_id)) FROM project_assignments x WHERE org_id = '${b.org.id}'
      UNION ALL SELECT 'scope_changes', md5(string_agg(s::text, ',' ORDER BY id)) FROM scope_changes s WHERE org_id = '${b.org.id}'
      UNION ALL SELECT 'revisions', md5(string_agg(r::text, ',' ORDER BY id)) FROM scope_change_revisions r WHERE org_id = '${b.org.id}'
      UNION ALL SELECT 'decisions', md5(string_agg(d::text, ',' ORDER BY id)) FROM scope_change_decisions d WHERE org_id = '${b.org.id}'
      UNION ALL SELECT 'comments', md5(string_agg(c::text, ',' ORDER BY id)) FROM comments c WHERE org_id = '${b.org.id}'
      UNION ALL SELECT 'organization', md5(o::text) FROM organizations o WHERE id = '${b.org.id}'
    `);
    return tables;
  };

  const fill = (route: RouteInfo, ids: Record<string, string>) =>
    route.path.replace(/:(\w+)/g, (_, name: string) => {
      if (!(name in ids)) throw new Error(`No fixture for :${name} in ${route.method} ${route.path}; add one above`);
      return ids[name]!;
    });

  const expectNoLeak = (body: unknown, label: string) => {
    const text = JSON.stringify(body ?? '');
    for (const secret of bSecrets) {
      expect(text, `${label} leaked "${secret}"`).not.toContain(secret);
    }
  };

  it('discovers the API routes', () => {
    expect(routes.length).toBeGreaterThan(15);
  });

  it('with org B in the URL, every org route returns 404 and changes nothing', async () => {
    const before = await snapshotB();
    const client = await t.as(a.owner);
    const orgRoutes = routes.filter((r) => r.path.includes(':orgId'));
    expect(orgRoutes.length).toBeGreaterThan(10);
    for (const route of orgRoutes) {
      const url = fill(route, bIds);
      const res = await client[route.method](url).send(bodyFor(bIds));
      expect(res.status, `${route.method.toUpperCase()} ${route.path}`).toBe(404);
      expectNoLeak(res.body, `${route.method} ${route.path}`);
    }
    expect(await snapshotB()).toEqual(before);
  });

  it('with org A in the URL but B’s resource IDs, nothing of B is read or changed', async () => {
    const before = await snapshotB();
    const client = await t.as(a.owner);
    const resourceRoutes = routes.filter((r) => r.path.includes(':orgId') && /:(?!orgId)\w+/.test(r.path));
    expect(resourceRoutes.length).toBeGreaterThan(8);
    for (const route of resourceRoutes) {
      const url = fill(route, { ...bIds, orgId: a.org.id });
      const res = await client[route.method](url).send(bodyFor(bIds));
      const label = `${route.method.toUpperCase()} ${route.path}`;
      expect(res.status, label).toBeGreaterThanOrEqual(400);
      expect(res.status, label).toBeLessThan(500);
      expectNoLeak(res.body, label);
    }
    expect(await snapshotB()).toEqual(before);
  });

  it('A’s own-org routes never return B’s data, even with B’s IDs in the body', async () => {
    const client = await t.as(a.owner);
    const ownRoutes = routes.filter((r) => r.method === 'get' && !/:(?!orgId)\w+/.test(r.path));
    for (const route of ownRoutes) {
      const res = await client.get(fill(route, { ...bIds, orgId: a.org.id }));
      expectNoLeak(res.body, `GET ${route.path}`);
    }
    // Referencing B's user from A's project must not create an assignment.
    await client.post(`/orgs/${a.org.id}/projects/${a.project.id}/clients`).send({ userId: bIds.userId }).expect(404);
  });

  it('every staff role in A gets the same answer as the owner', async () => {
    for (const who of [a.admin, a.member, a.client]) {
      const client = await t.as(who);
      await client.get(`/orgs/${b.org.id}`).expect(404);
      await client.get(`/orgs/${b.org.id}/projects/${b.project.id}`).expect(404);
      await client.get(`/orgs/${a.org.id}/projects/${b.project.id}`).expect(404);
    }
    // The decision route is client-only, so the owner sweep stops at the role check.
    // Make sure A's client is also refused B's proposal.
    const c = await t.as(a.client);
    for (const projectId of [a.project.id, b.project.id]) {
      await c
        .post(`/orgs/${a.org.id}/projects/${projectId}/scope-changes/${bIds.scopeChangeId}/decision`)
        .send({ revisionId: bIds.revisionId, decision: 'APPROVED' })
        .expect(404);
    }
  });
});

/** A body that passes validation for every route, so requests reach the authorization layer. */
function bodyFor(ids: Record<string, string>) {
  return {
    name: 'Injected',
    clientName: 'Injected',
    title: 'Injected',
    description: 'Injected',
    body: 'Injected',
    email: 'injected@example.test',
    role: 'MEMBER',
    userId: ids.userId,
    projectIds: [],
    version: 1,
    priceDeltaCents: 100,
    deadlineDeltaDays: 1,
    revisionId: ids.revisionId,
    decision: 'APPROVED',
    note: '',
    scopeChangeId: ids.scopeChangeId,
    plan: 'PRO',
  };
}

/** IDs for resources added by later milestones; extended as the API grows. */
async function extraIds(t: TestApp, b: World): Promise<Record<string, string>> {
  const sc = await (await t.as(b.owner))
    .post(`/orgs/${b.org.id}/projects/${b.project.id}/scope-changes`)
    .send({ title: 'Bravo change', description: 'Bravo scope', priceDeltaCents: 5000, deadlineDeltaDays: 2 })
    .expect(201);
  return { scopeChangeId: sc.body.id, revisionId: sc.body.currentRevisionId };
}
