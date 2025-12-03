import request from 'supertest';
import { createTestApp, type TestApp } from './support/app.js';

describe('GET /health', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());

  it('reports ok when the database is reachable', async () => {
    await request(t.server).get('/health').expect(200, { status: 'ok' });
  });
});
