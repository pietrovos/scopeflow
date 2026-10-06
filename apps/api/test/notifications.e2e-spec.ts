import { createTestApp, type TestApp } from './support/app.js';
import { resetDatabase } from './support/db.js';
import { buildOrg, type World } from './support/world.js';

describe('email notifications', () => {
  let t: TestApp;
  let w: World;
  let base: string;
  const content = {
    title: 'Dark mode',
    description: 'Add a dark theme.',
    priceDeltaCents: 120_000,
    deadlineDeltaDays: 3,
  };

  beforeAll(async () => {
    t = await createTestApp();
  });
  beforeEach(async () => {
    await resetDatabase();
    w = await buildOrg(t, 'Juliet');
    base = `/orgs/${w.org.id}/projects/${w.project.id}/scope-changes`;
    t.mailer.clear();
    t.mailer.failing = false;
  });
  afterAll(() => t.close());

  it('emails the invitee a working link', async () => {
    const res = await (
      await t.as(w.owner)
    )
      .post(`/orgs/${w.org.id}/invitations`)
      .send({ email: 'new.hire@example.test', role: 'MEMBER' })
      .expect(201);
    const [mail] = t.mailer.to('new.hire@example.test');
    expect(mail!.subject).toBe('Juliet Owner invited you to Juliet Agency on ScopeFlow');
    expect(mail!.text).toContain(res.body.url);
    expect(mail!.html).toContain(res.body.url);
  });

  it('asks the assigned client to approve new proposals and revisions', async () => {
    const m = await t.as(w.member);
    const sc = (await m.post(base).send(content).expect(201)).body;
    await m
      .post(`${base}/${sc.id}/revisions`)
      .send({ ...content, priceDeltaCents: 90_000, version: 1 })
      .expect(201);

    const subjects = t.mailer.to(w.client.email).map((x) => x.subject);
    expect(subjects).toEqual(['Approval needed: SC-1 Dark mode', 'Updated proposal: SC-1 revision 2']);
    expect(t.mailer.to(w.client.email)[1]!.text).toContain('Price impact: +$900');
    // Staff are not emailed about their own proposals.
    expect(t.mailer.to(w.owner.email)).toEqual([]);
  });

  it('tells the owner, admins and proposer about the client decision', async () => {
    const sc = (await (await t.as(w.member)).post(base).send(content).expect(201)).body;
    t.mailer.clear();
    await (
      await t.as(w.client)
    )
      .post(`${base}/${sc.id}/decision`)
      .send({ revisionId: sc.currentRevisionId, decision: 'APPROVED', note: 'Go ahead' })
      .expect(201);
    const recipients = t.mailer.sent.map((x) => x.to).sort((a, b) => a.localeCompare(b));
    expect(recipients).toEqual([w.admin.email, w.member.email, w.owner.email].sort((a, b) => a.localeCompare(b)));
    expect(t.mailer.sent[0]!.subject).toBe('Juliet Client approved SC-1 (revision 1)');
    expect(t.mailer.sent[0]!.text).toContain('Note: “Go ahead”');
  });

  it('escapes user content in HTML email', async () => {
    await (
      await t.as(w.member)
    )
      .post(base)
      .send({ ...content, title: '<script>alert(1)</script>' })
      .expect(201);
    const [mail] = t.mailer.to(w.client.email);
    expect(mail!.html).not.toContain('<script>');
    expect(mail!.html).toContain('&lt;script&gt;');
  });

  it('does not fail the request when email delivery fails', async () => {
    t.mailer.failing = true;
    await (
      await t.as(w.owner)
    )
      .post(`/orgs/${w.org.id}/invitations`)
      .send({ email: 'unlucky@example.test', role: 'MEMBER' })
      .expect(201);
    await (await t.as(w.member)).post(base).send(content).expect(201);
  });
});
