'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Member, Person } from '@/lib/types';
import { useApi } from '@/lib/api-context';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Select } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';

/** Which client users can see this project. Only owners and admins can change it. */
export function ClientsPanel({
  orgId,
  projectId,
  clients,
  clientMembers,
  canManage,
}: {
  orgId: string;
  projectId: string;
  clients: Person[];
  clientMembers: Member[];
  canManage: boolean;
}) {
  const api = useApi();
  const router = useRouter();
  const toast = useToast();
  const [selected, setSelected] = useState('');
  const [pending, setPending] = useState(false);
  const assignable = clientMembers.filter((m) => !clients.some((c) => c.id === m.user.id));
  const url = `/orgs/${orgId}/projects/${projectId}/clients`;

  async function run(fn: () => Promise<unknown>, done: string) {
    setPending(true);
    try {
      await fn();
      toast(done);
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Something went wrong', 'error');
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader as="h2" title="Client access" description="Client users who can see this project." />
      <div className="space-y-3 p-4 sm:p-5">
        {clients.length === 0 ? (
          <p className="text-sm text-muted">No client users yet.</p>
        ) : (
          <ul className="space-y-2">
            {clients.map((c) => (
              <li key={c.id} className="flex items-center gap-3">
                <Avatar name={c.name} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{c.name}</span>
                  <span className="block truncate text-xs text-muted">{c.email}</span>
                </span>
                {canManage && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    aria-label={`Remove ${c.name} from this project`}
                    onClick={() => run(() => api.del(`${url}/${c.id}`), `${c.name} removed`)}
                  >
                    Remove
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        {canManage && assignable.length > 0 && (
          <form
            className="flex gap-2 border-t border-border pt-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (selected) run(() => api.post(url, { userId: selected }), 'Client added').then(() => setSelected(''));
            }}
          >
            <label htmlFor="assign-client" className="sr-only">
              Client to add
            </label>
            <Select
              id="assign-client"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="h-8 flex-1"
            >
              <option value="">Add a client…</option>
              {assignable.map((m) => (
                <option key={m.user.id} value={m.user.id}>
                  {m.user.name}
                </option>
              ))}
            </Select>
            <Button size="sm" type="submit" disabled={!selected || pending}>
              Add
            </Button>
          </form>
        )}
      </div>
    </Card>
  );
}
