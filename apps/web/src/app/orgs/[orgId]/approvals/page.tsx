import Link from 'next/link';
import { isStaff } from '@scopeflow/shared';
import { serverApi } from '@/lib/server-api';
import type { OrgSummary, ScopeChangeSummary } from '@/lib/types';
import { LocalTime } from '@/components/ui/local-time';
import { cn } from '@/lib/cn';
import { PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/states';
import { Delta, ScopeStatusBadge } from '@/components/scope/scope-status';
import { icons } from '@/components/shell/icons';

export const metadata = { title: 'Approvals' };

const TABS = [
  { id: 'PENDING', label: 'Pending' },
  { id: 'APPROVED', label: 'Approved' },
  { id: 'REJECTED', label: 'Rejected' },
] as const;

export default async function ApprovalsPage({ params, searchParams }: PageProps<'/orgs/[orgId]/approvals'>) {
  const { orgId } = await params;
  const { status: raw } = await searchParams;
  const status = TABS.find((t) => t.id === raw)?.id ?? 'PENDING';
  const [org, items] = await Promise.all([
    serverApi<OrgSummary>(`/orgs/${orgId}`),
    serverApi<ScopeChangeSummary[]>(`/orgs/${orgId}/scope-changes?status=${status}`),
  ]);
  const staff = isStaff(org.role);

  return (
    <>
      <PageHeader
        title="Approvals"
        description={
          staff
            ? 'Scope changes waiting on clients, and what they decided.'
            : 'Changes the agency needs you to approve.'
        }
      />
      <nav aria-label="Approval status" className="mb-4 flex gap-1 border-b border-border">
        {TABS.map((tab) => (
          <Link
            key={tab.id}
            href={`/orgs/${orgId}/approvals?status=${tab.id}`}
            aria-current={tab.id === status ? 'page' : undefined}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-sm font-medium',
              tab.id === status ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-text',
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      <Card>
        {items.length === 0 ? (
          <EmptyState
            icon={icons.approvals({ className: 'size-8' })}
            title={status === 'PENDING' ? 'Nothing waiting for approval' : `No ${status.toLowerCase()} changes yet`}
            description={
              status === 'PENDING' && !staff
                ? 'You’re all caught up. New proposals from the agency will appear here.'
                : undefined
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {items.map((sc) => (
              <li key={sc.id}>
                <Link
                  href={`/orgs/${orgId}/projects/${sc.projectId}/scope-changes/${sc.id}`}
                  className="flex flex-col gap-2 px-4 py-4 hover:bg-surface-2 sm:flex-row sm:items-center sm:px-5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted">{sc.project.name}</p>
                    <p className="font-medium">
                      <span className="text-muted">SC-{sc.number}</span> {sc.currentRevision?.title}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      Revision {sc.currentRevision?.revisionNumber} · <LocalTime iso={sc.updatedAt} mode="relative" />
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
    </>
  );
}
