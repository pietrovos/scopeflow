import type { Role } from '@scopeflow/shared';

export interface NavItem {
  href: (orgId: string) => string;
  label: string;
  roles: readonly Role[];
  icon: 'projects' | 'approvals' | 'members' | 'audit' | 'billing';
}

const ALL: readonly Role[] = ['OWNER', 'ADMIN', 'MEMBER', 'CLIENT'];
const STAFF: readonly Role[] = ['OWNER', 'ADMIN', 'MEMBER'];
const MANAGERS: readonly Role[] = ['OWNER', 'ADMIN'];

export const NAV: NavItem[] = [
  { href: (o) => `/orgs/${o}/projects`, label: 'Projects', roles: ALL, icon: 'projects' },
  { href: (o) => `/orgs/${o}/approvals`, label: 'Approvals', roles: ALL, icon: 'approvals' },
  { href: (o) => `/orgs/${o}/members`, label: 'Team & clients', roles: STAFF, icon: 'members' },
  { href: (o) => `/orgs/${o}/audit`, label: 'Audit log', roles: STAFF, icon: 'audit' },
  { href: (o) => `/orgs/${o}/settings/billing`, label: 'Billing', roles: MANAGERS, icon: 'billing' },
];

export const navFor = (role: Role) => NAV.filter((item) => item.roles.includes(role));
