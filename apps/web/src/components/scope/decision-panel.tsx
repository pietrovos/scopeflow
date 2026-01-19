'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Revision, ScopeChangeDetail } from '@/lib/types';
import { useApi } from '@/lib/api-context';
import { ApiError } from '@/lib/api-error';
import { Button } from '@/components/ui/button';
import { Field, Textarea } from '@/components/ui/field';
import { ErrorNotice } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { RevisionDiff } from './revision-diff';
import { DayDelta, PriceDelta } from './scope-status';

/**
 * The client's approve/reject controls. The request names the revision on screen; if the
 * agency revised the proposal meanwhile, the API refuses with 409 and we show what changed.
 */
export function DecisionPanel({ orgId, projectId, sc }: { orgId: string; projectId: string; sc: ScopeChangeDetail }) {
  const api = useApi();
  const router = useRouter();
  const toast = useToast();
  const revision = sc.revisions.find((r) => r.id === sc.currentRevisionId)!;
  const [note, setNote] = useState('');
  const [pending, setPending] = useState<'APPROVED' | 'REJECTED' | null>(null);
  const [error, setError] = useState<string>();
  const [superseded, setSuperseded] = useState<{ seen: Revision; latest: Revision } | null>(null);

  async function decide(decision: 'APPROVED' | 'REJECTED') {
    setPending(decision);
    setError(undefined);
    try {
      await api.post(`/orgs/${orgId}/projects/${projectId}/scope-changes/${sc.id}/decision`, {
        revisionId: revision.id,
        decision,
        note,
      });
      toast(decision === 'APPROVED' ? `Revision ${revision.revisionNumber} approved` : 'Proposal rejected');
      router.refresh();
    } catch (e) {
      if (e instanceof ApiError && e.body.error === 'revision_superseded') {
        const current = e.body.current as ScopeChangeDetail;
        setSuperseded({ seen: revision, latest: current.revisions.at(-1)! });
      } else setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setPending(null);
    }
  }

  if (superseded) {
    return (
      <div role="alert" className="space-y-4 rounded-lg border border-warning/40 bg-warning-soft p-4 sm:p-5">
        <div>
          <p className="font-semibold text-warning">This proposal changed while you were reading it</p>
          <p className="mt-1 text-sm">
            Your decision was not recorded. Revision {superseded.latest.revisionNumber} replaced revision{' '}
            {superseded.seen.revisionNumber}. Here is what’s different:
          </p>
        </div>
        <RevisionDiff from={superseded.seen} to={superseded.latest} className="rounded-md bg-surface p-3" />
        <Button
          onClick={() => {
            setSuperseded(null);
            router.refresh();
          }}
        >
          Review revision {superseded.latest.revisionNumber}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-lg border border-accent/40 bg-accent-soft p-4 sm:p-5">
      <div>
        <p className="font-semibold">Your approval is needed</p>
        <p className="mt-1 text-sm">
          You are deciding on <strong>revision {revision.revisionNumber}</strong>:{' '}
          <PriceDelta cents={revision.priceDeltaCents} />, <DayDelta days={revision.deadlineDeltaDays} />.
        </p>
      </div>
      {error && <ErrorNotice title="Decision not recorded">{error}</ErrorNotice>}
      <Field label="Note to the agency (optional)">
        {(p) => (
          <Textarea
            {...p}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={2000}
            className="min-h-16 bg-surface"
          />
        )}
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => decide('APPROVED')} loading={pending === 'APPROVED'} disabled={pending !== null}>
          Approve revision {revision.revisionNumber}
        </Button>
        <Button
          variant="secondary"
          onClick={() => decide('REJECTED')}
          loading={pending === 'REJECTED'}
          disabled={pending !== null}
        >
          Reject
        </Button>
      </div>
    </div>
  );
}
