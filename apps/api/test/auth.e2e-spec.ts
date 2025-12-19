import request from 'supertest';
import { generateKeyPair } from 'jose';
import { createTestApp, type TestApp } from './support/app.js';
import { identity, tokenFor } from './support/auth.js';
import { ownerDb, resetDatabase } from './support/db.js';

describe('authentication', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp();
  });
  beforeEach(resetDatabase);
  afterAll(() => t.close());

  const me = (token?: string) => {
    const req = request(t.server).get('/me');
    return token ? req.set('Authorization', `Bearer ${token}`) : req;
  };

  it('rejects requests without a token', async () => {
    await me().expect(401);
  });

  it.each([
    ['a different issuer', { issuer: 'https://evil.test/realms/scopeflow' }],
    ['a different audience', { audience: 'some-other-api' }],
    ['an expired token', { expiresIn: '-1m' }],
  ])('rejects %s', async (_label, overrides) => {
    await me(await tokenFor(identity('Eve'), overrides)).expect(401);
  });

  it('rejects a token signed by an unknown key', async () => {
    const { privateKey } = await generateKeyPair('RS256');
    await me(await tokenFor(identity('Eve'), { key: privateKey })).expect(401);
  });

  it('creates the user on first sign-in and reuses it after', async () => {
    const ada = identity('Ada Lovelace');
    const first = await me(await tokenFor(ada)).expect(200);
    const second = await me(await tokenFor(ada)).expect(200);
    expect(first.body.user).toMatchObject({ email: ada.email, name: 'Ada Lovelace' });
    expect(second.body.user.id).toBe(first.body.user.id);
    expect(first.body.organizations).toEqual([]);
  });

  it('links a pre-created user by verified email only', async () => {
    const seeded = await ownerDb.user.create({ data: { email: 'seeded@example.test', name: 'Seeded' } });
    const unverified = { sub: 'kc-unverified', email: 'seeded@example.test', name: 'Imposter' };
    // An unverified email must not take over the seeded account (and cannot create a duplicate).
    await me(await tokenFor(unverified, { emailVerified: false })).expect(401);

    const verified = { sub: 'kc-verified', email: 'seeded@example.test', name: 'Seeded' };
    const res = await me(await tokenFor(verified)).expect(200);
    expect(res.body.user.id).toBe(seeded.id);
  });
});
