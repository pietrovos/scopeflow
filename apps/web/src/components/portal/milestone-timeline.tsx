import { formatCents } from '@scopeflow/shared';
import type { Milestone } from '@/lib/types';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/cn';
import { MILESTONE_STATUS_LABEL } from '@/components/status';

/** Read-only, client-facing view of project milestones as a vertical timeline. */
export function MilestoneTimeline({ milestones }: { milestones: Milestone[] }) {
  if (milestones.length === 0) {
    return <p className="px-5 py-6 text-sm text-muted">The agency hasn’t published milestones yet.</p>;
  }
  return (
    <ol className="px-5 py-4">
      {milestones.map((m, i) => {
        const last = i === milestones.length - 1;
        return (
          <li key={m.id} className="relative flex gap-4 pb-6 last:pb-0">
            {!last && (
              <span
                aria-hidden="true"
                className={cn(
                  'absolute left-[11px] top-7 h-[calc(100%-1.5rem)] w-0.5',
                  m.status === 'DONE' ? 'bg-success' : 'bg-border',
                )}
              />
            )}
            <StatusDot status={m.status} />
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <p className={cn('font-medium', m.status === 'DONE' && 'text-muted line-through decoration-1')}>
                  {m.title}
                </p>
                <p className="text-sm text-muted">{formatDate(m.dueDate)}</p>
              </div>
              <p className="text-sm text-muted">
                <span className="sr-only">Status: </span>
                {MILESTONE_STATUS_LABEL[m.status]}
                {m.amountCents > 0 && ` · ${formatCents(m.amountCents)}`}
              </p>
              {m.description && <p className="mt-1 text-sm">{m.description}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function StatusDot({ status }: { status: Milestone['status'] }) {
  if (status === 'DONE') {
    return (
      <span
        className="relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full bg-success text-white"
        aria-hidden="true"
      >
        <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="3">
          <path d="M5 12l5 5 9-10" />
        </svg>
      </span>
    );
  }
  if (status === 'IN_PROGRESS') {
    return (
      <span
        className="relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-accent bg-surface"
        aria-hidden="true"
      >
        <span className="size-2.5 rounded-full bg-accent" />
      </span>
    );
  }
  return (
    <span
      className="relative z-10 size-6 shrink-0 rounded-full border-2 border-border-strong bg-surface"
      aria-hidden="true"
    />
  );
}
