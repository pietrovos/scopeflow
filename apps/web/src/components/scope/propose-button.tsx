'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { ScopeChangeDetail } from '@/lib/types';
import { useApi } from '@/lib/api-context';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { ScopeChangeForm } from './scope-change-form';

export function ProposeButton({
  orgId,
  projectId,
  size = 'sm',
}: {
  orgId: string;
  projectId: string;
  size?: 'sm' | 'md';
}) {
  const api = useApi();
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size={size} onClick={() => setOpen(true)}>
        Propose change
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Propose a scope change"
        description="The client approves this exact revision. Later edits become new revisions."
        className="max-w-xl"
      >
        <ScopeChangeForm
          submitLabel="Send for approval"
          onCancel={() => setOpen(false)}
          onSubmit={async (content) => {
            const sc = await api.post<ScopeChangeDetail>(`/orgs/${orgId}/projects/${projectId}/scope-changes`, content);
            toast(`SC-${sc.number} sent for approval`);
            setOpen(false);
            router.push(`/orgs/${orgId}/projects/${projectId}/scope-changes/${sc.id}`);
          }}
        />
      </Dialog>
    </>
  );
}
