import { resolve } from 'node:path';

try {
  process.loadEnvFile(resolve(import.meta.dirname, '../../../../.env'));
} catch {
  // CI provides the variables directly.
}

// Point everything at the test database before any app module reads the env.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.DATABASE_OWNER_URL = process.env.TEST_DATABASE_OWNER_URL;
process.env.OIDC_ISSUER = 'https://issuer.test/realms/scopeflow';
process.env.OIDC_INTERNAL_URL = '';
process.env.OIDC_AUDIENCE = 'scopeflow-api';
process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret';
process.env.STRIPE_PRICE_PRO = 'price_pro_test';
process.env.STRIPE_PRICE_AGENCY = 'price_agency_test';
