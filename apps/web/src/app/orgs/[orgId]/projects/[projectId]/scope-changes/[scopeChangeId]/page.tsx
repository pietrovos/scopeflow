import Link from 'next/link';
import { isStaff } from '@scopeflow/shared';
import { serverApi } from '@/lib/server-api';
import type { OrgSummary, ScopeChangeDetail } from '@/lib/types';
import { LocalTime } from '@/components/ui/local-time';
import { PageHeader } from '@/components/page-header';
import { Card, CardHeader } from '@/components/ui/card';
import { DecisionPanel } from '@/components/scope/decision-panel';
import { RevisePanel } from '@/components/scope/revise-panel';
import { RevisionHistory } from '@/components/scope/revision-history';
import { DayDelta, PriceDelta, ScopeStatusBadge } from '@/components/scope/scope-status';

type Props = PageProps<'/orgs/[orgId]/projects/[projectId]/scope-changes/[scopeChangeId]'>;

export async function generateMetadata({ params }: Props) {
  const { orgId, projectId, scopeChangeId } = await params;
  const sc = await serverApi<ScopeChangeDetail>(`/orgs/${orgId}/projects/${projectId}/scope-changes/${scopeChangeId}`);
  return { title: `SC-${sc.number} ${sc.currentRevision?.title ?? ''}` };
}

export default async function ScopeChangePage({ params }: Props) {
  const { orgId, projectId, scopeChangeId } = await params;
  const [org, sc] = await Promise.all([
    serverApi<OrgSummary>(`/orgs/${orgId}`),
    serverApi<ScopeChangeDetail>(`/orgs/${orgId}/projects/${projectId}/scope-changes/${scopeChangeId}`),
  ]);
  const current = sc.revisions.find((r) => r.id === sc.currentRevisionId)!;
  const staff = isStaff(org.role);

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href={`/orgs/${orgId}/projects/${projectId}`} className="hover:text-text">
            ← {sc.project.name}
          </Link>
        }
        title={
          <span>
            <span className="text-muted">SC-{sc.number}</span> {current.title}
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-2 text-sm">
            <ScopeStatusBadge status={sc.status} />
            Proposed by {sc.createdBy.name} · <LocalTime iso={sc.createdAt} />
          </span>
        }
        actions={staff ? <RevisePanel orgId={orgId} projectId={projectId} sc={sc} /> : undefined}
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
        <div className="min-w-0 space-y-6">
          {org.role === 'CLIENT' && sc.status === 'PENDING' && (
            <DecisionPanel orgId={orgId} projectId={projectId} sc={sc} />
          )}
          <Card>
            <CardHeader
              title={`Revision ${current.revisionNumber}`}
              description={
                <>
                  {current.createdBy.name} · <LocalTime iso={current.createdAt} />
                </>
              }
            />
            <div className="space-y-4 p-4 sm:p-5">
              <dl className="grid grid-cols-2 gap-4">
                <div className="rounded-md bg-surface-2 p-3">
                  <dt className="text-xs uppercase tracking-wide text-muted">Price impact</dt>
                  <dd className="mt-1 text-xl font-semibold">
                    <PriceDelta cents={current.priceDeltaCents} />
                  </dd>
                </div>
                <div className="rounded-md bg-surface-2 p-3">
                  <dt className="text-xs uppercase tracking-wide text-muted">Schedule impact</dt>
                  <dd className="mt-1 text-xl font-semibold">
                    <DayDelta days={current.deadlineDeltaDays} />
                  </dd>
                </div>
              </dl>
              <p className="whitespace-pre-wrap text-sm leading-6">{current.description}</p>
            </div>
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader title="Revisions" description={`${sc.revisions.length} total. Revisions are never edited.`} />
          <div className="p-4 sm:p-5">
            <RevisionHistory
              key={sc.revisions.length}
              revisions={sc.revisions}
              decisions={sc.decisions}
              currentId={sc.currentRevisionId}
              approvedId={sc.approvedRevisionId}
            />
          </div>
        </Card>
      </div>
    </>
  );
}
