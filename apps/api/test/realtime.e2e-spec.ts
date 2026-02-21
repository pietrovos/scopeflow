import type { AddressInfo } from 'node:net';
import { io, type Socket } from 'socket.io-client';
import { WS, type ActivityEventDto } from '@scopeflow/shared';
import { createTestApp, type TestApp } from './support/app.js';
import { identity, tokenFor, type TestIdentity } from './support/auth.js';
import { resetDatabase } from './support/db.js';
import { buildOrg, type World } from './support/world.js';

describe('real-time activity over socket.io', () => {
  let t: TestApp;
  let a: World;
  let b: World;
  let url: string;
  const sockets: Socket[] = [];

  beforeAll(async () => {
    t = await createTestApp();
    await t.app.listen(0);
    url = `http://127.0.0.1:${(t.server.address() as AddressInfo).port}/realtime`;
  });
  beforeEach(async () => {
    await resetDatabase();
    a = await buildOrg(t, 'Golf');
    b = await buildOrg(t, 'Hotel');
  });
  afterEach(() => {
    for (const s of sockets.splice(0)) s.disconnect();
  });
  afterAll(() => t.close());

  async function connect(who: TestIdentity, opts: { expiresIn?: string } = {}) {
    const token = await tokenFor(who, opts);
    const socket = io(url, { auth: { token }, transports: ['websocket'], reconnection: false, forceNew: true });
    sockets.push(socket);
    await new Promise<void>((resolve, reject) => {
      socket.once('connect', resolve);
      socket.once('connect_error', reject);
    });
    return socket;
  }

  const join = (s: Socket, orgId: string, projectId: string) =>
    s.emitWithAck(WS.joinProject, { orgId, projectId }) as Promise<{ ok: boolean; error?: string }>;

  /** Collects activity events until `count` arrive or the timeout passes. */
  const collect = (s: Socket, count: number, ms = 1500) =>
    new Promise<ActivityEventDto[]>((resolve) => {
      const got: ActivityEventDto[] = [];
      const done = () => {
        s.off(WS.activity, on);
        resolve(got);
      };
      const on = (e: ActivityEventDto) => {
        got.push(e);
        if (got.length >= count) done();
      };
      s.on(WS.activity, on);
      setTimeout(done, ms);
    });

  const comment = async (who: TestIdentity, w: World, body: string, projectId = w.project.id) =>
    (await t.as(who)).post(`/orgs/${w.org.id}/projects/${projectId}/comments`).send({ body }).expect(201);

  it('rejects connections without a valid token', async () => {
    const socket = io(url, { auth: { token: 'nope' }, transports: ['websocket'], reconnection: false, forceNew: true });
    sockets.push(socket);
    const err = await new Promise<Error>((resolve) => socket.once('connect_error', resolve));
    expect(err.message).toBe('unauthorized');
  });

  it('delivers a comment to everyone watching the project, live', async () => {
    const owner = await connect(a.owner);
    const client = await connect(a.client);
    expect(await join(owner, a.org.id, a.project.id)).toEqual({ ok: true });
    expect(await join(client, a.org.id, a.project.id)).toEqual({ ok: true });

    const received = collect(client, 1);
    await comment(a.owner, a, 'Kickoff notes are in the drive.');
    const [event] = await received;
    expect(event).toMatchObject({
      type: 'comment.created',
      projectId: a.project.id,
      actor: { name: 'Golf Owner' },
      data: { comment: { body: 'Kickoff notes are in the drive.' } },
    });
  });

  it('refuses to join rooms the user cannot see', async () => {
    const outsider = await connect(b.owner);
    const client = await connect(a.client);
    expect(await join(outsider, a.org.id, a.project.id)).toEqual({ ok: false, error: 'not_found' });
    expect(await join(client, a.org.id, a.hiddenProject.id)).toEqual({ ok: false, error: 'not_found' });
    // A forged pairing of A's org with B's project is refused too.
    expect(await join(await connect(a.owner), a.org.id, b.project.id)).toEqual({ ok: false, error: 'not_found' });
  });

  it('scopes events by tenant and project', async () => {
    const watcher = await connect(a.member);
    await join(watcher, a.org.id, a.project.id);
    const received = collect(watcher, 10, 1000);
    await comment(b.owner, b, 'Other tenant');
    await comment(a.owner, a, 'Other project', a.hiddenProject.id);
    await comment(a.owner, a, 'This project');
    const events = await received;
    expect(events.map((e) => (e.data.comment as { body: string }).body)).toEqual(['This project']);
  });

  it('resyncs missed events from the REST cursor after a disconnect', async () => {
    const socket = await connect(a.client);
    await join(socket, a.org.id, a.project.id);
    const first = collect(socket, 1);
    await comment(a.owner, a, 'Before the drop');
    const [seen] = await first;

    socket.disconnect();
    await comment(a.owner, a, 'Missed 1');
    await comment(a.member, a, 'Missed 2');

    // What the browser does on reconnect: fetch everything after the last seq it saw.
    const res = await (await t.as(a.client))
      .get(`/orgs/${a.org.id}/projects/${a.project.id}/activity?after=${seen!.seq}`)
      .expect(200);
    expect(res.body.items.map((e: ActivityEventDto) => (e.data.comment as { body: string }).body)).toEqual([
      'Missed 1',
      'Missed 2',
    ]);
    expect(BigInt(res.body.items[0].seq)).toBeGreaterThan(BigInt(seen!.seq));
  });

  it('stops sending to a client the moment they are unassigned', async () => {
    const socket = await connect(a.client);
    await join(socket, a.org.id, a.project.id);
    const revoked = new Promise((resolve) => socket.once(WS.accessRevoked, resolve));
    const clientUserId = a.membershipOf(a.client).user.id;
    await (await t.as(a.owner))
      .delete(`/orgs/${a.org.id}/projects/${a.project.id}/clients/${clientUserId}`)
      .expect(204);
    expect(await revoked).toEqual({ orgId: a.org.id, projectId: a.project.id });

    const after = collect(socket, 1, 800);
    await comment(a.owner, a, 'Internal follow-up');
    expect(await after).toEqual([]);
  });

  it('closes the socket when the access token expires', async () => {
    const socket = await connect(identity('Short Lived'), { expiresIn: '2s' });
    const reason = await new Promise<string>((resolve) => socket.once('disconnect', resolve));
    expect(reason).toBe('io server disconnect');
  });
});
