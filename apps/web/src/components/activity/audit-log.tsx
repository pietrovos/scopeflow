'use client';

import { useState } from 'react';
import type { ActivityEventDto } from '@/lib/types';
import { useApi } from '@/lib/api-context';
import { Button } from '@/components/ui/button';
import { ErrorNotice } from '@/components/ui/states';
import { ActivityItem } from './activity-item';

interface Page {
  items: ActivityEventDto[];
  nextBefore: string | null;
}

/** Org-wide audit log, paged backwards by sequence number. */
export function AuditLog({
  orgId,
  initial,
  projectNames,
}: {
  orgId: string;
  initial: Page;
  projectNames: Record<string, string>;
}) {
  const api = useApi();
  const [items, setItems] = useState(initial.items);
  const [next, setNext] = useState(initial.nextBefore);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  return (
    <div>
      <ol className="divide-y divide-border">
        {items.map((e) => (
          <li key={e.seq} className="flex items-start justify-between gap-4 px-4 py-3 sm:px-5">
            <ActivityItem
              event={e}
              showProject={e.projectId && e.type !== 'project.created' ? projectNames[e.projectId] : undefined}
            />
            <span className="hidden shrink-0 font-mono text-xs text-muted sm:block" title="Sequence number">
              #{e.seq}
            </span>
          </li>
        ))}
      </ol>
      {error && (
        <div className="p-4">
          <ErrorNotice>{error}</ErrorNotice>
        </div>
      )}
      {next && (
        <div className="border-t border-border p-4 text-center">
          <Button
            variant="secondary"
            size="sm"
            loading={loading}
            onClick={async () => {
              setLoading(true);
              setError(undefined);
              try {
                const page = await api.get<Page>(`/orgs/${orgId}/activity?before=${next}&limit=50`);
                setItems((cur) => [...cur, ...page.items]);
                setNext(page.nextBefore);
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Could not load more');
              } finally {
                setLoading(false);
              }
            }}
          >
            Load older events
          </Button>
        </div>
      )}
    </div>
  );
}
