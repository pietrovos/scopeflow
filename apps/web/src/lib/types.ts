import type { ActivityEventDto, MilestoneStatus, Plan, ProjectStatus, Role } from '@scopeflow/shared';

export type { ActivityEventDto };

export interface Me {
  user: { id: string; email: string; name: string };
  organizations: OrgSummary[];
}

export interface OrgSummary {
  id: string;
  name: string;
  slug: string;
  plan: Plan;
  role: Role;
  subscriptionStatus: string | null;
  currentPeriodEnd: string | null;
}

export interface Project {
  id: string;
  orgId: string;
  name: string;
  clientName: string;
  description: string;
  status: ProjectStatus;
  budgetCents: number;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectListItem extends Project {
  milestoneCount: number;
  milestonesDone: number;
  pendingScopeChanges: number;
}

export interface Milestone {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: MilestoneStatus;
  dueDate: string | null;
  amountCents: number;
  position: number;
  version: number;
  updatedAt: string;
}

export interface Person {
  id: string;
  name: string;
  email: string;
}

export interface ProjectDetail extends Project {
  milestones: Milestone[];
  clients: Person[];
  viewerRole: Role;
  canEdit: boolean;
}

export interface Member {
  id: string;
  role: Role;
  createdAt: string;
  user: Person;
}

export interface Invitation {
  id: string;
  email: string;
  role: Role;
  projectIds: string[];
  expiresAt: string;
  createdAt: string;
  invitedBy: { id: string; name: string };
  url?: string;
}

export interface InvitationPreview {
  orgName: string;
  inviterName: string;
  email: string;
  role: Role;
  status: 'pending' | 'accepted' | 'expired';
}
