import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/bootstrap.js';

export interface TestApp {
  app: INestApplication;
  server: Server;
  close: () => Promise<void>;
}

export async function createTestApp(): Promise<TestApp> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication({ rawBody: true, logger: false });
  configureApp(app);
  await app.init();
  return { app, server: app.getHttpServer() as Server, close: () => app.close() };
}
