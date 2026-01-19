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
  scope: ScopeTotals;
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

export type ScopeChangeStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN';

export interface Revision {
  id: string;
  revisionNumber: number;
  title: string;
  description: string;
  priceDeltaCents: number;
  deadlineDeltaDays: number;
  createdAt: string;
  createdBy: { id: string; name: string };
}

export interface ScopeChangeSummary {
  id: string;
  projectId: string;
  number: number;
  status: ScopeChangeStatus;
  currentRevisionId: string | null;
  approvedRevisionId: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; name: string };
  currentRevision: Revision | null;
  project: { id: string; name: string; clientName: string };
}

export interface Decision {
  id: string;
  revisionId: string;
  decision: 'APPROVED' | 'REJECTED';
  note: string;
  createdAt: string;
  decidedBy: { id: string; name: string };
}

export interface ScopeChangeDetail extends ScopeChangeSummary {
  revisions: Revision[];
  decisions: Decision[];
}

export interface ScopeTotals {
  approvedCount: number;
  approvedPriceDeltaCents: number;
  approvedDeadlineDeltaDays: number;
  pendingCount: number;
}
