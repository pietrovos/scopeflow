import type { Role } from '@scopeflow/shared';
import type { DbContext } from '../db/tenant-db.service.js';

/** Who is acting, in which org, with what role. Built by TenantGuard from the database. */
export interface TenantContext extends DbContext {
  orgId: string;
  role: Role;
  userId: string;
}
