import type { MilestoneStatus, ProjectStatus } from '@scopeflow/shared';
import { Badge, type Tone } from '@/components/ui/badge';

const project: Record<ProjectStatus, [string, Tone]> = {
  ACTIVE: ['Active', 'success'],
  ON_HOLD: ['On hold', 'warning'],
  COMPLETED: ['Completed', 'accent'],
  ARCHIVED: ['Archived', 'neutral'],
};

const milestone: Record<MilestoneStatus, [string, Tone]> = {
  PLANNED: ['Planned', 'neutral'],
  IN_PROGRESS: ['In progress', 'accent'],
  DONE: ['Done', 'success'],
};

export const PROJECT_STATUS_LABEL = Object.fromEntries(Object.entries(project).map(([k, [l]]) => [k, l])) as Record<
  ProjectStatus,
  string
>;
export const MILESTONE_STATUS_LABEL = Object.fromEntries(
  Object.entries(milestone).map(([k, [l]]) => [k, l]),
) as Record<MilestoneStatus, string>;

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const [label, tone] = project[status];
  return <Badge tone={tone}>{label}</Badge>;
}

export function MilestoneStatusBadge({ status }: { status: MilestoneStatus }) {
  const [label, tone] = milestone[status];
  return <Badge tone={tone}>{label}</Badge>;
}
