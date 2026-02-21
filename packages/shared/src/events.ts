/** Socket.io event names shared by the gateway and the browser. */
export const WS = {
  joinProject: 'project:join',
  leaveProject: 'project:leave',
  activity: 'activity',
  accessRevoked: 'access:revoked',
} as const;

export const ACTIVITY_TYPES = [
  'org.created',
  'member.invited',
  'member.joined',
  'member.role_changed',
  'member.removed',
  'project.created',
  'project.updated',
  'project.client_assigned',
  'project.client_unassigned',
  'milestone.created',
  'milestone.updated',
  'milestone.deleted',
  'scope_change.created',
  'scope_change.revised',
  'scope_change.approved',
  'scope_change.rejected',
  'scope_change.withdrawn',
  'comment.created',
  'billing.plan_changed',
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

/** Shape of an activity event on the wire. `seq` is a decimal string (it is a bigint). */
export interface ActivityEventDto {
  seq: string;
  orgId: string;
  projectId: string | null;
  type: ActivityType;
  entityType: string;
  entityId: string;
  data: Record<string, unknown>;
  actor: { id: string; name: string } | null;
  createdAt: string;
}

export interface CommentDto {
  id: string;
  body: string;
  projectId: string;
  scopeChangeId: string | null;
  createdAt: string;
  author: { id: string; name: string };
}
