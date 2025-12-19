import { SetMetadata } from '@nestjs/common';
import type { Role } from '@scopeflow/shared';

export const ROLES_KEY = 'roles';
/** Restricts an org-scoped route to the given membership roles. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
export const StaffOnly = () => Roles('OWNER', 'ADMIN', 'MEMBER');
export const ManagersOnly = () => Roles('OWNER', 'ADMIN');
