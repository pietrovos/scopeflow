import type { AuthUser } from './auth/users.service.js';
import type { TenantContext } from './tenancy/tenant-context.js';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      tenant?: TenantContext;
    }
  }
}

export {};
