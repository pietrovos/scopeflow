'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { formatCents, MILESTONE_STATUSES, type MilestoneStatus } from '@scopeflow/shared';
import type { Milestone } from '@/lib/types';
import { useApi } from '@/lib/api-context';
import { ApiError } from '@/lib/api-error';
import { formatDate, toDateInput } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { EmptyState, ErrorNotice } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { MILESTONE_STATUS_LABEL, MilestoneStatusBadge } from '@/components/status';
import { MilestoneConflict } from './milestone-conflict';

interface Props {
  orgId: string;
  projectId: string;
  milestones: Milestone[];
  canEdit: boolean;
}

type Draft = { title: string; description: string; dueDate: string; amount: string; status: MilestoneStatus };

const toDraft = (m?: Milestone): Draft => ({
  title: m?.title ?? '',
  description: m?.description ?? '',
  dueDate: toDateInput(m?.dueDate),
  amount: m && m.amountCents ? String(m.amountCents / 100) : '',
  status: m?.status ?? 'PLANNED',
});

const toPayload = (d: Draft) => ({
  title: d.title,
  description: d.description,
  dueDate: d.dueDate || null,
  amountCents: d.amount ? Math.round(Number(d.amount.replace(/[^0-9.]/g, '')) * 100) : 0,
  status: d.status,
});

export function MilestoneList({ orgId, projectId, milestones, canEdit }: Props) {
  const api = useApi();
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState<Milestone | 'new' | null>(null);
  const [conflict, setConflict] = useState<{ mine: Draft; base: Milestone; theirs: Milestone } | null>(null);
  const base = `/orgs/${orgId}/projects/${projectId}/milestones`;

  async function quickStatus(m: Milestone, status: MilestoneStatus) {
    try {
      await api.patch(`${base}/${m.id}`, { status, version: m.version });
      router.refresh();
    } catch (e) {
      if (e instanceof ApiError && e.isConflict) {
        setConflict({ mine: { ...toDraft(m), status }, base: m, theirs: e.body.current as Milestone });
      } else toast(e instanceof Error ? e.message : 'Update failed', 'error');
    }
  }

  async function remove(m: Milestone) {
    if (!confirm(`Delete milestone “${m.title}”?`)) return;
    try {
      await api.del(`${base}/${m.id}`);
      toast('Milestone deleted');
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Delete failed', 'error');
    }
  }

  return (
    <Card>
      <CardHeader
        title="Milestones"
        description={`${milestones.filter((m) => m.status === 'DONE').length} of ${milestones.length} complete`}
        action={
          canEdit ? (
            <Button size="sm" variant="secondary" onClick={() => setEditing('new')}>
              Add milestone
            </Button>
          ) : undefined
        }
      />
      {milestones.length === 0 ? (
        <EmptyState
          title="No milestones yet"
          description={canEdit ? 'Break the project into deliverables your client can follow.' : 'The agency hasn’t added milestones yet.'}
        />
      ) : (
        <ol className="divide-y divide-border">
          {milestones.map((m, i) => (
            <li key={m.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold text-muted">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="font-medium">{m.title}</p>
                  {m.description && <p className="mt-0.5 line-clamp-2 text-sm text-muted">{m.description}</p>}
                  <p className="mt-1 text-xs text-muted">
                    Due {formatDate(m.dueDate)}
                    {m.amountCents > 0 && ` · ${formatCents(m.amountCents)}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 pl-9 sm:pl-0">
                {canEdit ? (
                  <>
                    <label className="sr-only" htmlFor={`status-${m.id}`}>
                      Status of {m.title}
                    </label>
                    <Select
                      id={`status-${m.id}`}
                      value={m.status}
                      onChange={(e) => quickStatus(m, e.target.value as MilestoneStatus)}
                      className="h-8 w-36"
                    >
                      {MILESTONE_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {MILESTONE_STATUS_LABEL[s]}
                        </option>
                      ))}
                    </Select>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(m)} aria-label={`Edit ${m.title}`}>
                      Edit
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(m)} aria-label={`Delete ${m.title}`}>
                      Delete
                    </Button>
                  </>
                ) : (
                  <MilestoneStatusBadge status={m.status} />
                )}
              </div>
            </li>
          ))}
        </ol>
      )}

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Add milestone' : 'Edit milestone'}
      >
        {editing !== null && (
          <MilestoneForm
            key={editing === 'new' ? 'new' : `${editing.id}-${editing.version}`}
            initial={editing === 'new' ? undefined : editing}
            onCancel={() => setEditing(null)}
            onSubmit={async (draft) => {
              if (editing === 'new') {
                await api.post(base, toPayload(draft));
                toast('Milestone added');
              } else {
                try {
                  await api.patch(`${base}/${editing.id}`, { ...toPayload(draft), version: editing.version });
                  toast('Milestone saved');
                } catch (e) {
                  if (e instanceof ApiError && e.isConflict) {
                    setConflict({ mine: draft, base: editing, theirs: e.body.current as Milestone });
                    setEditing(null);
                    return;
                  }
                  throw e;
                }
              }
              setEditing(null);
              router.refresh();
            }}
          />
        )}
      </Dialog>

      <Dialog
        open={conflict !== null}
        onClose={() => setConflict(null)}
        title="Someone else changed this milestone"
        description="Your changes were not saved. Compare the versions and choose what to keep."
        className="max-w-2xl"
      >
        {conflict && (
          <MilestoneConflict
            mine={toPayload(conflict.mine)}
            theirs={conflict.theirs}
            onCancel={() => {
              setConflict(null);
              router.refresh();
            }}
            onResolve={async (resolved) => {
              try {
                await api.patch(`${base}/${conflict.theirs.id}`, { ...resolved, version: conflict.theirs.version });
                toast('Milestone saved');
                setConflict(null);
                router.refresh();
              } catch (e) {
                if (e instanceof ApiError && e.isConflict) {
                  // Changed again while resolving: show the newest server state.
                  setConflict({ ...conflict, theirs: e.body.current as Milestone });
                } else throw e;
              }
            }}
          />
        )}
      </Dialog>
    </Card>
  );
}

function MilestoneForm({ initial, onSubmit, onCancel }: {
  initial?: Milestone;
  onSubmit: (d: Draft) => Promise<void>;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(toDraft(initial));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [pending, setPending] = useState(false);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setErrors({});
        setFormError(undefined);
        try {
          await onSubmit(draft);
        } catch (err) {
          if (err instanceof ApiError && err.body.issues) setErrors(err.fieldErrors());
          else setFormError(err instanceof Error ? err.message : 'Save failed');
        } finally {
          setPending(false);
        }
      }}
    >
      {formError && <ErrorNotice title="Couldn’t save">{formError}</ErrorNotice>}
      <Field label="Title" error={errors.title}>
        {(p) => <Input {...p} value={draft.title} onChange={(e) => set('title', e.target.value)} required maxLength={160} />}
      </Field>
      <Field label="Description" error={errors.description}>
        {(p) => <Textarea {...p} value={draft.description} onChange={(e) => set('description', e.target.value)} />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Due date" error={errors.dueDate}>
          {(p) => <Input {...p} type="date" value={draft.dueDate} onChange={(e) => set('dueDate', e.target.value)} />}
        </Field>
        <Field label="Amount (USD)" error={errors.amountCents}>
          {(p) => <Input {...p} inputMode="decimal" value={draft.amount} onChange={(e) => set('amount', e.target.value)} />}
        </Field>
        <Field label="Status" error={errors.status}>
          {(p) => (
            <Select {...p} value={draft.status} onChange={(e) => set('status', e.target.value as MilestoneStatus)}>
              {MILESTONE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {MILESTONE_STATUS_LABEL[s]}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={pending}>
          Save
        </Button>
      </div>
    </form>
  );
}
