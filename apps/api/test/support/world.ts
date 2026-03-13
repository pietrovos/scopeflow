import type { TestApp } from './app.js';
import { identity, type TestIdentity } from './auth.js';
import { ownerDb } from './db.js';

const tokenFromUrl = (url: string) => url.split('/invitations/')[1]!;

/** Invites `who` into `orgId` through the real API and accepts the invitation. */
export async function join(
  t: TestApp,
  inviter: TestIdentity,
  orgId: string,
  who: TestIdentity,
  role: 'ADMIN' | 'MEMBER' | 'CLIENT',
  projectIds: string[] = [],
) {
  const by = await t.as(inviter);
  const inv = await by.post(`/orgs/${orgId}/invitations`).send({ email: who.email, role, projectIds }).expect(201);
  await (await t.as(who)).post(`/invitations/${tokenFromUrl(inv.body.url)}/accept`).expect(201);
  return inv.body as { id: string; url: string };
}

/**
 * One agency with an owner, admin, member and client, two projects (the client is
 * assigned to the first only) and a milestone on each. Built entirely via HTTP.
 */
export async function buildOrg(t: TestApp, label: string) {
  const owner = identity(`${label} Owner`);
  const admin = identity(`${label} Admin`);
  const member = identity(`${label} Member`);
  const client = identity(`${label} Client`);
  const o = await t.as(owner);

  const org = (
    await o
      .post('/orgs')
      .send({ name: `${label} Agency` })
      .expect(201)
  ).body as { id: string; name: string };
  // Fixtures need more seats than the free plan has; plan-limit tests downgrade explicitly.
  await ownerDb.organization.update({ where: { id: org.id }, data: { plan: 'PRO' } });
  const project = (
    await o
      .post(`/orgs/${org.id}/projects`)
      .send({ name: `${label} Website`, clientName: `${label} Client Co`, budgetCents: 1_000_000 })
      .expect(201)
  ).body as { id: string; name: string };
  const hiddenProject = (
    await o
      .post(`/orgs/${org.id}/projects`)
      .send({ name: `${label} Internal`, clientName: 'Other' })
      .expect(201)
  ).body as { id: string; name: string };
  const milestone = (
    await o
      .post(`/orgs/${org.id}/projects/${project.id}/milestones`)
      .send({ title: `${label} Discovery` })
      .expect(201)
  ).body as { id: string; version: number };
  const hiddenMilestone = (
    await o
      .post(`/orgs/${org.id}/projects/${hiddenProject.id}/milestones`)
      .send({ title: `${label} Secret` })
      .expect(201)
  ).body as { id: string; version: number };

  await join(t, owner, org.id, admin, 'ADMIN');
  await join(t, owner, org.id, member, 'MEMBER');
  await join(t, owner, org.id, client, 'CLIENT', [project.id]);

  const members = (await o.get(`/orgs/${org.id}/members`).expect(200)).body as Array<{
    id: string;
    role: string;
    user: { id: string; email: string };
  }>;
  const membershipOf = (who: TestIdentity) => members.find((m) => m.user.email === who.email)!;

  return { org, owner, admin, member, client, project, hiddenProject, milestone, hiddenMilestone, membershipOf };
}

export type World = Awaited<ReturnType<typeof buildOrg>>;
