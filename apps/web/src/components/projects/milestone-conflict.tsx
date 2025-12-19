'use client';

import { useState } from 'react';
import { formatCents } from '@scopeflow/shared';
import type { Milestone } from '@/lib/types';
import { formatDate } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { MILESTONE_STATUS_LABEL } from '@/components/status';

type Payload = {
  title: string;
  description: string;
  dueDate: string | null;
  amountCents: number;
  status: Milestone['status'];
};

const FIELDS: Array<{ key: keyof Payload; label: string; show: (v: Payload[keyof Payload]) => string }> = [
  { key: 'title', label: 'Title', show: (v) => String(v || '—') },
  { key: 'description', label: 'Description', show: (v) => String(v || '—') },
  { key: 'status', label: 'Status', show: (v) => MILESTONE_STATUS_LABEL[v as Milestone['status']] },
  { key: 'dueDate', label: 'Due date', show: (v) => formatDate(v as string | null) },
  { key: 'amountCents', label: 'Amount', show: (v) => formatCents(Number(v)) },
];

const normalizeDate = (d: string | null) => (d ? d.slice(0, 10) : null);

/**
 * Field-by-field merge after a 409. Fields where the versions agree are hidden; for the
 * rest the user picks theirs or the server's. Nothing is overwritten silently.
 */
export function MilestoneConflict({ mine, theirs, onResolve, onCancel }: {
  mine: Payload;
  theirs: Milestone;
  onResolve: (resolved: Payload) => Promise<void>;
  onCancel: () => void;
}) {
  const server: Payload = {
    title: theirs.title,
    description: theirs.description,
    status: theirs.status,
    dueDate: normalizeDate(theirs.dueDate),
    amountCents: theirs.amountCents,
  };
  const differing = FIELDS.filter((f) => String(mine[f.key] ?? '') !== String(server[f.key] ?? ''));
  const [choice, setChoice] = useState<Record<string, 'mine' | 'theirs'>>(
    Object.fromEntries(differing.map((f) => [f.key, 'mine'])),
  );
  const [pending, setPending] = useState(false);

  const resolved = Object.fromEntries(
    FIELDS.map((f) => [f.key, choice[f.key] === 'mine' ? mine[f.key] : server[f.key]]),
  ) as Payload;

  return (
    <div className="space-y-4">
      {differing.length === 0 ? (
        <p className="text-sm">The other change matches yours. Saving will keep the current values.</p>
      ) : (
        <fieldset className="space-y-3">
          <legend className="sr-only">Choose a value for each changed field</legend>
          <div className="hidden grid-cols-[8rem_1fr_1fr] gap-3 text-xs font-medium uppercase tracking-wide text-muted sm:grid">
            <span>Field</span>
            <span>Your edit</span>
            <span>Saved by someone else</span>
          </div>
          {differing.map((f) => (
            <div key={f.key} className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-[8rem_1fr_1fr] sm:items-start sm:gap-3">
              <span className="text-sm font-medium">{f.label}</span>
              {(['mine', 'theirs'] as const).map((side) => (
                <div
                  key={side}
                  className="flex items-start gap-2 rounded-md border border-border p-2 text-sm has-[:checked]:border-accent has-[:checked]:bg-accent-soft"
                >
                  <input
                    type="radio"
                    id={`conflict-${f.key}-${side}`}
                    name={`conflict-${f.key}`}
                    className="mt-1"
                    checked={choice[f.key] === side}
                    onChange={() => setChoice((c) => ({ ...c, [f.key]: side }))}
                  />
                  <label htmlFor={`conflict-${f.key}-${side}`} className="flex-1 cursor-pointer">
                    <span className="block text-xs text-muted sm:hidden">
                      {side === 'mine' ? 'Your edit' : 'Saved by someone else'}
                    </span>
                    <span className="sr-only">{side === 'mine' ? 'Keep your edit: ' : 'Keep the saved value: '}</span>
                    <span className="break-words">{f.show(side === 'mine' ? mine[f.key] : server[f.key])}</span>
                  </label>
                </div>
              ))}
            </div>
          ))}
        </fieldset>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>
          Discard my edit
        </Button>
        <Button
          loading={pending}
          onClick={async () => {
            setPending(true);
            try {
              await onResolve(resolved);
            } finally {
              setPending(false);
            }
          }}
        >
          Save merged version
        </Button>
      </div>
    </div>
  );
}
