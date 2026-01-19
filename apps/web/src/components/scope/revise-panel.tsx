'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { ScopeChangeContent } from '@scopeflow/shared';
import type { ScopeChangeDetail } from '@/lib/types';
import { useApi } from '@/lib/api-context';
import { ApiError } from '@/lib/api-error';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { RevisionDiff } from './revision-diff';
import { draftFrom, ScopeChangeForm, type ScopeDraft } from './scope-change-form';

interface Conflict {
  latest: ScopeChangeDetail;
  mine: ScopeChangeContent;
  draft: ScopeDraft;
}

/**
 * Staff actions on a proposal: revise (append a revision) and withdraw. A stale revise
 * (409) opens a conflict view instead of overwriting the other person's revision.
 */
export function RevisePanel({ orgId, projectId, sc }: { orgId: string; projectId: string; sc: ScopeChangeDetail }) {
  const api = useApi();
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState<{ draft: ScopeDraft; version: number } | null>(null);
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const url = `/orgs/${orgId}/projects/${projectId}/scope-changes/${sc.id}`;
  const current = sc.revisions.find((r) => r.id === sc.currentRevisionId)!;
  const canRevise = sc.status === 'PENDING' || sc.status === 'REJECTED';

  async function submit(content: ScopeChangeContent, draft: ScopeDraft, version: number) {
    try {
      const updated = await api.post<ScopeChangeDetail>(`${url}/revisions`, { ...content, version });
      toast(`Revision ${updated.revisions.at(-1)!.revisionNumber} sent for approval`);
      setEditing(null);
      setConflict(null);
      router.refresh();
    } catch (e) {
      if (e instanceof ApiError && e.isConflict) {
        setEditing(null);
        setConflict({ latest: e.body.current as ScopeChangeDetail, mine: content, draft });
        return;
      }
      throw e;
    }
  }

  if (!canRevise) return null;

  return (
    <div className="flex flex-wrap gap-2">
      <Button onClick={() => setEditing({ draft: draftFrom(current), version: sc.version })}>
        {sc.status === 'REJECTED' ? 'Revise and resubmit' : 'Revise proposal'}
      </Button>
      <Button
        variant="ghost"
        onClick={async () => {
          if (!confirm(`Withdraw SC-${sc.number}? The client will no longer be asked to approve it.`)) return;
          try {
            await api.post(`${url}/withdraw`, { version: sc.version });
            toast('Proposal withdrawn');
            router.refresh();
          } catch (e) {
            toast(
              e instanceof ApiError && e.isConflict
                ? 'It changed meanwhile; reload and try again'
                : 'Could not withdraw',
              'error',
            );
          }
        }}
      >
        Withdraw
      </Button>

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={`Revise SC-${sc.number}`}
        description={`Saving creates revision ${current.revisionNumber + 1}. Revision ${current.revisionNumber} stays in the history exactly as it is.`}
        className="max-w-xl"
      >
        {editing && (
          <ScopeChangeForm
            initial={editing.draft}
            submitLabel={`Submit revision ${current.revisionNumber + 1}`}
            onCancel={() => setEditing(null)}
            onSubmit={(content, draft) => submit(content, draft, editing.version)}
          />
        )}
      </Dialog>

      <Dialog
        open={conflict !== null}
        onClose={() => setConflict(null)}
        title="Someone else revised this proposal"
        description="Your revision was not saved. Compare the latest revision with your draft, then decide."
        className="max-w-2xl"
      >
        {conflict && (
          <ConflictView
            conflict={conflict}
            onClose={() => setConflict(null)}
            onSubmit={submit}
            onEdit={(c) => {
              setConflict(null);
              setEditing({ draft: c.draft, version: c.latest.version });
            }}
          />
        )}
      </Dialog>
    </div>
  );
}

function ConflictView({
  conflict,
  onClose,
  onSubmit,
  onEdit,
}: {
  conflict: Conflict;
  onClose: () => void;
  onSubmit: (content: ScopeChangeContent, draft: ScopeDraft, version: number) => Promise<void>;
  onEdit: (c: Conflict) => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const latest = conflict.latest.revisions.at(-1)!;
  const locked = conflict.latest.status === 'APPROVED' || conflict.latest.status === 'WITHDRAWN';

  return (
    <div className="space-y-4">
      <p className="text-sm">
        <strong>{latest.createdBy.name}</strong> saved revision {latest.revisionNumber}. Changes from their revision to
        your draft:
      </p>
      <RevisionDiff from={latest} to={conflict.mine} />
      {locked && (
        <p role="alert" className="rounded-md bg-warning-soft px-3 py-2 text-sm text-warning">
          The proposal is now {conflict.latest.status.toLowerCase()}, so it can’t be revised. Create a new scope change
          instead.
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          variant="secondary"
          onClick={() => {
            onClose();
            router.refresh();
          }}
        >
          Discard my draft
        </Button>
        {!locked && (
          <>
            <Button variant="secondary" onClick={() => onEdit(conflict)}>
              Keep editing
            </Button>
            <Button
              loading={pending}
              onClick={async () => {
                setPending(true);
                try {
                  await onSubmit(conflict.mine, conflict.draft, conflict.latest.version);
                } finally {
                  setPending(false);
                }
              }}
            >
              Submit mine as revision {latest.revisionNumber + 1}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
