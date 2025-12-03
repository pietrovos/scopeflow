import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApp } from './bootstrap.js';
import { ENV, type Env } from './config/env.js';

try {
  process.loadEnvFile(resolve(import.meta.dirname, '../../../.env'));
} catch {
  // No .env file: the environment is provided by the container or CI.
}

const app = await NestFactory.create(AppModule, { rawBody: true });
configureApp(app);
const env = app.get<Env>(ENV);
await app.listen(env.API_PORT);
