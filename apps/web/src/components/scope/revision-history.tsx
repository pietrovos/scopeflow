'use client';

import { useState } from 'react';
import type { Decision, Revision } from '@/lib/types';
import { LocalTime } from '@/components/ui/local-time';
import { cn } from '@/lib/cn';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/field';
import { RevisionDiff } from './revision-diff';
import { Delta } from './scope-status';

/**
 * Every revision, newest first, with the decisions made on it. Any two revisions can be
 * compared; by default each one is diffed against the one before it.
 */
export function RevisionHistory({
  revisions,
  decisions,
  currentId,
  approvedId,
}: {
  revisions: Revision[];
  decisions: Decision[];
  currentId: string | null;
  approvedId: string | null;
}) {
  const latest = revisions.at(-1)!;
  const [toId, setToId] = useState(latest.id);
  const [fromId, setFromId] = useState(revisions.at(-2)?.id ?? latest.id);
  const from = revisions.find((r) => r.id === fromId)!;
  const to = revisions.find((r) => r.id === toId)!;

  return (
    <div className="space-y-6">
      {revisions.length > 1 && (
        <section aria-labelledby="compare-heading" className="space-y-3">
          <h3 id="compare-heading" className="font-semibold">
            Compare revisions
          </h3>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <label htmlFor="compare-from" className="text-muted">
              From
            </label>
            <Select id="compare-from" value={fromId} onChange={(e) => setFromId(e.target.value)} className="h-8 w-40">
              {revisions.map((r) => (
                <option key={r.id} value={r.id}>
                  Revision {r.revisionNumber}
                </option>
              ))}
            </Select>
            <label htmlFor="compare-to" className="text-muted">
              to
            </label>
            <Select id="compare-to" value={toId} onChange={(e) => setToId(e.target.value)} className="h-8 w-40">
              {revisions.map((r) => (
                <option key={r.id} value={r.id}>
                  Revision {r.revisionNumber}
                </option>
              ))}
            </Select>
          </div>
          <RevisionDiff from={from} to={to} />
        </section>
      )}

      <section aria-labelledby="history-heading">
        <h3 id="history-heading" className="font-semibold">
          History
        </h3>
        <ol className="mt-3 space-y-3">
          {[...revisions].reverse().map((r) => {
            const onThis = decisions.filter((d) => d.revisionId === r.id);
            return (
              <li
                key={r.id}
                className={cn('rounded-md border p-3', r.id === approvedId ? 'border-success/50' : 'border-border')}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">Revision {r.revisionNumber}</span>
                  {r.id === currentId && <Badge tone="accent">Current</Badge>}
                  {r.id === approvedId && <Badge tone="success">Approved</Badge>}
                  <span className="text-xs text-muted">
                    by {r.createdBy.name} · <LocalTime iso={r.createdAt} />
                  </span>
                </div>
                <p className="mt-1 text-sm">{r.title}</p>
                <div className="mt-1">
                  <Delta cents={r.priceDeltaCents} days={r.deadlineDeltaDays} />
                </div>
                {onThis.map((d) => (
                  <p key={d.id} className="mt-2 border-t border-border pt-2 text-sm">
                    <span className={d.decision === 'APPROVED' ? 'text-success' : 'text-danger'}>
                      {d.decision === 'APPROVED' ? 'Approved' : 'Rejected'}
                    </span>{' '}
                    by {d.decidedBy.name} · <LocalTime iso={d.createdAt} />
                    {d.note && <span className="mt-1 block text-muted">“{d.note}”</span>}
                  </p>
                ))}
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
