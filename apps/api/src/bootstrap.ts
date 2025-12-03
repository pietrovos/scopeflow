import type { INestApplication } from '@nestjs/common';
import { ENV, type Env } from './config/env.js';

/** Shared by main.ts and the e2e tests so both run the same middleware stack. */
export function configureApp(app: INestApplication) {
  const env = app.get<Env>(ENV);
  app.enableCors({ origin: env.WEB_URL, credentials: true });
  app.enableShutdownHooks();
}
