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
    <div className="overflow-x-auto">
      <table className="w-full min-w-[36rem] text-sm">
        <caption className="sr-only">Organization members</caption>
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
            <th scope="col" className="px-5 py-2 font-medium">
              Person
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Role
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Joined
            </th>
            <th scope="col" className="px-5 py-2">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {members.map((m) => (
            <tr key={m.id}>
              <td className="px-5 py-3">
                <div className="flex items-center gap-3">
                  <Avatar name={m.user.name} />
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {m.user.name}
                      {m.user.id === viewer.userId && <span className="font-normal text-muted"> (you)</span>}
                    </p>
                    <p className="truncate text-muted">{m.user.email}</p>
                  </div>
                </div>
              </td>
              <td className="px-3 py-3">
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
                      {ASSIGNABLE.filter((r) => viewer.role === 'OWNER' || r !== 'ADMIN' || m.role === 'ADMIN').map(
                        (r) => (
                          <option key={r} value={r}>
                            {ROLE_LABELS[r]}
                          </option>
                        ),
                      )}
                    </Select>
                  </>
                ) : (
                  <Badge tone={m.role === 'CLIENT' ? 'warning' : m.role === 'OWNER' ? 'accent' : 'neutral'}>
                    {ROLE_LABELS[m.role]}
                  </Badge>
                )}
              </td>
              <td className="px-3 py-3 text-muted">{formatDate(m.createdAt)}</td>
              <td className="px-5 py-3 text-right">
                {canManage(m) && (
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
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
