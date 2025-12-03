import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().default(4100),
  WEB_URL: z.url().default('http://localhost:3100'),
  DATABASE_URL: z.string().min(1),
  DATABASE_OWNER_URL: z.string().min(1),
  OIDC_ISSUER: z.url(),
  OIDC_INTERNAL_URL: z.url().optional(),
  OIDC_AUDIENCE: z.string().min(1).default('scopeflow-api'),
  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().int().default(1125),
  MAIL_FROM: z.string().default('ScopeFlow <no-reply@scopeflow.local>'),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_PRO: z.string().optional(),
  STRIPE_PRICE_AGENCY: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

/** Treats empty strings as unset so a blank line in .env means "use the default". */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const cleaned = Object.fromEntries(Object.entries(source).filter(([, v]) => v !== ''));
  const parsed = schema.safeParse(cleaned);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment:\n${issues}`);
  }
  return parsed.data;
}

export const ENV = Symbol('ENV');
