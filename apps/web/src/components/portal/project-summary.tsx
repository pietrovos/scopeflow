import { formatCents } from '@scopeflow/shared';
import type { ProjectDetail } from '@/lib/types';
import { formatDate } from '@/lib/format';
import { Card } from '@/components/ui/card';

/** Headline numbers a client cares about: progress, budget, what's next. */
export function ProjectSummary({ project }: { project: ProjectDetail }) {
  const done = project.milestones.filter((m) => m.status === 'DONE').length;
  const total = project.milestones.length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const next = project.milestones.find((m) => m.status !== 'DONE');

  return (
    <Card className="grid gap-6 p-5 sm:grid-cols-[auto_1fr] sm:items-center">
      <ProgressRing pct={pct} />
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm lg:grid-cols-4">
        <div>
          <dt className="text-muted">Milestones</dt>
          <dd className="mt-0.5 text-lg font-semibold">
            {done}/{total} done
          </dd>
        </div>
        <div>
          <dt className="text-muted">Budget</dt>
          <dd className="mt-0.5 text-lg font-semibold">{formatCents(project.budgetCents)}</dd>
        </div>
        <div>
          <dt className="text-muted">Target date</dt>
          <dd className="mt-0.5 text-lg font-semibold">{formatDate(project.dueDate)}</dd>
        </div>
        <div>
          <dt className="text-muted">Up next</dt>
          <dd className="mt-0.5 truncate text-lg font-semibold">{next ? next.title : 'All done'}</dd>
        </div>
      </dl>
    </Card>
  );
}

function ProgressRing({ pct }: { pct: number }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative mx-auto size-24" role="img" aria-label={`${pct}% of milestones complete`}>
      <svg viewBox="0 0 80 80" className="size-24 -rotate-90" aria-hidden="true">
        <circle cx="40" cy="40" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="8" />
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (pct / 100) * c}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-lg font-semibold" aria-hidden="true">
        {pct}%
      </span>
    </div>
  );
}
