export const ROLES = ['OWNER', 'ADMIN', 'MEMBER', 'CLIENT'] as const;
export type Role = (typeof ROLES)[number];

export const STAFF_ROLES: readonly Role[] = ['OWNER', 'ADMIN', 'MEMBER'];
export const MANAGER_ROLES: readonly Role[] = ['OWNER', 'ADMIN'];

export const isStaff = (role: Role) => STAFF_ROLES.includes(role);
export const isManager = (role: Role) => MANAGER_ROLES.includes(role);

export const ROLE_LABELS: Record<Role, string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  MEMBER: 'Team member',
  CLIENT: 'Client',
};
