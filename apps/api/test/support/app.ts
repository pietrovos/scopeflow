import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/bootstrap.js';
import { JWKS } from '../../src/auth/jwt-verifier.service.js';
import { MAILER } from '../../src/mail/mailer.js';
import { MemoryMailer } from '../../src/mail/memory.mailer.js';
import { testJwks, tokenFor, type TestIdentity } from './auth.js';

export interface TestApp {
  app: INestApplication;
  server: Server;
  mailer: MemoryMailer;
  /** Supertest helpers that send `who`'s bearer token. */
  as: (who: TestIdentity) => Promise<Client>;
  close: () => Promise<void>;
}

export type Client = Record<'get' | 'post' | 'patch' | 'put' | 'delete', (url: string) => request.Test>;

export async function createTestApp(): Promise<TestApp> {
  const mailer = new MemoryMailer();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(JWKS)
    .useValue(testJwks)
    .overrideProvider(MAILER)
    .useValue(mailer)
    .compile();
  const app = moduleRef.createNestApplication({ rawBody: true, logger: ['error'] });
  configureApp(app);
  await app.init();
  const server = app.getHttpServer() as Server;

  const as = async (who: TestIdentity): Promise<Client> => {
    const token = await tokenFor(who);
    const wrap = (method: keyof Client) => (url: string) =>
      request(server)[method](url).set('Authorization', `Bearer ${token}`);
    return { get: wrap('get'), post: wrap('post'), patch: wrap('patch'), put: wrap('put'), delete: wrap('delete') };
  };

  return { app, server, mailer, as, close: () => app.close() };
}
