import { formatCents, formatDayDelta, ROLE_LABELS, type Role } from '@scopeflow/shared';
import type { ActivityEventDto } from './types';

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const num = (v: unknown) => (typeof v === 'number' ? v : 0);
const sc = (d: Record<string, unknown>) => `SC-${num(d.number)} “${str(d.title)}”`;

/** One-line, human description of an activity/audit event (actor name is shown separately). */
export function describeActivity(e: Pick<ActivityEventDto, 'type' | 'data'>): string {
  const d = e.data;
  switch (e.type) {
    case 'org.created':
      return `created the organization ${str(d.name)}`;
    case 'member.invited':
      return `invited ${str(d.email)} as ${ROLE_LABELS[d.role as Role]?.toLowerCase() ?? 'member'}`;
    case 'member.joined':
      return `joined as ${ROLE_LABELS[d.role as Role]?.toLowerCase() ?? 'member'}`;
    case 'member.role_changed':
      return `changed ${str(d.userName)}’s role to ${ROLE_LABELS[d.to as Role]?.toLowerCase() ?? ''}`;
    case 'member.removed':
      return `removed ${str(d.userName)}`;
    case 'project.created':
      return `created project ${str(d.name)}`;
    case 'project.updated':
      return d.status
        ? `marked the project ${str(d.status).toLowerCase().replace('_', ' ')}`
        : 'updated project details';
    case 'project.client_assigned':
      return `gave ${str(d.userName)} access to this project`;
    case 'project.client_unassigned':
      return 'removed a client’s access to this project';
    case 'milestone.created':
      return `added milestone “${str(d.title)}”`;
    case 'milestone.updated':
      return d.status
        ? `moved “${str(d.title)}” to ${str(d.status).toLowerCase().replace('_', ' ')}`
        : `edited milestone “${str(d.title)}”`;
    case 'milestone.deleted':
      return `deleted milestone “${str(d.title)}”`;
    case 'scope_change.created':
      return `proposed ${sc(d)} (${formatCents(num(d.priceDeltaCents), { signed: true })})`;
    case 'scope_change.revised':
      return `${d.reopened ? 'revised and resubmitted' : 'revised'} ${sc(d)} → revision ${num(d.revisionNumber)}`;
    case 'scope_change.approved':
      return `approved revision ${num(d.revisionNumber)} of ${sc(d)} (${formatCents(num(d.priceDeltaCents), {
        signed: true,
      })}, ${formatDayDelta(num(d.deadlineDeltaDays))})`;
    case 'scope_change.rejected':
      return `rejected revision ${num(d.revisionNumber)} of ${sc(d)}`;
    case 'scope_change.withdrawn':
      return `withdrew ${sc(d)}`;
    case 'comment.created':
      return 'commented';
    case 'billing.plan_changed':
      return `changed the plan to ${str(d.plan)}`;
    default:
      return e.type;
  }
}
