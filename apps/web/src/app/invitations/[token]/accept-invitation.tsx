'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useApi } from '@/lib/api-context';
import { Button } from '@/components/ui/button';
import { ErrorNotice } from '@/components/ui/states';

export function AcceptInvitation({ token }: { token: string }) {
  const api = useApi();
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  return (
    <div className="space-y-3">
      {error && <ErrorNotice title="Couldn’t accept">{error}</ErrorNotice>}
      <Button
        loading={pending}
        className="w-full"
        onClick={async () => {
          setPending(true);
          setError(undefined);
          try {
            const { orgId } = await api.post<{ orgId: string }>(`/invitations/${encodeURIComponent(token)}/accept`);
            router.push(`/orgs/${orgId}`);
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Something went wrong');
            setPending(false);
          }
        }}
      >
        Accept invitation
      </Button>
    </div>
  );
}
