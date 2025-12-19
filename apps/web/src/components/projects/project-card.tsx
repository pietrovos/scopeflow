import Link from 'next/link';
import { formatCents } from '@scopeflow/shared';
import type { ProjectListItem } from '@/lib/types';
import { formatDate } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { ProjectStatusBadge } from '@/components/status';

export function ProjectCard({ orgId, project }: { orgId: string; project: ProjectListItem }) {
  const pct = project.milestoneCount ? Math.round((project.milestonesDone / project.milestoneCount) * 100) : 0;
  return (
    <Link
      href={`/orgs/${orgId}/projects/${project.id}`}
      className="group flex flex-col rounded-lg border border-border bg-surface p-5 shadow-sm transition hover:border-border-strong hover:shadow"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate font-semibold group-hover:text-accent">{project.name}</h2>
          <p className="truncate text-sm text-muted">{project.clientName}</p>
        </div>
        <ProjectStatusBadge status={project.status} />
      </div>

      <div className="mt-5">
        <div className="flex justify-between text-xs text-muted">
          <span>
            {project.milestonesDone}/{project.milestoneCount} milestones
          </span>
          <span>{pct}%</span>
        </div>
        <div
          className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2"
          role="progressbar"
          aria-label={`${project.name} progress`}
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
        <span>Due {formatDate(project.dueDate)}</span>
        {project.budgetCents > 0 && <span>{formatCents(project.budgetCents)}</span>}
        {project.pendingScopeChanges > 0 && (
          <Badge tone="warning">
            {project.pendingScopeChanges} pending change{project.pendingScopeChanges === 1 ? '' : 's'}
          </Badge>
        )}
      </div>
    </Link>
  );
}
