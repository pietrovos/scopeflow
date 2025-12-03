import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client.js';

/** Owner connection for arranging fixtures and asserting on raw state in tests. */
export const ownerDb = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.TEST_DATABASE_OWNER_URL! }),
});

export async function resetDatabase() {
  await ownerDb.$executeRawUnsafe(`
    TRUNCATE users, organizations, processed_stripe_events RESTART IDENTITY CASCADE
  `);
}
