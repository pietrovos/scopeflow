'use client';

import { useRouter } from 'next/navigation';
import { ROLE_LABELS, type Role } from '@scopeflow/shared';
import type { Member } from '@/lib/types';
import { useApi } from '@/lib/api-context';
import { formatDate } from '@/lib/format';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';

const ASSIGNABLE: Exclude<Role, 'OWNER'>[] = ['ADMIN', 'MEMBER', 'CLIENT'];

export function MembersTable({
  orgId,
  members,
  viewer,
}: {
  orgId: string;
  members: Member[];
  viewer: { userId: string; role: Role };
}) {
  const api = useApi();
  const router = useRouter();
  const toast = useToast();

  const canManage = (m: Member) =>
    m.role !== 'OWNER' &&
    m.user.id !== viewer.userId &&
    (viewer.role === 'OWNER' || (viewer.role === 'ADMIN' && m.role !== 'ADMIN'));

  async function act(fn: () => Promise<unknown>, done: string) {
    try {
      await fn();
      toast(done);
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Something went wrong', 'error');
    }
  }

  return (
    <ul aria-label="Members" className="divide-y divide-border">
      {members.map((m) => (
        <li key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-5">
          <div className="flex min-w-0 flex-1 basis-56 items-center gap-3">
            <Avatar name={m.user.name} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {m.user.name}
                {m.user.id === viewer.userId && <span className="font-normal text-muted"> (you)</span>}
              </p>
              <p className="truncate text-sm text-muted">{m.user.email}</p>
            </div>
          </div>
          <span className="hidden text-sm text-muted md:block">Joined {formatDate(m.createdAt)}</span>
          <div className="flex items-center gap-2">
            {canManage(m) ? (
              <>
                <label htmlFor={`role-${m.id}`} className="sr-only">
                  Role for {m.user.name}
                </label>
                <Select
                  id={`role-${m.id}`}
                  defaultValue={m.role}
                  className="h-8 w-36"
                  onChange={(e) =>
                    act(
                      () => api.patch(`/orgs/${orgId}/members/${m.id}`, { role: e.target.value }),
                      `${m.user.name} is now ${ROLE_LABELS[e.target.value as Role].toLowerCase()}`,
                    )
                  }
                >
                  {ASSIGNABLE.filter((r) => viewer.role === 'OWNER' || r !== 'ADMIN' || m.role === 'ADMIN').map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </Select>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Remove ${m.user.name}`}
                  onClick={() => {
                    if (confirm(`Remove ${m.user.name} from the organization?`)) {
                      void act(() => api.del(`/orgs/${orgId}/members/${m.id}`), `${m.user.name} removed`);
                    }
                  }}
                >
                  Remove
                </Button>
              </>
            ) : (
              <Badge tone={m.role === 'CLIENT' ? 'warning' : m.role === 'OWNER' ? 'accent' : 'neutral'}>
                {ROLE_LABELS[m.role]}
              </Badge>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
