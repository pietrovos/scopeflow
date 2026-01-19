import { diffWords, formatCents, formatDayDelta } from '@scopeflow/shared';
import type { Revision } from '@/lib/types';
import { cn } from '@/lib/cn';

type Content = Pick<Revision, 'title' | 'description' | 'priceDeltaCents' | 'deadlineDeltaDays'>;

/** Inline word diff: removed text struck through in red, added text underlined in green. */
export function TextDiff({ before, after }: { before: string; after: string }) {
  return (
    <p className="whitespace-pre-wrap break-words text-sm leading-6">
      {diffWords(before, after).map((part, i) =>
        part.kind === 'same' ? (
          <span key={i}>{part.text}</span>
        ) : part.kind === 'added' ? (
          <ins key={i} className="rounded-sm bg-success-soft text-success no-underline decoration-success">
            <span className="sr-only">[added: </span>
            {part.text}
            <span className="sr-only">]</span>
          </ins>
        ) : (
          <del key={i} className="rounded-sm bg-danger-soft text-danger">
            <span className="sr-only">[removed: </span>
            {part.text}
            <span className="sr-only">]</span>
          </del>
        ),
      )}
    </p>
  );
}

function Change({ label, before, after }: { label: string; before: string; after: string }) {
  const changed = before !== after;
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
      <span className="text-muted">{label}</span>
      {changed ? (
        <span>
          <del className="text-muted">{before}</del>
          <span aria-hidden="true" className="px-1.5 text-muted">
            →
          </span>
          <span className="sr-only"> changed to </span>
          <strong className="font-semibold">{after}</strong>
        </span>
      ) : (
        <span className="text-muted">{after} (unchanged)</span>
      )}
    </div>
  );
}

/** What changed between two revisions of a proposal (or a revision and a draft). */
export function RevisionDiff({ from, to, className }: { from: Content; to: Content; className?: string }) {
  return (
    <div className={cn('space-y-3', className)}>
      <div className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-2 sm:gap-x-6">
        <Change
          label="Price impact"
          before={formatCents(from.priceDeltaCents, { signed: true })}
          after={formatCents(to.priceDeltaCents, { signed: true })}
        />
        <Change
          label="Schedule impact"
          before={formatDayDelta(from.deadlineDeltaDays)}
          after={formatDayDelta(to.deadlineDeltaDays)}
        />
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted">Title</p>
        <TextDiff before={from.title} after={to.title} />
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted">Description</p>
        <TextDiff before={from.description} after={to.description} />
      </div>
    </div>
  );
}
