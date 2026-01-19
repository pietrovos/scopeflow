import Link from 'next/link';
import type { ScopeChangeSummary } from '@/lib/types';
import { LocalTime } from '@/components/ui/local-time';
import { Card, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/states';
import { Delta, ScopeStatusBadge } from './scope-status';
import { ProposeButton } from './propose-button';

export function ScopeChangeList({
  orgId,
  projectId,
  items,
  canPropose,
}: {
  orgId: string;
  projectId: string;
  items: ScopeChangeSummary[];
  canPropose: boolean;
}) {
  return (
    <Card>
      <CardHeader
        title="Scope changes"
        description="Proposed changes to price or schedule, each approved revision by revision."
        action={canPropose ? <ProposeButton orgId={orgId} projectId={projectId} /> : undefined}
      />
      {items.length === 0 ? (
        <EmptyState
          title="No scope changes"
          description={
            canPropose
              ? 'When the client asks for something new, propose it here so they can approve the cost and timing.'
              : 'Nothing has been proposed for this project.'
          }
        />
      ) : (
        <ul className="divide-y divide-border">
          {items.map((sc) => (
            <li key={sc.id}>
              <Link
                href={`/orgs/${orgId}/projects/${projectId}/scope-changes/${sc.id}`}
                className="flex flex-col gap-2 px-4 py-4 hover:bg-surface-2 sm:flex-row sm:items-center sm:px-5"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    <span className="text-muted">SC-{sc.number}</span> {sc.currentRevision?.title}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    Revision {sc.currentRevision?.revisionNumber} · updated{' '}
                    <LocalTime iso={sc.updatedAt} mode="relative" />
                  </p>
                </div>
                {sc.currentRevision && (
                  <Delta cents={sc.currentRevision.priceDeltaCents} days={sc.currentRevision.deadlineDeltaDays} />
                )}
                <ScopeStatusBadge status={sc.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
