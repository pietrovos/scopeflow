'use client';

import { useRouter } from 'next/navigation';
import { ROLE_LABELS } from '@scopeflow/shared';
import type { Invitation } from '@/lib/types';
import { useApi } from '@/lib/api-context';
import { formatDate } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';

export function PendingInvitations({ orgId, invitations }: { orgId: string; invitations: Invitation[] }) {
  const api = useApi();
  const router = useRouter();
  const toast = useToast();
  if (invitations.length === 0) return <p className="px-5 py-4 text-sm text-muted">No pending invitations.</p>;
  return (
    <ul className="divide-y divide-border">
      {invitations.map((inv) => (
        <li key={inv.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
          <span className="min-w-0 flex-1 truncate font-medium">{inv.email}</span>
          <Badge>{ROLE_LABELS[inv.role]}</Badge>
          <span className="text-muted">Expires {formatDate(inv.expiresAt)}</span>
          <Button
            size="sm"
            variant="ghost"
            aria-label={`Revoke invitation for ${inv.email}`}
            onClick={async () => {
              try {
                await api.del(`/orgs/${orgId}/invitations/${inv.id}`);
                toast('Invitation revoked');
                router.refresh();
              } catch (e) {
                toast(e instanceof Error ? e.message : 'Could not revoke', 'error');
              }
            }}
          >
            Revoke
          </Button>
        </li>
      ))}
    </ul>
  );
}
